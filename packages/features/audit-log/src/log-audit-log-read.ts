import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { createAccountsApi } from '@kit/web-bg-common';
import { getLogger } from '@kit/shared/logger';
import { insertAuditLog } from './insert-audit-log';

export interface LogAuditReadParams {
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

  try {
    await insertAuditLog({
      acting_user_id: actingUserId,
      account_id: accountId!,
      action_type: 'READ',
      table_name: tableName,
      record_id: recordId ?? null,
      ip_address: ipAddress ?? null,
      phi_accessed: true,
      access_reason: accessReason,
      details: details ?? null,
      application: application ?? null,
    }, adminClient);
  } catch (error) {
    logger.error('Failed to log audit_log read:', error);
  }
} 