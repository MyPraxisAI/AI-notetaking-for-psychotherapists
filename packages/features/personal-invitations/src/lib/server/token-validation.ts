'use server';

import { z } from 'zod';
import { enhanceAction } from '@kit/next/actions';
import { getSupabaseAnonymousClient } from '@kit/supabase/server-client';
import { getLogger } from '@kit/shared/logger';

const TokenSchema = z.object({
  token: z.string().min(1),
});

/**
 * Simple helper to check if a personal invitation token is valid without requiring authentication
 * This is specifically designed to be used in the sign-up flow
 */
export const isPersonalInviteTokenValidAction = enhanceAction(
  async function (inputData) {
    // Specialized client for accessing anonymous schema functions
    const anonymousClient = getSupabaseAnonymousClient();
    const logger = await getLogger();
    const ctx = {
      name: 'is-personal-invite-token-valid',
      token: '***'  // Redacted for security
    };

    try {
      logger.info(ctx, 'Checking personal invitation token validity');
      
      // Call the function to validate the token using the anonymous schema client
      // No need for schema prefix since the client is configured for anonymous schema
      const { data, error } = await anonymousClient
        .rpc('get_invite_by_token', { token_param: inputData.token })
        .maybeSingle();

      if (error) {
        logger.info({ ...ctx, error: error.message }, 'Invalid personal invitation token');
        return { 
          valid: false,
          email: null,
          language: null
        };
      }
      
      // Return the validation response
      return {
        email: data?.email || null,
        valid: !!data?.valid,
        language: data?.language || null,
      };
    } catch (error) {
      logger.error({ ...ctx, error }, 'Error checking personal invitation token validity');
      return { valid: false, email: null, language: null };
    }
  },
  {
    // No authentication required, this is used from sign-up flow before authentication
    auth: false,
    schema: TokenSchema,
  }
);
