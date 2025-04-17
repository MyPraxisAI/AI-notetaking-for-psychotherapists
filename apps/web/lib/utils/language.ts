import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { createAccountsApi } from '@kit/accounts/api';


/**
 * Get the user's preferred language from their preferences
 * Falls back to 'en' if no preference is found
 */
export async function getUserLanguage(): Promise<string> {
  try {
    const client = getSupabaseServerClient();
    const api = createAccountsApi(client);
    
    // Get the user's workspace using the accounts API
    const workspace = await api.getAccountWorkspace();
    
    if (!workspace) {
      return 'en'; // Default to English if no workspace is found
    }
    
    // Get the user's preferences using the workspace ID
    const { data: preferences } = await client
      .from('user_preferences')
      .select('language')
      .eq('account_id', workspace.id)
      .single();
    
    // Check if we have preferences and a language value
    if (preferences && typeof preferences.language === 'string') {
      return preferences.language;
    }
    
    // Default to English if no language preference is found
    return 'en';
  } catch (error) {
    console.error('Error getting user language:', error);
    return 'en'; // Default to English on error
  }
}
