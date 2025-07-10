import { insertAuditLog } from './insert-audit-log';
import { NULL_UUID } from './util';

export async function logImpersonateUser({ actingUserId, recordId, ipAddress, accessReason }: {
  actingUserId: string;
  recordId: string;
  ipAddress: string | undefined;
  accessReason: string;
}) {
  await insertAuditLog({
    acting_user_id: actingUserId,
    record_id: recordId,
    ip_address: ipAddress ?? null,
    access_reason: accessReason,
    account_id: NULL_UUID,
    table_name: 'auth.users',
    application: 'web',
    action_type: 'IMPERSONATE',
  });
} 