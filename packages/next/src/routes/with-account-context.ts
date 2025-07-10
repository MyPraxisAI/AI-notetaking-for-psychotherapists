import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { User } from '@supabase/supabase-js';
import { createAccountsApi, withCurrentAccountId, NoAccountIdError } from '@kit/web-bg-common';
import { getLogger } from '@kit/shared/logger';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { enhanceRouteHandler } from './index';
import { z } from 'zod';

/**
 * Enhances a route handler with account context functionality.
 * This is a wrapper around enhanceRouteHandler that also sets up account context.
 * 
 * @example
 * ```tsx
 * export const GET = enhanceRouteHandlerWithAccountContext(
 *   async ({ request, user, accountId }) => {
 *     // accountId is the current account ID (if available)
 *     return NextResponse.json({ success: true });
 *   }
 * );
 * ```
 */
export function enhanceRouteHandlerWithAccountContext<
  Body,
  Params extends {
    auth?: boolean;
    captcha?: boolean;
    schema?: z.ZodType<Body, z.ZodTypeDef>;
  }
>(
  handler: (params: {
    request: NextRequest;
    user: Params['auth'] extends false ? undefined : User;
    body: Params['schema'] extends z.ZodType ? z.infer<Params['schema']> : undefined;
    params: Record<string, string>;
    accountId: string | null;
  }) => Promise<NextResponse | Response> | NextResponse | Response,
  params?: Params
) {
  return enhanceRouteHandler(
    async ({ request, user, body, params: routeParams }) => {
      const logger = await getLogger();
      const client = getSupabaseServerClient();
      const accountsApi = createAccountsApi(client);
      
      const ctx = {
        name: 'route-handler-with-account-context',
        userId: user?.id,
        path: request.nextUrl.pathname,
      };
      
      let accountId: string | null = null;
      
      try {
        accountId = await accountsApi.getCurrentAccountId();
        logger.info({ ...ctx, accountId }, 'Handling request in account context');
      } catch (error) {
        if (error instanceof NoAccountIdError) {
          logger.info({ ...ctx, error }, 'Request outside of account context');
          // Continue with null accountId
        } else {
          logger.error({ ...ctx, error }, 'Failed to get account context');
          // Continue with null accountId, but log the error
        }
      }
      
      // Run the handler with the account context
      return withCurrentAccountId(accountId, async () => {
        return handler({
          request,
          user,
          body,
          params: routeParams,
          accountId,
        });
      });
    },
    params
  );
}

/**
 * Similar to enhanceRouteHandlerWithAccountContext but requires an account context to be available.
 * If no account context is available, returns a 400 Bad Request response.
 */
export function enhanceRouteHandlerRequiringAccountContext<
  Body,
  Params extends {
    auth?: boolean;
    captcha?: boolean;
    schema?: z.ZodType<Body, z.ZodTypeDef>;
  }
>(
  handler: (params: {
    request: NextRequest;
    user: Params['auth'] extends false ? undefined : User;
    body: Params['schema'] extends z.ZodType ? z.infer<Params['schema']> : undefined;
    params: Record<string, string>;
    accountId: string; // Notice: this is not nullable!
  }) => Promise<NextResponse | Response> | NextResponse | Response,
  params?: Params
) {
  return enhanceRouteHandlerWithAccountContext(
    async ({ request, user, body, params: routeParams, accountId }) => {
      // If no account context is available, return a 400 Bad Request response
      if (!accountId) {
        return NextResponse.json(
          { error: 'No account context available' },
          { status: 400 }
        );
      }
      
      return handler({
        request,
        user,
        body,
        params: routeParams,
        accountId,
      });
    },
    params
  );
}
