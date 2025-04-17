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
    
    // Ensure we always return a string, not null
    const language = preferences?.language;
    return typeof language === 'string' ? language : 'en';
  } catch (error) {
    console.error('Error getting user language:', error);
    return 'en'; // Default to English on error
  }
}
