import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getLogger } from '@kit/shared-common/logger';
import { logAuditLogRead, extractClientIpFromHeaders } from '@kit/audit-log';
import { enhanceRouteHandler } from '@kit/next/routes';
import { ClientWithId } from '../../../home/(user)/mypraxis/_lib/schemas/client';
import { createAccountsApi } from '@kit/web-bg-common';
import { z } from 'zod';
import { TablesUpdate } from '../../../../lib/database.types';

const ClientUpdateSchema = z.object({
  full_name: z.string().min(1).optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional().or(z.literal('')),
  treatment_plan: z.string().nullable().optional(),
});

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
      treatment_plan: record.treatment_plan ?? null,
    };
    return NextResponse.json(result);
  } catch (error) {
    logger.error({ userId: user?.id, error }, 'Unhandled error in GET /api/clients/[clientId]');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}, { auth: true });

export const PATCH = enhanceRouteHandler(
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
      const body = await request.json();
      const parse = ClientUpdateSchema.safeParse(body);
      if (!parse.success) {
        return NextResponse.json({ error: 'Invalid input', details: parse.error.flatten() }, { status: 400 });
      }
      const updateFields: TablesUpdate<'clients'> = parse.data;
      if (Object.keys(updateFields).length === 0) {
        return NextResponse.json({ error: 'No updatable fields provided' }, { status: 400 });
      }
      // Only update if the client exists and belongs to the account
      const { data: clientData, error: clientError } = await client
        .from('clients')
        .select('id')
        .eq('id', clientId)
        .eq('account_id', accountId)
        .maybeSingle();
      if (clientError) {
        logger.error({ userId: user.id, error: clientError }, 'Error fetching client for update');
        return NextResponse.json({ error: 'Error fetching client' }, { status: 500 });
      }
      if (!clientData) {
        return NextResponse.json({ error: 'Client not found' }, { status: 404 });
      }
      // Perform the update
      const { data: updated, error: updateError } = await client
        .from('clients')
        .update(updateFields)
        .eq('id', clientId)
        .eq('account_id', accountId)
        .select('*')
        .maybeSingle();
      if (updateError) {
        logger.error({ userId: user.id, error: updateError }, 'Error updating client');
        return NextResponse.json({ error: 'Error updating client' }, { status: 500 });
      }
      if (!updated) {
        return NextResponse.json({ error: 'Client not found after update' }, { status: 404 });
      }
      // Optionally log update event here
      return NextResponse.json(updated);
    } catch (error) {
      logger.error({ userId: user?.id, error }, 'Unhandled error in PATCH /api/clients/[clientId]');
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  },
  { auth: true }
); 