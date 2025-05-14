import { SupabaseClient } from '@supabase/supabase-js';
import { AsyncLocalStorage } from 'async_hooks';

// Define the type for our context store
type ContextStore = Map<string, string | null>;


// Create a singleton AsyncLocalStorage instance to store context
const contextStorage = new AsyncLocalStorage<ContextStore>();

// Context keys
const ACCOUNT_ID_KEY = 'accountId';

/**
 * Execute a function with a specific account ID context
 * This sets the account ID in AsyncLocalStorage for the duration of the function execution
 * @param accountId The account ID to set as the current context
 * @param fn The function to execute within this context
 * @returns The result of the function execution
 */
export async function withCurrentAccountId<T>(accountId: string, fn: () => Promise<T>): Promise<T> {
  return contextStorage.run(new Map([[ACCOUNT_ID_KEY, accountId]]), fn);
}

/**
 * Get the current account ID from the AsyncLocalStorage context
 * @returns The account ID from the current context, or null if not available
 */
export function getCurrentAccountIdFromContext(): string | null {
  const store = contextStorage.getStore();
  if (store && store.has(ACCOUNT_ID_KEY)) {
    return store.get(ACCOUNT_ID_KEY) as string;
  }
  return null;
}

/**
 * Create an accounts API instance
 * @param client Supabase client
 * @returns Accounts API methods
 */
export function createAccountsApi(client: SupabaseClient) {
  /**
   * Get the current account ID
   * First checks if an account ID is available in the AsyncLocalStorage context
   * Falls back to querying the database if no context is available
   * @returns The ID of the current user's personal account
   */
  async function getCurrentAccountId(): Promise<string> {
    // Check if we have an account ID in the AsyncLocalStorage context
    const contextAccountId = getCurrentAccountIdFromContext();
    if (contextAccountId) {
      return contextAccountId;
    }
    
    // If no context is available, fall back to querying the database
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
