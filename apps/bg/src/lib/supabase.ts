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

// Create a regular client with anon key (limited permissions)
const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey);

// Create an admin client with service role key (full access)
let supabaseAdmin: SupabaseClient | null = null;
if (supabaseServiceRoleKey) {
  supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);
}

/**
 * Get the appropriate Supabase client
 * @param useAdmin - Whether to use the admin client with service role key
 * @returns Supabase client
 * @throws Error if admin client is requested but not available
 */
export function getSupabaseClient(useAdmin = false): SupabaseClient {
  if (useAdmin) {
    if (!supabaseAdmin) {
      throw new Error('Supabase admin client not available. SUPABASE_SERVICE_ROLE_KEY environment variable is required for admin operations.');
    }
    return supabaseAdmin;
  }
  
  return supabase;
}

/**
 * Set the user session for the Supabase client
 * @param client - The Supabase client
 * @param userId - The user ID to set as the session user
 * @returns Promise that resolves to void
 */
export async function setSupabaseUser(client: SupabaseClient, userId: string): Promise<void> {
  try {
    // Use the auth.setSession method to set the user context
    // This is using the service role to impersonate a user
    await client.auth.setSession({
      access_token: userId,
      refresh_token: '',
    });
    console.log(`Set Supabase user session to user ID: ${userId}`);
  } catch (error) {
    console.error('Error setting Supabase user session:', error);
    throw error; // Re-throw the error to be handled by the caller
  }
}

/**
 * Reset the Supabase user session to anonymous
 * @param client - The Supabase client
 * @returns Promise that resolves to void
 */
export async function resetSupabaseUser(client: SupabaseClient): Promise<void> {
  try {
    // Sign out to reset the session
    await client.auth.signOut();
    console.log('Reset Supabase user session to anonymous');
  } catch (error) {
    console.error('Error resetting Supabase user session:', error);
    // Don't throw here as this is a cleanup operation
  }
}

/**
 * Initialize Supabase with configuration
 * @param config - Supabase configuration
 * @returns Supabase client
 */
export function initializeSupabase(config: SupabaseConfig): SupabaseClient {
  return createClient(config.url, config.key);
}
