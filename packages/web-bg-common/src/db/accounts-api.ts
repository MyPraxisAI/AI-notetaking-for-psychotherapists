import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Create an accounts API instance
 * @param client Supabase client
 * @returns Accounts API methods
 */
export function createAccountsApi(client: SupabaseClient) {
  /**
   * Get the account workspace data
   * @returns The account workspace data for the current user
   */
  async function getAccountWorkspace() {
    const { data, error } = await client
      .from('user_account_workspace')
      .select(`*`)
      .single();

    if (error) {
      throw error;
    }

    return data;
  }

  // Return the API methods
  return {
    getAccountWorkspace
  };
}
