// No need to import SupabaseClient as we're just extending the module

// Extend the SupabaseClient rpc methods with our custom function
declare module '@supabase/supabase-js' {
  interface SupabaseClient {
    rpc(
      fn: 'accept_personal_invite_by_token',
      params: {
        token_param: string;
        account_id_param: string;
      }
    ): Promise<{ data: string; error: Error | null }>;
  }
}
