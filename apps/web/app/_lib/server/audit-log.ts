import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { createAccountsApi } from '@kit/web-bg-common';
import { getLogger } from '@kit/shared/logger';

interface LogAuditReadParams {
  actingUserId: string;
  accountId?: string;
  tableName: string;
  recordId?: string;
  ipAddress?: string;
  accessReason?: string;
  details?: any;
  application?: string;
}

export async function logAuditLogRead({
  actingUserId,
  tableName,
  recordId,
  ipAddress,
  accessReason,
  details,
  accountId = undefined,
  application = 'web',
}: LogAuditReadParams) {
  const logger = await getLogger();
  const adminClient = getSupabaseServerAdminClient();

  if (!accountId) {
    const accountsApi = createAccountsApi(adminClient);
    accountId = await accountsApi.getCurrentAccountId();
  }

  const { error } = await adminClient.from('audit_log').insert([
    {
      acting_user_id: actingUserId,
      account_id: accountId,
      action_type: 'READ',
      table_name: tableName,
      record_id: recordId ?? null,
      ip_address: ipAddress ?? null,
      phi_accessed: true,
      access_reason: accessReason,
      details: details ?? null,
      application: application ?? null,
    },
  ]);
  if (error) {
    logger.error('Failed to log audit_log read:', error);
  }
}

export function extractClientIp(request: Request): string | undefined {
  return (
    request.headers.get('x-forwarded-for') ||
    request.headers.get('x-real-ip') ||
    undefined
  );
} 