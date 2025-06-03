'use server';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getLogger, getUserLanguage, createAccountsApi } from '@kit/web-bg-common';
import { CompleteOnboardingSchema } from '../schemas/user-settings';
import type { User, SupabaseClient } from '@supabase/supabase-js';
import type { Logger } from '@kit/web-bg-common/logger';

/**
 * Sets up demo clients for a user based on their language preference
 */
async function setupDemoClients(
  client: SupabaseClient,
  accountId: string,
  logger: Logger,
  ctx: { name: string; userId: string }
): Promise<void> {
  // Get the user's language preference using the shared utility function
  // This function handles errors internally and defaults to 'en' if no preference is found
  const userLanguage = await getUserLanguage(client);
  
  // Determine which demo clients to copy based on language preference
  const demoClientIds = [];
  
  // Add appropriate demo client based on user's language
  // const enYalomId = 'e0000000-e000-4000-a000-000000000002';
  // const ruYalomId = 'f0000000-f000-4000-a000-000000000002';

  const enEugeniaId = 'e0000000-e000-4000-a000-000000000003';
  const ruEugeniaId = 'f0000000-e000-4000-a000-000000000003';
  if (userLanguage === 'en') {
    demoClientIds.push(enEugeniaId);
  } else if (userLanguage === 'ru') {
    demoClientIds.push(ruEugeniaId);
  } else {
    demoClientIds.push(enEugeniaId);
  }
  
  // First, delete any existing demo clients for this account
  try {
    // Directly delete demo clients - cascade delete will handle related data
    const { error: deleteError } = await client
      .from('clients')
      .delete()
      .eq('account_id', accountId)
      .eq('demo', true);
    
    if (deleteError) {
      throw deleteError;
    }
    
    logger.info(ctx, 'Successfully deleted existing demo clients');
  } catch (deleteError) {
    logger.error({ ...ctx, error: deleteError }, 'Failed to delete existing demo clients');
    // Continue anyway, as we still want to try creating the demo clients
  }
  
  // Create each demo client
  let copySuccess = true;
  for (const clientId of demoClientIds) {
    // Call the create_demo_client function directly with a type assertion
    // to avoid TypeScript errors since this RPC isn't in the type definitions
    const { error: copyError } = await client.rpc(
      'create_demo_client' as unknown as string,
      {
        p_target_account_id: accountId,
        p_source_client_id: clientId
      }
    );
    
    if (copyError) {
      logger.error({ ...ctx, error: copyError, clientId }, 'Failed to copy demo client');
      copySuccess = false;
      // Continue with other clients even if one fails
    }
  }
  
  if (copySuccess) {
    logger.info(ctx, 'Successfully set up demo clients');
  } else {
    logger.warn(ctx, 'Some demo clients failed to copy');
    // Don't throw here, as we've already completed the onboarding
  }
}

/**
 * Server action to set up demo clients
 */
export const setupDemoClientsAction = enhanceAction(
  async function (data, user: User) {
    const client = getSupabaseServerClient();
    const logger = await getLogger();
    const ctx = { name: 'setupDemoClientsAction', userId: user.id };
    
    try {
      logger.info(ctx, 'Setting up demo clients');
      
      // Get the user's account ID using the account API
      const accountsApi = createAccountsApi(client);
      let accountId: string;
      
      try {
        accountId = await accountsApi.getCurrentAccountId();
      } catch (error) {
        logger.error({ ...ctx, error }, 'Failed to get current account ID');
        throw new Error('Failed to get current account ID');
      }
      
      // Set up demo clients based on user preferences
      await setupDemoClients(client, accountId, logger, ctx);
      
      return { success: true };
    } catch (error) {
      logger.error({ ...ctx, error }, 'Error in setupDemoClientsAction');
      throw error;
    }
  },
  {
    auth: true,
    schema: CompleteOnboardingSchema
  }
);

/**
 * Server action to complete onboarding
 */
export const completeOnboardingAction = enhanceAction(
  async function (data, user: User) {
    const client = getSupabaseServerClient();
    const logger = await getLogger();
    const ctx = { name: 'completeOnboardingAction', userId: user.id };
    
    try {
      logger.info(ctx, 'Marking onboarding as completed');
      
      // Get the user's account ID using the account API
      const accountsApi = createAccountsApi(client);
      let accountId: string;
      
      try {
        accountId = await accountsApi.getCurrentAccountId();
      } catch (error) {
        logger.error({ ...ctx, error }, 'Failed to get current account ID');
        throw new Error('Failed to get current account ID');
      }
      
      // Update user settings to mark onboarding as completed
      const { error: updateError } = await client
        .from('user_settings')
        .update({ onboarding_completed: true })
        .eq('account_id', accountId);
      
      if (updateError) {
        logger.error({ ...ctx, error: updateError }, 'Failed to update user settings');
        throw new Error('Failed to update user settings');
      }
      
      return { success: true };
    } catch (error) {
      logger.error({ ...ctx, error }, 'Error in completeOnboardingAction');
      throw error;
    }
  },
  {
    auth: true,
    schema: CompleteOnboardingSchema
  }
);
