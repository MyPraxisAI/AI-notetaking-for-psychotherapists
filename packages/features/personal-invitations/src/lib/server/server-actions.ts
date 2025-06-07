'use server';

import { z } from 'zod';
import { randomUUID } from 'crypto';
import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient, SupabaseClient } from '@kit/supabase/server-client';
import { getLogger, Logger } from '@kit/shared/logger';
import { createAccountsApi } from '@kit/web-bg-common';
import { Database } from '@kit/supabase/database.types';

import {
  CreatePersonalInviteSchema,
  RevokePersonalInviteSchema,
  AcceptPersonalInviteSchema,
  ResendPersonalInviteSchema,
  PersonalInvite
} from './schemas/personal-invitations.schema';


/**
 * Helper function to send a personal invitation email
 * @param invite The invitation data
 * @param client Supabase client
 * @param logger Logger instance
 * @param logContext Context for logging
 * @returns Promise resolving to success status
 */
async function sendPersonalInvitationEmail(
  invite: PersonalInvite,
  client: SupabaseClient<Database>,
  logger: Logger,
  logContext: Record<string, any>
): Promise<boolean> {
  try {
    // Dynamically import the email service to prevent bundling with client code
    const { createPersonalInviteEmailService } = await import('./personal-invite-email.service');
    const emailService = createPersonalInviteEmailService(client);
    
    // Send the email with the invite data
    await emailService.sendInvitationEmail({
      ...invite,
      invited_account_id: invite.invited_account_id || null,
      status: invite.status || 'pending'
    });
    
    logger.info({ ...logContext, inviteId: invite.id }, 'Personal invitation email sent successfully');
    return true;
  } catch (emailError) {
    logger.error({ ...logContext, error: emailError }, 'Failed to send personal invitation email');
    throw emailError;
  }
}

/**
 * Create a new personal invitation for a user to join the platform
 */
export const createPersonalInviteAction = enhanceAction(
  async function (data, user) {
    const client = getSupabaseServerClient();
    const logger = await getLogger();
    const ctx = {
      name: 'create-personal-invite',
      email: data.email,
      userId: user.id
    };

    try {
      logger.info(ctx, 'Creating personal invitation');

      // Get the current account ID
      const accountsApi = createAccountsApi(client);
      const accountId = await accountsApi.getCurrentAccountId();
      
      // Generate a secure token for the invitation using UUID
      const token = randomUUID();
      
      // Calculate expiration date
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + data.expiresInDays);

      // Create the invitation with the account ID as invited_by_account_id
      const { data: invite, error } = await client
        .from('personal_invites')
        .insert({
          email: data.email,
          token,
          invited_by_account_id: accountId,
          expires_at: expiresAt.toISOString(),
          language: data.language
        })
        .select()
        .single();

      if (error) {
        logger.error({ ...ctx, error }, 'Failed to create personal invitation');
        throw error;
      }

      logger.info({ ...ctx, inviteId: invite.id }, 'Personal invitation created successfully');
      
      // Send invitation email
      try {
        await sendPersonalInvitationEmail(invite, client, logger, ctx);
        logger.info({ ...ctx, inviteId: invite.id }, 'Personal invitation email dispatched');
      } catch (emailError) {
        // Log but don't fail the action if email sending fails
        logger.error({ ...ctx, error: emailError }, 'Failed to send personal invitation email');
      }
      
      return { 
        success: true, 
        invite: {
          ...invite,
          // Don't return the token to the client for security reasons
          token: undefined
        } 
      };
    } catch (error) {
      logger.error({ ...ctx, error }, 'Error creating personal invitation');
      throw error;
    }
  },
  {
    auth: true,
    schema: CreatePersonalInviteSchema,
  }
);

/**
 * Get personal invitations list for administrative purposes
 */
export const listPersonalInvitesAction = enhanceAction(
  async function (_, user) {
    const client = getSupabaseServerClient();
    const logger = await getLogger();
    const ctx = {
      name: 'list-personal-invites',
      userId: user.id
    };

    try {
      logger.info(ctx, 'Listing personal invitations');

      // Note: RLS policies will limit results based on user role and ownership
      const { data: invites, error } = await client
        .from('personal_invites')
        .select(`
          id,
          email,
          created_at,
          expires_at,
          invited_by_account_id,
          accepted_at,
          invited_account_id,
          status
        `)
        .order('created_at', { ascending: false });

      if (error) {
        logger.error({ ...ctx, error }, 'Failed to list personal invitations');
        throw error;
      }

      return { 
        success: true, 
        invites 
      };
    } catch (error) {
      logger.error({ ...ctx, error }, 'Error listing personal invitations');
      throw error;
    }
  },
  {
    auth: true,
    schema: z.object({}), // No input needed for listing
  }
);

