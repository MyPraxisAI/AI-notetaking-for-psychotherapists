import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getLogger } from '@kit/shared-common/logger';
import { logAuditLogRead, extractClientIp } from '@kit/audit-log';
import { enhanceRouteHandler } from '@kit/next/routes';
import { ClientWithId } from '../../home/(user)/mypraxis/_lib/schemas/client';
import { createAccountsApi } from '@kit/web-bg-common';

export const GET = enhanceRouteHandler(
    async ({ params, request, user }) => {
  const logger = await getLogger();
  try {
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const client = getSupabaseServerClient();
    const accountsApi = createAccountsApi(client);
    const accountId = await accountsApi.getCurrentAccountId();
    const { data: therapistData, error: therapistError } = await client
      .from('therapists')
      .select('id')
      .eq('account_id', accountId)
      .single();
    if (therapistError || !therapistData) {
      logger.error({ userId: user.id, error: therapistError }, 'Therapist not found');
      return NextResponse.json({ error: 'Therapist not found' }, { status: 404 });
    }
    const therapistId = therapistData.id;
    const { data: clientsData, error: clientsError } = await client
      .from('clients')
      .select('*')
      .eq('therapist_id', therapistId)
      .order('created_at', { ascending: false });
    if (clientsError) {
      logger.error({ userId: user.id, error: clientsError }, 'Error fetching clients');
      return NextResponse.json({ error: 'Error fetching clients' }, { status: 500 });
    }
    if (Array.isArray(clientsData) && clientsData.length > 0) {
      await logAuditLogRead({
        actingUserId: user.id,
        tableName: 'clients',
        recordId: undefined,
        ipAddress: extractClientIp(request),
        details: { num_records: clientsData.length },
      });
    }
    const result: ClientWithId[] = (clientsData || []).map((record: any) => ({
      id: record.id,
      fullName: record.full_name,
      email: record.email || '',
      phone: record.phone || '',
      createdAt: record.created_at,
      demo: record.demo || false,
    }));
    return NextResponse.json(result);
  } catch (error) {
    logger.error({ userId: user?.id, error }, 'Unhandled error in GET /api/clients');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}, { auth: true }); 