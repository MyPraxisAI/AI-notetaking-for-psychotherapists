'use server';

import { z } from 'zod';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { enhanceAction } from '@kit/next/actions';
import { getLogger } from '@kit/shared/logger';

/**
 * Server action to complete a personal invitation by updating the invited_account_id
 */
export const completePersonalInviteAction = enhanceAction(
  async function completePersonalInviteAction(
    data: { token: string; invitedAccountId: string },
    user: { id: string }
  ) {
    const client = getSupabaseServerClient();
    const logger = await getLogger();
    const ctx = {
      name: 'complete-personal-invite',
      userId: user.id,
      accountId: data.invitedAccountId,
      token: data.token,
    };

    logger.info(ctx, 'Processing personal invitation...');

    try {      
      // Update the personal invitation with the user's account ID using the secure function
      const { data: status, error } = await client
        .rpc('accept_personal_invite_by_token', {
          token_param: data.token,
          account_id_param: data.invitedAccountId
        }) as { data: string, error: Error | null };

      if (error) {
        logger.error(ctx, 'Failed to accept personal invitation', { error });
        throw error;
      }

      // Handle different status responses
      switch (status) {
        case 'success':
          logger.info(ctx, 'Personal invitation accepted successfully');
          return { success: true, alreadyCompleted: false };
        case 'already_accepted':
          logger.info(ctx, 'Personal invitation was already accepted');
          return { success: true, alreadyCompleted: true };
        case 'not_found':
          logger.error(ctx, 'Invalid or expired personal invitation token');
          throw new Error('Invalid or expired invitation token');
        case 'failure':
          logger.error(ctx, 'Failed to update personal invitation status');
          throw new Error('Failed to accept invitation');
        default:
          logger.error(ctx, 'Unexpected response from accept_personal_invite_by_token', { status });
          throw new Error('Unexpected error while accepting invitation');
      }
    } catch (error) {
      logger.error(ctx, 'Error completing personal invitation', { error });
      throw error;
    }
  },
  {
    auth: true,
    schema: z.object({
      token: z.string(),
      invitedAccountId: z.string(),
    }),
  }
);
