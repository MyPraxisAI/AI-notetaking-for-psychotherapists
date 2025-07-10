import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getLogger } from '@kit/shared-common/logger';
import { logAuditLogRead, extractClientIpFromHeaders } from '@kit/audit-log';
import { enhanceRouteHandler } from '@kit/next/routes';
import { SessionWithId } from '../../home/(user)/mypraxis/_lib/schemas/session';
import { Tables } from '~/lib/database.types';

export const GET = enhanceRouteHandler(
    async ({ request, user }) => {
  const logger = await getLogger();
  const url = new URL(request.url);
  const clientId = url.searchParams.get('clientId');

  try {
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!clientId) {
      return NextResponse.json({ error: 'Missing clientId' }, { status: 400 });
    }

    const client = getSupabaseServerClient();
    const { data: sessionsData, error: sessionsError } = await client
      .from('sessions')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });

      if (sessionsError) {
      logger.error({ userId: user.id, error: sessionsError }, 'Error fetching sessions');
      return NextResponse.json({ error: 'Error fetching sessions' }, { status: 500 });
    }
    // Log the read for each session
    if (Array.isArray(sessionsData) && sessionsData.length > 0) {
      await logAuditLogRead({
        actingUserId: user.id,
        tableName: 'sessions',
        recordId: undefined,
        ipAddress: extractClientIpFromHeaders(request.headers),
        details: { num_records: sessionsData.length, client_id: clientId },
      });
    }
    // Transform to SessionWithId format
    const result: SessionWithId[] = (sessionsData || []).map((record: Tables<'sessions'>) => ({
      id: record.id,
      clientId: record.client_id,
      title: record.title || '',
      note: record.note || undefined,
      transcript: undefined,
      createdAt: record.created_at,
    }));
    return NextResponse.json(result);
  } catch (error) {
    logger.error({ userId: user?.id, error }, 'Unhandled error in GET /api/sessions');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}, { auth: true }); 