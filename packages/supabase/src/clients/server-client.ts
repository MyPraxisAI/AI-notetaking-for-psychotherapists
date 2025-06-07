import 'server-only';

import { cookies } from 'next/headers';

import { createServerClient } from '@supabase/ssr';

import { Database } from '../database.types';
import { getSupabaseClientKeys } from '../get-supabase-client-keys';

/**
 * @name getSupabaseServerClient
 * @description Creates a Supabase client for use in the Server.
 */
export function getSupabaseServerClient<GenericSchema = Database>() {
  const keys = getSupabaseClientKeys();

  return createServerClient<GenericSchema>(keys.url, keys.anonKey, {
    cookies: {
      async getAll() {
        const cookieStore = await cookies();

        return cookieStore.getAll();
      },
      async setAll(cookiesToSet) {
        const cookieStore = await cookies();

        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // The `setAll` method was called from a Server Component.
          // This can be ignored if you have middleware refreshing
          // user sessions.
        }
      },
    },
  });
}

/**
 * Get a Supabase client specifically for working with the anonymous schema functions.
 * This is useful for functions that need to be called by unauthenticated users.
 * 
 * @returns A typed Supabase client that works with anonymous schema functions
 */
export function getSupabaseAnonymousClient() {
  const keys = getSupabaseClientKeys();

  return createServerClient<Database, 'anonymous'>(keys.url, keys.anonKey, {
    cookies: {
      async getAll() {
        const cookieStore = await cookies();

        return cookieStore.getAll();
      },
      async setAll(cookiesToSet) {
        const cookieStore = await cookies();

        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // The `setAll` method was called from a Server Component.
          // This can be ignored if you have middleware refreshing
          // user sessions.
        }
      },
    },
    // Explicitly set the schema for all requests from this client
    db: {
      schema: 'anonymous',
    },
  });
}
