import { AuthUsersWebhookPayloadSchema, AuditLogInsert } from './types';
import { insertAuditLog } from './insert-audit-log';
import { create } from 'jsondiffpatch';

const jsondiffpatch = create();

function computeDelta(record: Record<string, any> | null, oldRecord: Record<string, any> | null) {
  record ||= {};
  oldRecord ||= {};
  const patch = jsondiffpatch.diff(oldRecord, record);
  if (!patch) return null;
  return patch;
}

export async function handleAuthUsersDatabaseWebhook(body: unknown) {
    // Validate payload
    const parsed = AuthUsersWebhookPayloadSchema.safeParse(body);
    if (!parsed.success) {
        throw new Error('Invalid webhook payload');
    }
    const payload = parsed.data;

    // Determine action_type
    let action_type: AuditLogInsert['action_type'];
    switch (payload.type) {
        case 'INSERT':
        action_type = 'CREATE';
        break;
        case 'UPDATE':
        action_type = 'UPDATE';
        break;
        case 'DELETE':
        action_type = 'DELETE';
        break;
        default:
        action_type = 'UPDATE';
    }

    const delta = computeDelta(payload.record, payload.old_record);

    // Compose audit log entry
    const entry: AuditLogInsert = {
        acting_user_id: payload.record?.id || '00000000-0000-0000-0000-000000000000',
        account_id: '00000000-0000-0000-0000-000000000000',
        action_type,
        table_name: 'auth.users',
        record_id: payload.record?.id || null,
        ip_address: null, // Not available from webhook
        phi_accessed: false, // This is not PHI data right now, it's needed to establish the WHO later on of who did access
        details: null,
        changes: delta ?? null,
        application: 'database-auth',
    };

    await insertAuditLog(entry);
    return { success: true };
} 