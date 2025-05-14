import { SupabaseClient } from '@supabase/supabase-js';
import { createAccountsApi } from './db/accounts-api';

/**
 * Map of language codes to full language names
 */
const LANGUAGE_NAMES: Record<string, string> = {
  'en': 'English',
  'ru': 'Russian',
  // Add more languages as needed
};

/**
 * Get the user's preferred language from their preferences
 * Falls back to 'en' if no preference is found
 * @param client Supabase client
 */
export async function getUserLanguage(client: SupabaseClient): Promise<string> {
  try {
    const api = createAccountsApi(client);
    
    // Get the user's account ID using the accounts API
    const accountId = await api.getCurrentAccountId();
    
    // Get the user's preferences using the account ID
    const { data: preferences } = await client
      .from('user_preferences')
      .select('language')
      .eq('account_id', accountId)
      .single();
    
    // Check if we have preferences and a language value
    if (preferences?.language) {
      return preferences.language as string;
    }
    
    // Default to English if no language preference is found
    return 'en';
  } catch (error) {
    console.error('Error getting user language:', error);
    return 'en'; // Default to English in case of error
  }
}

/**
 * Convert language code to full language name
 * @param code Language code (e.g., 'en', 'ru')
 * @returns Full language name (e.g., 'English', 'Russian')
 */
export function getFullLanguageName(code: string | null): string {
  // Default to 'English' if code is null or not found in the map
  if (!code) return 'English';
  return LANGUAGE_NAMES[code] || 'English';
}
