import 'server-only';

import { type NextRequest, NextResponse } from 'next/server';

import { createServerClient } from '@supabase/ssr';

import { Database } from '../database.types';
import { getSupabaseClientKeys } from '../get-supabase-client-keys';

/**
 * Creates a middleware client for Supabase.
 *
 * @param {NextRequest} request - The Next.js request object.
 * @param {NextResponse} response - The Next.js response object.
 */
export function createMiddlewareClient<GenericSchema = Database>(
  request: NextRequest,
  response: NextResponse,
) {
  const keys = getSupabaseClientKeys();

  return createServerClient<GenericSchema>(keys.url, keys.anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        try {
          // Only set cookies on the response object, not on the request
          // This fixes the "Cookies can only be modified in a Server Action or Route Handler" error
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        } catch (error) {
          // Log the error but continue execution
          console.error('Error setting cookies in middleware:', error);
        }
      },
    },
  });
}
