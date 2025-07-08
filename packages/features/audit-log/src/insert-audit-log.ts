import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import type { Database } from '@kit/supabase/database';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { AuditLogInsert } from './types';

// Accept an optional Supabase client
export async function insertAuditLog(
  entry: AuditLogInsert,
  client?: SupabaseClient<Database>
) {
  const supabase = client ?? getSupabaseServerAdminClient();
  const { error } = await supabase.from('audit_log').insert([entry]);
  if (error) throw error;
} 