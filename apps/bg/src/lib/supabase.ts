import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { SupabaseConfig } from '../types';

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Check if required environment variables are set
if (!supabaseUrl || !supabaseKey) {
  throw new Error('Supabase URL or key not provided. These environment variables are required for the application to function.');
}

// Admin client singleton that can be reused
let adminClient: SupabaseClient | null = null;

/**
 * Get a Supabase admin client with service role privileges
 * This client can be reused across multiple operations
 * 
 * @returns A Supabase client with admin privileges
 * @throws Error if service role key is not available
 */
export async function getSupabaseAdminClient(): Promise<SupabaseClient> {
  // Return the cached admin client if it exists
  if (adminClient) {
    return adminClient;
  }
  
  // Verify we have the necessary environment variables
  if (!supabaseServiceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY environment variable is required for admin operations.');
  }
  
  // Create the admin client
  const client = createClient(supabaseUrl!, supabaseServiceRoleKey!, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
  
  // Test the client to ensure it's working correctly
  // When using service role without user context, we should get 0 rows
  const { data: testData, error: testError } = await client
    .from('user_account_workspace')
    .select('*');
    
  if (testError) {
    console.error('Error testing admin client:', testError);
    throw new Error(`Failed to test admin client: ${testError.message}`);
  } else if (testData && testData.length > 0) {
    console.error(`Unexpected rows returned for admin client: ${testData.length}, expected 0`);
    throw new Error(`Failed to verify admin client: expected 0 rows, got ${testData.length}`);
  }
  
  console.log('Successfully created admin client');
  
  // Cache the admin client for future use
  adminClient = client;
  return client;
}

/**
 * Get a fresh Supabase client for a specific account
 * A new client is created for each call to ensure proper isolation
 * This client uses service role permissions but stores the account ID
 * for use with explicit filtering instead of relying on RLS policies
 * 
 * @param accountId - The account ID to associate with the client
 * @returns A new Supabase client with the account ID attached
 * @throws Error if service role key is not available or if the account doesn't exist
 */
export async function getSupabaseAccountClient(accountId: string): Promise<SupabaseClient> {
  if (!accountId) {
    throw new Error('accountId is required');
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
  }

  // Get the admin client to verify the account exists
  const adminClient = await getSupabaseAdminClient();
  
  // Verify the account exists
  const { data: userData, error: userError } = await adminClient.auth.admin.getUserById(accountId);
  
  if (userError || !userData?.user) {
    console.error('Failed to get user data:', userError);
    throw new Error(`Failed to verify account ${accountId}: ${userError?.message || 'Account not found'}`);
  }
  
  // Verify the account exists in the accounts table
  const { data: accountData, error: accountError } = await adminClient
    .from('accounts')
    .select('id, name')
    .eq('id', accountId)
    .eq('is_personal_account', true)
    .single();
  
  if (accountError || !accountData) {
    console.error('Failed to verify account in database:', accountError);
    throw new Error(`Failed to verify account ${accountId} in database: ${accountError?.message || 'Account not found'}`);
  }
  
  // Create a service role client
  const client = createClient(supabaseUrl!, supabaseServiceRoleKey!, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
  
  // Store the account ID with the client for use in API methods
  (client as any).accountId = accountId;
  
  // Add a helper method to get the current account ID
  (client as any).getCurrentAccountId = () => accountId;
  
  console.log(`Successfully created client for account ${accountId}`);
  
  return client;
}


