import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getLogger } from '@kit/shared-common/logger';
import { logAuditLogRead, extractClientIpFromHeaders } from '@kit/audit-log';
import { enhanceRouteHandler } from '@kit/next/routes';
import { ClientWithId } from '../../../home/(user)/mypraxis/_lib/schemas/client';
import { createAccountsApi } from '@kit/web-bg-common';

export const GET = enhanceRouteHandler(
    async ({ params, request, user }) => {
  const logger = await getLogger();
  const { clientId } = params;
  try {
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!clientId) {
      return NextResponse.json({ error: 'Missing clientId' }, { status: 400 });
    }
    const client = getSupabaseServerClient();
    const accountsApi = createAccountsApi(client);
    const accountId = await accountsApi.getCurrentAccountId();
    const { data: clientData, error: clientError } = await client
      .from('clients')
      .select('*')
      .eq('id', clientId)
      .eq('account_id', accountId)
      .maybeSingle();
    if (clientError) {
      logger.error({ userId: user.id, error: clientError }, 'Error fetching client');
      return NextResponse.json({ error: 'Error fetching client' }, { status: 500 });
    }
    if (!clientData) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }
    await logAuditLogRead({
      actingUserId: user.id,
      tableName: 'clients',
      recordId: clientId,
      ipAddress: extractClientIpFromHeaders(request.headers),
    });
    const record = clientData;
    const result: ClientWithId = {
      id: record.id,
      fullName: record.full_name,
      email: record.email || '',
      phone: record.phone || '',
      createdAt: record.created_at,
      demo: record.demo || false,
    };
    return NextResponse.json(result);
  } catch (error) {
    logger.error({ userId: user?.id, error }, 'Unhandled error in GET /api/clients/[clientId]');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}, { auth: true }); 