/**
 * Revoke a personal invitation
 */
export const revokePersonalInviteAction = enhanceAction(
  async function (data, user) {
    const client = getSupabaseServerClient();
    const logger = await getLogger();
    const ctx = {
      name: 'revoke-personal-invite',
      inviteId: data.id,
      userId: user.id
    };

    try {
      logger.info(ctx, 'Revoking personal invitation');

      // Update the invitation status to revoked
      const { error } = await client
        .from('personal_invites')
        .update({
          status: 'revoked'
        })
        .eq('id', data.id);

      if (error) {
        logger.error({ ...ctx, error }, 'Failed to revoke personal invitation');
        throw error;
      }

      logger.info(ctx, 'Personal invitation revoked successfully');
      return { success: true };
    } catch (error) {
      logger.error({ ...ctx, error }, 'Error revoking personal invitation');
      throw error;
    }
  },
  {
    auth: true,
    schema: RevokePersonalInviteSchema,
  }
);

/**
 * Resend a personal invitation email
 */
export const resendPersonalInviteAction = enhanceAction(
  async function (data, user) {
    const client = getSupabaseServerClient();
    const logger = await getLogger();
    const ctx = {
      name: 'resend-personal-invite',
      inviteId: data.id,
      userId: user.id
    };

    try {
      logger.info(ctx, 'Resending personal invitation email');

      // Get the invitation data
      const { data: invite, error } = await client
        .from('personal_invites')
        .select('*')
        .eq('id', data.id)
        .single();

      if (error) {
        logger.error({ ...ctx, error }, 'Failed to fetch personal invitation');
        throw error;
      }

      if (invite.status !== 'pending') {
        logger.error({ ...ctx }, 'Cannot resend email for non-pending invitation');
        throw new Error('Cannot resend email for invitation with status: ' + invite.status);
      }

      // Send invitation email
      try {
        await sendPersonalInvitationEmail(invite, client, logger, ctx);
        logger.info({ ...ctx, inviteId: invite.id }, 'Personal invitation email resent successfully');
        return { success: true };
      } catch (emailError) {
        logger.error({ ...ctx, error: emailError }, 'Failed to resend personal invitation email');
        throw emailError;
      }
    } catch (error) {
      logger.error({ ...ctx, error }, 'Error resending personal invitation');
      throw error;
    }
  },
  {
    auth: true,
    schema: ResendPersonalInviteSchema,
  }
);

/**
 * Accept a personal invitation and mark it as accepted
 * NOTE: This action doesn't create the user account - that's handled by the signup flow
 * It only marks the invitation as accepted once the user has successfully signed up
 */
export const acceptPersonalInviteAction = enhanceAction(
  async function (data, user) {
    const client = getSupabaseServerClient();
    const logger = await getLogger();
    const ctx = {
      name: 'accept-personal-invite',
      token: '***',  // Redacted for security
      userId: user.id
    };

    try {
      logger.info(ctx, 'Accepting personal invitation');

      // First verify the invite is valid
      const { data: invite, error: verifyError } = await client
        .rpc('get_invite_by_token', { token_param: data.token })
        .single();

      if (verifyError || !invite) {
        logger.error({ ...ctx, error: verifyError }, 'Failed to verify personal invitation for acceptance');
        return { 
          success: false, 
          message: 'Invalid or expired invitation token'
        };
      }

      // Update the invitation status
      const { error: updateError } = await client
        .from('personal_invites')
        .update({
          status: 'accepted',
          accepted_at: new Date().toISOString(),
          invited_account_id: user.id // Link to the user's personal account
        })
        .eq('token', data.token);

      if (updateError) {
        logger.error({ ...ctx, error: updateError }, 'Failed to update personal invitation status');
        throw updateError;
      }

      logger.info(ctx, 'Personal invitation accepted successfully');
      return { success: true };
    } catch (error) {
      logger.error({ ...ctx, error }, 'Error accepting personal invitation');
      throw error;
    }
  },
  {
    auth: true, // User must be authenticated to accept an invitation
    schema: AcceptPersonalInviteSchema,
  }
);
