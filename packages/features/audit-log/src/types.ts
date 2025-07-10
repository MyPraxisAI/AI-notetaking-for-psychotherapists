import { z } from 'zod';
import type { Database } from '@kit/supabase/database';

// Use generated types for audit_log
export type AuditLogRow = Database['public']['Tables']['audit_log']['Row'];
export type AuditLogInsert = Database['public']['Tables']['audit_log']['Insert'];

// Supabase webhook payload for auth.users
export const AuthUsersWebhookPayloadSchema = z.object({
  type: z.enum(['INSERT', 'UPDATE', 'DELETE']),
  table: z.literal('users'),
  schema: z.literal('auth'),
  record: z.record(z.any()).nullable(),
  old_record: z.record(z.any()).nullable(),
});

export type AuthUsersWebhookPayload = z.infer<typeof AuthUsersWebhookPayloadSchema>; 