import { SupabaseClient } from '@supabase/supabase-js';

import { checkRequiresMultiFactorAuthentication } from '@kit/supabase/check-requires-mfa';
import { Database } from '@kit/supabase/database';

/**
 * @name isSuperAdmin
 * @description Check if the current user is a super admin.
 * @param client
 */
export async function isSuperAdmin(client: SupabaseClient<Database>) {
  const { data, error } = await client.auth.getUser();

  if (error) {
    throw error;
  }

  if (!data.user) {
    return false;
  }

  const requiresMultiFactorAuthentication =
    await checkRequiresMultiFactorAuthentication(client);

  // If user requires multi-factor authentication, deny access.
  if (requiresMultiFactorAuthentication) {
    return false;
  }

  const appMetadata = data.user.app_metadata;

  return appMetadata?.role === 'super-admin';
}
