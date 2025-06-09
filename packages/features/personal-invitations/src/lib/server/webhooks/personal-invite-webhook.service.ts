// Note: Not using this for now, sending personal invitation emails inline on creation
import { SupabaseClient } from '@supabase/supabase-js';

import { getLogger } from '@kit/shared/logger';
import { Database } from '@kit/supabase/database';

type PersonalInvite = Database['public']['Tables']['personal_invites']['Row'];

/**
 * Creates a service to handle personal invitation webhooks
 */
export function createPersonalInviteWebhookService(
  client: SupabaseClient<Database>,
) {
  return new PersonalInviteWebhookService(client);
}

/**
 * Service to handle personal invitation webhooks
 */
class PersonalInviteWebhookService {
  private namespace = 'personal.invitations.webhook';

  constructor(private readonly adminClient: SupabaseClient<Database>) {}

  /**
   * Handles the webhook event for personal invitation creation
   */
  async handlePersonalInviteCreatedWebhook(invitation: PersonalInvite) {
    return this.dispatchInvitationEmail(invitation);
  }

  private async dispatchInvitationEmail(invitation: PersonalInvite) {
    const logger = await getLogger();

    logger.info(
      { invitation, name: this.namespace },
      'Handling personal invitation webhook event...'
    );

    // Import the email service
    try {
      // Create the email service
      const { createPersonalInviteEmailService } = await import('../personal-invite-email.service');
      const emailService = createPersonalInviteEmailService(this.adminClient);
      
      // Send the invitation email
      const result = await emailService.sendInvitationEmail(invitation);
      
      logger.info(
        { invitation: invitation.id, name: this.namespace },
        'Personal invitation email dispatch completed'
      );
      
      return result;
    } catch (error) {
      console.error(error);
      logger.warn(
        { error, invitation: invitation.id, name: this.namespace },
        'Failed to send personal invitation email'
      );

      return {
        error,
        success: false,
      };
    }
  }

  // Delegate all email sending logic to the email service
}
