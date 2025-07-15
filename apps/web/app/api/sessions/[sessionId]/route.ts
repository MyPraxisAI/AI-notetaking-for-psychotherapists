import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getLogger, Logger} from '@kit/shared-common/logger';
import { logAuditLogRead, extractClientIpFromHeaders } from '@kit/audit-log';
import { SessionWithId } from '../../../home/(user)/mypraxis/_lib/schemas/session';
import { enhanceRouteHandler } from '@kit/next/routes';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '~/lib/database.types';
import type { Transcript } from '@kit/web-bg-common';

async function fetchTranscript(
  client: SupabaseClient<Database>,
  sessionId: string,
  user: { id: string },
  request: Request,
  logger: Logger
): Promise<Transcript | null> {
  const { data: transcript, error: transcriptError } = await client
    .from('transcripts')
    .select('id, content_json')
    .eq('session_id', sessionId)
    .maybeSingle();
  if (transcriptError) {
    logger.error({ userId: user.id, error: transcriptError }, 'Error fetching transcript');
    return null;
  }
  if (!transcript) {
    return null;
  }
  // Log the read to audit_log if transcript has an id and userId is provided
  if (transcript.id && user?.id) {
    await logAuditLogRead({
      actingUserId: user.id,
      tableName: 'transcripts',
      recordId: transcript.id,
      ipAddress: extractClientIpFromHeaders(request.headers)
    });
  }
    return transcript.content_json as unknown as Transcript ?? null;
}

export const GET = enhanceRouteHandler(
    async ({ params, request, user }: { params: Record<string, string>, request: Request, user: { id: string } }) => {
  const logger = await getLogger();
  const { sessionId } = params;

  try {
    if (!sessionId) {
      return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });
    }
    const client = getSupabaseServerClient();
    // Fetch session data
    const { data: sessionData, error: sessionError } = await client
      .from('sessions')
      .select('*')
      .eq('id', sessionId)
      .maybeSingle();
    if (sessionError) {
      logger.error({ userId: user.id, error: sessionError }, 'Error fetching session');
      return NextResponse.json({ error: 'Error fetching session' }, { status: 500 });
    }
    if (!sessionData) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }
    // Log the read for this session (sessions table)
    await logAuditLogRead({
      actingUserId: user.id,
      tableName: 'sessions',
      recordId: sessionData.id,
      ipAddress: extractClientIpFromHeaders(request.headers)
    });
    // Fetch transcript content using the helper
    const transcript = await fetchTranscript(client, sessionId, user, request, logger);
    // Transform to SessionWithId format
    const result: SessionWithId = {
      id: sessionData.id,
      clientId: sessionData.client_id,
      title: sessionData.title || '',
      note: sessionData.note || undefined,
      transcript: transcript || undefined,
      createdAt: sessionData.created_at,
    };
    return NextResponse.json(result);
  } catch (error) {
    logger.error({ userId: user?.id, error }, 'Unhandled error in GET /api/sessions/[sessionId]');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}, { auth: true }); 