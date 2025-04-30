'use server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { SupabaseClient } from '@supabase/supabase-js';
import { getLogger } from '@kit/shared/logger';

// Initialize logger
const logger = await getLogger();

// Type assertion to allow access to custom tables
type CustomClient = SupabaseClient & {
  from: (table: string) => ReturnType<SupabaseClient['from']>;
};

/**
 * Get the personal account for a user
 * @param userId The user ID to get the personal account for
 * @returns The personal account ID or null if not found
 */
export async function getUserPersonalAccount(userId: string): Promise<string | null> {
  try {
    const client = getSupabaseServerClient() as CustomClient;
    
    // Get the user's personal account
    const { data: account, error } = await client
      .from('accounts')
      .select('id')
      .eq('primary_owner_user_id', userId)
      .eq('is_personal_account', true)
      .single();
    
    if (error) {
      logger.error({ name: 'get-user-personal-account' }, 'Error fetching personal account', { 
        error, 
        userId 
      });
      return null;
    }
    
    return account?.id || null;
  } catch (err) {
    logger.error({ name: 'get-user-personal-account' }, 'Unexpected error getting personal account', { 
      error: err, 
      userId 
    });
    return null;
  }
}

/**
 * Get any account the user has access to (personal or team)
 * @param userId The user ID to get accounts for
 * @returns The first account ID the user has access to, or null if none found
 */
export async function getUserAnyAccount(userId: string): Promise<string | null> {
  try {
    // First try to get personal account
    const personalAccountId = await getUserPersonalAccount(userId);
    if (personalAccountId) {
      return personalAccountId;
    }
    
    // If no personal account, check for any account the user is a member of
    const client = getSupabaseServerClient() as CustomClient;
    
    // Get accounts the user is a member of
    const { data: memberships, error } = await client
      .from('memberships')
      .select('account_id')
      .eq('user_id', userId)
      .limit(1);
    
    if (error || !memberships?.length) {
      logger.error({ name: 'get-user-any-account' }, 'Error fetching account memberships', { 
        error, 
        userId 
      });
      return null;
    }
    
    return memberships[0]?.account_id || null;
  } catch (err) {
    logger.error({ name: 'get-user-any-account' }, 'Unexpected error getting any account', { 
      error: err, 
      userId 
    });
    return null;
  }
}
