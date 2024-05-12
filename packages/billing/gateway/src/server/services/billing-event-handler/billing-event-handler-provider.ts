import 'server-only';

import { BillingConfig } from '@kit/billing';
import { Database } from '@kit/supabase/database';
import { getSupabaseServerActionClient } from '@kit/supabase/server-actions-client';

import { BillingEventHandlerFactoryService } from './billing-event-handler-factory.service';
import { BillingEventHandlerService } from './billing-event-handler.service';

/**
 * @description This function retrieves the billing provider from the database and returns a
 * new instance of the `BillingGatewayService` class. This class is used to interact with the server actions
 * defined in the host application.
 */
export async function getBillingEventHandlerService(
  clientProvider: () => ReturnType<typeof getSupabaseServerActionClient>,
  provider: Database['public']['Enums']['billing_provider'],
  config: BillingConfig,
) {
  const strategy = await BillingEventHandlerFactoryService.GetProviderStrategy(
    provider,
    config,
  );

  return new BillingEventHandlerService(clientProvider, strategy);
}
