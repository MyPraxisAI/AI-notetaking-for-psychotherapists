// NextResponse is used implicitly by the enhanceRouteHandler
import type { NextResponse as _NextResponse } from 'next/server';
import { enhanceRouteHandler } from '@kit/next/routes';
import { getLogger } from '@kit/shared/logger';
import { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getUserPersonalAccount } from '../_lib/get-user-account';

// Initialize logger properly with await
const logger = await getLogger();

// Type assertion to allow access to custom tables
type CustomClient = SupabaseClient & {
  from: (table: string) => ReturnType<SupabaseClient['from']>;
};

// GET /api/recordings/status - Get current active recording (if any)
export const GET = enhanceRouteHandler(
  async ({ request: _request, user }) => {
    const ctx = {
      name: 'get-recording-status',
      userId: user?.id || 'anonymous',
    };

    try {
      const client = getSupabaseServerClient() as CustomClient;
      
      // Get the user's personal account using the utility function
      const accountId = await getUserPersonalAccount(user.id);
      
      if (!accountId) {
        logger.error({ ...ctx, userId: user.id }, 'Personal account not found for user');
        return Response.json({ error: 'Personal account not found' }, { status: 404 });
      }
      
      // Get active recording (status is 'recording' or 'paused')
      const { data: recording, error } = await client
        .from('recordings')
        .select('*')
        .eq('account_id', accountId)
        .in('status', ['recording', 'paused'])
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows returned"
        logger.error({ ...ctx, error, accountId }, 'Error fetching active recording');
        return Response.json({ error: 'Failed to fetch recording status' }, { status: 500 });
      }
      
      if (!recording) {
        return Response.json({ recording: null });
      }
      
      // Get chunks for this recording
      const { data: chunks, error: chunksError } = await client
        .from('recordings_chunks')
        .select('*')
        .eq('recording_id', recording.id)
        .order('chunk_number', { ascending: true });
      
      if (chunksError) {
        logger.error({ ...ctx, error: chunksError, recordingId: recording.id }, 'Error fetching recording chunks');
      }
      
      return Response.json({
        recording: {
          ...recording,
          chunks: chunks || []
        }
      });
    } catch (error) {
      logger.error({ ...ctx, error }, 'Failed to fetch recording status');
      return Response.json({ error: 'Internal server error' }, { status: 500 });
    }
  },
  {
    auth: true
  }
);
