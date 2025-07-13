// NextResponse is used implicitly by the enhanceRouteHandler
import type { NextResponse as _NextResponse } from 'next/server';
import { enhanceRouteHandler } from '@kit/next/routes';
import { getLogger } from '@kit/shared/logger';
import { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getUserPersonalAccount } from '../../../_lib/get-user-account';

// Initialize logger properly with await
const logger = await getLogger();

// Type assertion to allow access to custom tables
type CustomClient = SupabaseClient & {
  from: (table: string) => ReturnType<SupabaseClient['from']>;
};

// POST /api/recordings/[recordingId]/pause - Pause an active recording
export const POST = enhanceRouteHandler(
  async ({ params, user }) => {
    const recordingId = params.recordingId as string;
    
    const ctx = {
      name: 'pause-recording',
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
      
      // Check if the recording exists and belongs to the user
      const { data: recording, error: fetchError } = await client
        .from('recordings')
        .select('id, status')
        .eq('id', recordingId)
        .eq('account_id', accountId)
        .single();
      
      if (fetchError) {
        logger.error({ ...ctx, error: fetchError }, 'Error fetching recording');
        return Response.json({ error: 'Recording not found' }, { status: 404 });
      }
      
      if (recording.status !== 'recording' && recording.status !== 'paused') {
        logger.warn({ ...ctx, currentStatus: recording.status }, 'Attempted to pause recording that is not in recording state');
        return Response.json(
          { 
            error: 'Recording is not in a state that can be paused',
            recordingStatus: recording.status 
          },
          { status: 400 }
        );
      }
      
      // Update recording status to paused
      const { data: updatedRecording, error: updateError } = await client
        .from('recordings')
        .update({
          status: 'paused',
          last_heartbeat_at: new Date().toISOString()
        })
        .eq('id', recordingId)
        .select()
        .single();
      
      if (updateError) {
        logger.error({ ...ctx, error: updateError }, 'Error pausing recording');
        return Response.json({ error: 'Failed to pause recording' }, { status: 500 });
      }
      
      logger.info({ ...ctx }, 'Recording paused successfully');
      return Response.json({ recording: updatedRecording });
    } catch (error) {
      logger.error({ ...ctx, error }, 'Unexpected error pausing recording');
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
