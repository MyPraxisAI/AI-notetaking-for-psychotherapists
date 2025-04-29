// NextResponse is used implicitly by the enhanceRouteHandler
import type { NextResponse as _NextResponse } from 'next/server';
import { enhanceRouteHandler } from '@kit/next/routes';
import { getLogger } from '@kit/shared/logger';
import { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getUserPersonalAccount } from '../../../_lib/get-user-account';
import { queueAudioTranscribe } from '../../../../../lib/aws/sqs';
import { z } from 'zod';

// Initialize logger properly with await
const logger = await getLogger();

// Type assertion to allow access to custom tables
type CustomClient = SupabaseClient & {
  from: (table: string) => ReturnType<SupabaseClient['from']>;
};

// Schema for complete recording request
const CompleteRecordingSchema = z.object({});

// POST /api/recordings/[recordingId]/complete - Mark recording as complete and create a session
export const POST = enhanceRouteHandler(
  async ({ params, request, user }) => {
    const recordingId = params.recordingId as string;
    
    const ctx = {
      name: 'complete-recording',
      userId: user?.id || 'anonymous',
      recordingId,
    };

    try {
      const client = getSupabaseServerClient() as CustomClient;
      
      // Get the user's personal account using the utility function
      const accountId = await getUserPersonalAccount(user.id);
      
      if (!accountId) {
        logger.error({ ...ctx, userId: user.id }, 'Personal account not found for user');
        return Response.json({ error: 'Personal account not found' }, { status: 404 });
      }
      
      // Parse and validate request body - just for validation
      try {
        const body = await request.json();
        const result = CompleteRecordingSchema.safeParse(body);
        if (!result.success) {
          logger.warn({ ...ctx, errors: result.error.format() }, 'Invalid request body for complete recording');
        }
      } catch (e) {
        // If no body is provided, that's fine
        logger.debug(ctx, 'No request body provided');
      }
      
      // Check if the recording exists and belongs to the user
      const { data: recording, error: fetchError } = await client
        .from('recordings')
        .select('id, status, client_id, standalone_chunks')
        .eq('id', recordingId)
        .eq('account_id', accountId)
        .single();
      
      if (fetchError) {
        logger.error({ ...ctx, error: fetchError }, 'Error fetching recording');
        return Response.json({ error: 'Recording not found' }, { status: 404 });
      }
      
      if (!['recording', 'paused'].includes(recording.status)) {
        logger.warn({ ...ctx, currentStatus: recording.status }, 'Attempted to complete recording that is not active');
        return Response.json(
          { error: 'Recording is not in an active state' },
          { status: 400 }
        );
      }
      
      // Log recording details before creating session
      logger.info({ 
        ...ctx, 
        accountId, 
        clientId: recording.client_id, 
        recordingStatus: recording.status 
      }, 'Recording details before creating session');
      
      // Prepare session data
      const sessionData = {
        account_id: accountId,
        client_id: recording.client_id, // This is guaranteed to be non-null by the database schema
        title: `Session ${new Date().toLocaleDateString()}`
      };
      
      try {
        // Create a session
        const { data: session, error: sessionError } = await client
          .from('sessions')
          .insert(sessionData)
          .select()
          .single();
        
        if (sessionError) {
          logger.error({ ...ctx, error: sessionError }, 'Error creating session for recording');
          return Response.json({ error: 'Failed to create session' }, { status: 500 });
        }
        
        // Include sessionId as part of the context object
        const sessionCtx = { ...ctx, sessionId: session.id };
        logger.info(sessionCtx, 'Successfully created session');
        
        // Store session ID for use outside the try block
        const sessionId = session.id;
        
        // Update recording status to completed and link to session
        const updateData = {
          status: 'completed',
          last_heartbeat_at: new Date().toISOString(),
          session_id: sessionId
        };
        
        const { data: updatedRecording, error: updateError } = await client
          .from('recordings')
          .update(updateData)
          .eq('id', recordingId)
          .select()
          .single();
        
        if (updateError) {
          logger.error({ ...ctx, error: updateError }, 'Error completing recording');
          return Response.json({ error: 'Failed to complete recording' }, { status: 500 });
        }
        
        // Include sessionId as part of the context object
        logger.info({ ...ctx, sessionId }, 'Recording completed successfully');
        
        try {
          await queueAudioTranscribe({
            recordingId,
            accountId,
          });
          
          logger.info({ 
            ...ctx, 
            sessionId, 
            standaloneChunks: recording.standalone_chunks ?? false 
          }, 'Audio transcription task queued successfully');
        } catch (queueError) {
          // Log the error but don't fail the request
          logger.error({ 
            ...ctx, 
            error: queueError,
            errorMessage: queueError instanceof Error ? queueError.message : String(queueError) 
          }, 'Error queuing audio processing tasks');
          
          // We'll still return success since the recording was completed
          // The audio processing can be retried later if needed
        }
        
        return Response.json({ 
          recording: updatedRecording,
          sessionId
        });
      } catch (insertError) {
        logger.error({ 
          ...ctx, 
          error: insertError,
          errorMessage: insertError instanceof Error ? insertError.message : String(insertError),
          sessionData
        }, 'Unexpected error during session creation');
        return Response.json({ error: 'Failed to create session due to unexpected error' }, { status: 500 });
      }
      
      // This code is now inside the try block
    } catch (error) {
      logger.error({ ...ctx, error }, 'Unexpected error completing recording');
      return Response.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  },
  {
    auth: true
  }
);
