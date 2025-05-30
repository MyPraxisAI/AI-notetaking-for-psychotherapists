// NextResponse is used implicitly by the enhanceRouteHandler
import type { NextResponse as _NextResponse } from 'next/server';
import { enhanceRouteHandler } from '@kit/next/routes';
import { getLogger } from '@kit/shared/logger';
import { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getUserPersonalAccount } from '../../../_lib/get-user-account';
import { aws } from '@kit/web-bg-common';
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
      } catch {
        // If no body is provided, that's fine
        logger.debug(ctx, 'No request body provided');
      }
      
      // Check if the recording exists and belongs to the user
      const { data: recording, error: fetchError } = await client
        .from('recordings')
        .select('id, status, client_id, standalone_chunks, session_id')
        .eq('id', recordingId)
        .eq('account_id', accountId)
        .single();
      
      if (fetchError) {
        logger.error({ ...ctx, error: fetchError }, 'Error fetching recording');
        return Response.json({ error: 'Recording not found' }, { status: 404 });
      }
      
      // Allow completing recordings that are in recording, paused, or processing states
      // This makes the endpoint reentrant in case of failures
      if (!['recording', 'paused', 'processing'].includes(recording.status)) {
        logger.warn({ ...ctx, currentStatus: recording.status }, 'Attempted to complete recording that is not in a valid state');
        return Response.json(
          { 
            error: 'Recording is not in a valid state for completion',
            recordingStatus: recording.status 
          },
          { status: 400 }
        );
      }
      
      // Log recording details before processing
      logger.info({ 
        ...ctx, 
        accountId, 
        clientId: recording.client_id, 
        recordingStatus: recording.status,
        existingSessionId: recording.session_id
      }, 'Recording details before processing');
      
      try {
        // Step 1: Check if there's already a session associated with the recording
        let sessionId = recording.session_id;
        
        // If no session exists, create one
        if (!sessionId) {
          // Prepare session data
          const sessionData = {
            account_id: accountId,
            client_id: recording.client_id, // This is guaranteed to be non-null by the database schema
            title: `Session ${new Date().toLocaleDateString()}`
          };
          
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
          
          // Store the new session ID
          sessionId = session.id;
          logger.info({ ...ctx, sessionId }, 'Successfully created new session');
          
          // Step 2: Update the recording with the session ID and last heartbeat
          const linkSessionData = {
            session_id: sessionId,
            last_heartbeat_at: new Date().toISOString(),
            status: 'processing' // Mark as processing while we queue transcription
          };
          
          const { error: linkError } = await client
            .from('recordings')
            .update(linkSessionData)
            .eq('id', recordingId)
            .select()
            .single();
          
          if (linkError) {
            logger.error({ ...ctx, error: linkError }, 'Error linking session to recording');
            return Response.json({ error: 'Failed to link session to recording' }, { status: 500 });
          }
          
          logger.info({ ...ctx, sessionId }, 'Successfully linked session to recording');
        } else {
          logger.info({ ...ctx, sessionId }, 'Using existing session for recording');
        }
        
        // Step 3: Queue audio transcription - let errors propagate to UI
        await aws.queueAudioTranscribe({
          recordingId,
          accountId,
        });
        
        logger.info({ 
          ...ctx, 
          sessionId, 
          standaloneChunks: recording.standalone_chunks ?? false 
        }, 'Audio transcription task queued successfully');

        // Step 4: Update recording status to completed
        const completeData = {
          status: 'completed',
          last_heartbeat_at: new Date().toISOString()
        };
        
        const { data: updatedRecording, error: updateError } = await client
          .from('recordings')
          .update(completeData)
          .eq('id', recordingId)
          .select()
          .single();
        
        if (updateError) {
          logger.error({ ...ctx, error: updateError }, 'Error marking recording as completed');
          return Response.json({ error: 'Failed to mark recording as completed' }, { status: 500 });
        }
        
        logger.info({ ...ctx, sessionId }, 'Recording completed successfully');
                
        return Response.json({ 
          recording: updatedRecording,
          sessionId
        });
      } catch (error) {
        logger.error({ 
          ...ctx, 
          error,
          errorMessage: error instanceof Error ? error.message : String(error)
        }, 'Unexpected error during recording completion');
        return Response.json({ error: 'Failed to complete recording due to unexpected error' }, { status: 500 });
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
