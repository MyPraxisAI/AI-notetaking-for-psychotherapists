import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { SupabaseConfig } from '../types';
import { getBackgroundLogger, createLoggerContext } from './logger';

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
    const logger = await getBackgroundLogger();
    logger.error(createLoggerContext('supabase', { error: testError }), 'Error testing admin client');
    throw new Error(`Failed to test admin client: ${testError.message}`);
  } else if (testData && testData.length > 0) {
    const logger = await getBackgroundLogger();
    logger.error(createLoggerContext('supabase', { rows: testData.length }), `Unexpected rows returned for admin client: ${testData.length}, expected 0`);
    throw new Error(`Failed to verify admin client: expected 0 rows, got ${testData.length}`);
  }
  
  console.log('Successfully created admin client');
  
  // Cache the admin client for future use
  adminClient = client;
  return client;
}

