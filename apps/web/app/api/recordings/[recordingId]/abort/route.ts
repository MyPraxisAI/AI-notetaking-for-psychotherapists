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

// POST /api/recordings/[recordingId]/abort - Abort a specific recording
export const POST = enhanceRouteHandler(
  async ({ params, user }) => {
    const recordingId = params.recordingId;
    const ctx = {
      name: 'abort-recording',
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
      
      // Verify the recording belongs to this account and is in an abortable state
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
      
      // Only allow aborting recordings that are in 'recording' or 'paused' status
      if (!['recording', 'paused'].includes(recording.status)) {
        logger.warn({ ...ctx, recordingStatus: recording.status }, 'Attempted to abort recording in invalid state');
        return Response.json(
          { error: 'Cannot abort recording in current state', 
            recordingStatus: recording.status },
          { status: 400 }
        );
      }
      
      // Delete the recording (chunks will be cascade-deleted)
      const { error: deleteError } = await client
        .from('recordings')
        .delete()
        .eq('id', recordingId);
      
      if (deleteError) {
        logger.error({ ...ctx, error: deleteError }, 'Error deleting recording');
        return Response.json({ error: 'Failed to delete recording' }, { status: 500 });
      }
      
      logger.info(ctx, 'Recording deleted successfully');
      return Response.json({ success: true, recordingStatus: recording.status });
    } catch (error) {
      logger.error({ ...ctx, error }, 'Failed to delete recording');
      return Response.json({ error: 'Internal server error' }, { status: 500 });
    }
  },
  {
    auth: true
  }
);
