import { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

import { getLogger, type Logger } from '@kit/shared/logger';
import type { Database } from '@kit/supabase/database';

type PersonalInvite = Database['public']['Tables']['personal_invites']['Row'];

// Environment variables
const signUpPath = '/auth/sign-up';
const siteURL = process.env.NEXT_PUBLIC_SITE_URL;
const productName = process.env.NEXT_PUBLIC_PRODUCT_NAME ?? '';
const emailSender = process.env.EMAIL_SENDER;

const env = z
  .object({
    signUpPath: z.string().min(1),
    siteURL: z.string().min(1),
    productName: z.string(),
    emailSender: z.string().email(),
  })
  .parse({
    signUpPath,
    siteURL,
    productName,
    emailSender,
  });

export function createPersonalInviteEmailService(
  client: SupabaseClient<Database>
) {
  let logger: Logger;
  // Initialize logger
  const initLogger = async () => {
    if (!logger) {
      logger = await getLogger();
    }
    return logger;
  };

  // Helper function to generate the invitation link
  const getInvitationLink = (token: string) => {
    const searchParams = new URLSearchParams({
      personal_invite_token: token,
    }).toString();

    const href = new URL(env.signUpPath, env.siteURL).href;

    return `${href}?${searchParams}`;
  };

  return {
    /**
     * Sends an email invitation to the invited user
     */
    async sendInvitationEmail(invite: PersonalInvite) {
      const ctx = {
        name: 'send-invitation-email',
        email: invite.email,
        inviteId: invite.id
      };
      
      const log = await initLogger();
      log.info(ctx, 'Preparing personal invitation email');
      
      try {
        // Get the inviter's information
        const inviter = await client
          .from('accounts')
          .select('email, name')
          .eq('id', invite.invited_by_account_id)
          .single();

        if (inviter.error) {
          log.error(
            {
              error: inviter.error,
              ...ctx,
            },
            'Failed to fetch inviter details'
          );

          throw inviter.error;
        }

        log.info(ctx, 'Got inviter details, sending email...');

        // Import email rendering and mailing components
        const { renderPersonalInviteEmail } = await import('@kit/email-templates');
        const { getMailer } = await import('@kit/mailers');

        const mailer = await getMailer();
        const link = getInvitationLink(invite.token);

        // Render the email with proper localization
        const { html, subject } = await renderPersonalInviteEmail({
          link,
          invitedUserEmail: invite.email,
          inviterName: inviter.data.name ?? undefined,
          inviterEmail: inviter.data.email ?? '',
          productName: env.productName,
          language: invite.language || 'en', // Use invite language or fallback to English
        });

        // Send the email
        await mailer
          .sendEmail({
            from: env.emailSender,
            to: invite.email,
            subject,
            html,
          })
          .then(() => {
            log.info(ctx, 'Personal invitation email successfully sent!');
          })
          .catch((error: Error) => {
            console.error(error);
            log.error({ error, ...ctx }, 'Failed to send personal invitation email');
            throw error;
          });
        
        return { success: true };
      } catch (error) {
        log.error({ ...ctx, error }, 'Error sending invitation email');
        throw error;
      }
    },
  };
}
