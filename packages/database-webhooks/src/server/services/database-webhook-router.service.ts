import { SupabaseClient } from '@supabase/supabase-js';

import { Database } from '@kit/supabase/database';

import { RecordChange, Tables } from '../record-change.type';
import type { AuthUsersWebhookPayload } from '@kit/audit-log';

export function createDatabaseWebhookRouterService(
  adminClient: SupabaseClient<Database>,
) {
  return new DatabaseWebhookRouterService(adminClient);
}

/**
 * @name DatabaseWebhookRouterService
 * @description Service that routes the webhook event to the appropriate service
 */
class DatabaseWebhookRouterService {
  constructor(private readonly adminClient: SupabaseClient<Database>) {}

  /**
   * @name handleWebhook
   * @description Handle the webhook event
   * @param body
   */
  async handleWebhook(body: RecordChange<any, any, any> | AuthUsersWebhookPayload) {
    switch (body.table) {
      case 'invitations': {
        const payload = body as RecordChange<'public', 'invitations'>;
        return this.handleInvitationsWebhook(payload);
      }
      case 'personal_invites': {
        const payload = body as RecordChange<'public', 'personal_invites'>;
        return this.handlePersonalInvitesWebhook(payload);
      }
      case 'subscriptions': {
        const payload = body as RecordChange<'public', 'subscriptions'>;
        return this.handleSubscriptionsWebhook(payload);
      }
      case 'accounts': {
        const payload = body as RecordChange<'public', 'accounts'>;
        return this.handleAccountsWebhook(payload);
      }
      case 'users': {
        if ((body as any).schema === 'auth') {
          return this.handleAuthUsersWebhook(body as AuthUsersWebhookPayload);
        }
        return;
      }
      default: {
        return;
      }
    }
  }

  private async handleInvitationsWebhook(body: RecordChange<'public', 'invitations'>) {
    const { createAccountInvitationsWebhookService } = await import(
      '@kit/team-accounts/webhooks'
    );

    const service = createAccountInvitationsWebhookService(this.adminClient);

    return service.handleInvitationWebhook(body.record);
  }

  private async handleSubscriptionsWebhook(
    body: RecordChange<'public', 'subscriptions'>,
  ) {
    if (body.type === 'DELETE' && body.old_record) {
      const { createBillingWebhooksService } = await import(
        '@kit/billing-gateway'
      );

      const service = createBillingWebhooksService();

      return service.handleSubscriptionDeletedWebhook(body.old_record);
    }
  }

  private async handleAccountsWebhook(body: RecordChange<'public', 'accounts'>) {
    if (body.type === 'DELETE' && body.old_record) {
      const { createAccountWebhooksService } = await import(
        '@kit/team-accounts/webhooks'
      );

      const service = createAccountWebhooksService();

      return service.handleAccountDeletedWebhook(body.old_record);
    }
  }

  private async handlePersonalInvitesWebhook(body: RecordChange<'public', 'personal_invites'>) {
    if (body.type === 'INSERT' && body.record) {
      // Dynamic import to avoid circular dependencies
      const { createPersonalInviteWebhookService } = await import(
        '@kit/personal-invitations/server'
      );

      const service = createPersonalInviteWebhookService(this.adminClient);

      return service.handlePersonalInviteCreatedWebhook(body.record);
    }
  }

  private async handleAuthUsersWebhook(body: AuthUsersWebhookPayload) {
    // Dynamic import to avoid circular dependencies
    const { handleAuthUsersDatabaseWebhook } = await import('@kit/audit-log');
    return handleAuthUsersDatabaseWebhook(body);
  }
}
