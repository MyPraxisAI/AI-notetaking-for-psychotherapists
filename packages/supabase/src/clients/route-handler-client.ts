import 'server-only';

import { cookies } from 'next/headers';

import { createClient } from '@supabase/supabase-js';

import type { CookieOptions } from '@supabase/ssr';
import { createServerClient } from '@supabase/ssr';

import { Database } from '../database.types';
import {
  getServiceRoleKey,
  warnServiceRoleKeyUsage,
} from '../get-service-role-key';
import { getSupabaseClientKeys } from '../get-supabase-client-keys';

const serviceRoleKey = getServiceRoleKey();
const keys = getSupabaseClientKeys();

/**
 * @name getSupabaseRouteHandlerClient
 * @deprecated Use `getSupabaseServerClient` instead.
 * @description Get a Supabase client for use in the Route Handler Routes
 */
export function getSupabaseRouteHandlerClient<GenericSchema = Database>(
  params = {
    admin: false,
  },
) {
  if (params.admin) {
    warnServiceRoleKeyUsage();

    return createClient<GenericSchema>(keys.url, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
  }

  return createServerClient<GenericSchema>(keys.url, keys.anonKey, {
    cookies: getCookiesStrategy(),
  });
}

function getCookiesStrategy() {
  return {
    set: async (name: string, value: string, options: CookieOptions) => {
      const cookieStore = await cookies();

      cookieStore.set({ name, value, ...options });
    },
    get: async (name: string) => {
      const cookieStore = await cookies();

      return cookieStore.get(name)?.value;
    },
    remove: async (name: string, options: CookieOptions) => {
      const cookieStore = await cookies();

      cookieStore.set({ name, value: '', ...options });
    },
  };
}
