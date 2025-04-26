// NextResponse is used implicitly by the enhanceRouteHandler
import type { NextResponse as _NextResponse } from 'next/server';
import { enhanceRouteHandler } from '@kit/next/routes';
import { getLogger } from '@kit/shared/logger';
import { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getUserPersonalAccount } from '../../_lib/get-user-account';
import { z } from 'zod';

// Initialize logger properly with await
const logger = await getLogger();

// Type assertion to allow access to custom tables
type CustomClient = SupabaseClient & {
  from: (table: string) => ReturnType<SupabaseClient['from']>;
};

// Schema for start recording request
const StartRecordingSchema = z.object({
  clientId: z.string().uuid()
});

// POST /api/recordings/start - Start a new recording
export const POST = enhanceRouteHandler(
  async ({ request, user }) => {
    const ctx = {
      name: 'start-recording',
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
      
      // Parse and validate request body
      const body = await request.json();
      const result = StartRecordingSchema.safeParse(body);
      
      if (!result.success) {
        logger.warn({ ...ctx, errors: result.error.format() }, 'Invalid request body for start recording');
        return Response.json(
          { error: 'Invalid request', details: result.error.format() },
          { status: 400 }
        );
      }
      
      const { clientId } = result.data;
      
      // Check if there's already an active recording
      const { data: existingRecording, error: checkError } = await client
        .from('recordings')
        .select('id')
        .eq('account_id', accountId)
        .in('status', ['recording', 'paused'])
        .limit(1)
        .single();
      
      if (checkError && checkError.code !== 'PGRST116') { // PGRST116 is "no rows returned"
        logger.error({ ...ctx, error: checkError, msg: 'Error checking for existing recordings' });
        return Response.json({ error: 'Failed to check for existing recordings' }, { status: 500 });
      }
      
      if (existingRecording) {
        logger.info({ ...ctx, existingRecordingId: existingRecording.id }, 'Attempted to start recording when one already exists');
        return Response.json(
          { error: 'There is already an active recording for this account' },
          { status: 409 }
        );
      }
      
      // Create new recording
      const { data: recording, error } = await client
        .from('recordings')
        .insert({
          account_id: accountId,
          client_id: clientId,
          status: 'recording',
          last_heartbeat_at: new Date().toISOString()
        })
        .select()
        .single();
      
      if (error) {
        logger.error({ ...ctx, error, accountId, clientId }, 'Error creating new recording');
        return Response.json({ error: 'Failed to create recording' }, { status: 500 });
      }
      
      logger.info({ ...ctx, recordingId: recording.id }, 'Recording started successfully');
      return Response.json({ recording });
    } catch (error) {
      logger.error({ ...ctx, error }, 'Unexpected error starting recording');
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
