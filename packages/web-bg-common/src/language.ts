import { SupabaseClient } from '@supabase/supabase-js';
import { createAccountsApi } from './db/account-api';

/**
 * Map of language codes to full language names
 */
const LANGUAGE_NAMES: Record<string, string> = {
  'en': 'English',
  'ru': 'Russian',
  // Add more languages as needed
};

/**
 * Get the user's raw language preference from their preferences
 * Returns null if no explicit preference is found, allowing browser detection to be used
 * @param client Supabase client
 */
export async function getUserLanguageRaw(client: SupabaseClient): Promise<string | null> {
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
    
    // Return the language preference (which may be null)
    // This allows the i18n system to fall back to browser detection
    return preferences?.language || null;
  } catch (error) {
    console.error('Error getting user language:', error);
    return null; // Return null to allow browser detection in case of error
  }
}

/**
 * Get the user's preferred language from their preferences
 * Falls back to 'en' if no preference is found
 * @param client Supabase client
 */
export async function getUserLanguage(client: SupabaseClient): Promise<string> {
  const language = await getUserLanguageRaw(client);
  return language || 'en'; // Default to English if no preference is found
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
