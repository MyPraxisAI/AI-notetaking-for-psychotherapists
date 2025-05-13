import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Create an accounts API instance
 * @param client Supabase client
 * @returns Accounts API methods
 */
export function createAccountsApi(client: SupabaseClient) {
  /**
   * Get the current account ID
   * @returns The ID of the current user's personal account
   */
  async function getCurrentAccountId(): Promise<string> {
    const { data, error } = await client
      .from('user_account_workspace')
      .select('id')
      .single();

    if (error) {
      throw error;
    }

    return data.id;
  }

  // Return the API methods
  return {
    getCurrentAccountId
  };
}
