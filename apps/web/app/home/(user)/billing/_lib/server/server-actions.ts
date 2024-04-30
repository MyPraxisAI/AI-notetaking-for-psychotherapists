'use server';

import { redirect } from 'next/navigation';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerActionClient } from '@kit/supabase/server-actions-client';

import { PersonalAccountCheckoutSchema } from '../schema/personal-account-checkout.schema';
import { createUserBillingService } from './user-billing.service';

/**
 * @name createPersonalAccountCheckoutSession
 * @description Creates a checkout session for a personal account.
 */
export const createPersonalAccountCheckoutSession = enhanceAction(
  async function (data) {
    const client = getSupabaseServerActionClient();
    const service = createUserBillingService(client);

    return await service.createCheckoutSession(data);
  },
  {
    schema: PersonalAccountCheckoutSchema,
  },
);

/**
 * @name createPersonalAccountBillingPortalSession
 * @description Creates a billing Portal session for a personal account
 */
export const createPersonalAccountBillingPortalSession = enhanceAction(
  async () => {
    const client = getSupabaseServerActionClient();
    const service = createUserBillingService(client);

    // get url to billing portal
    const url = await service.createBillingPortalSession();

    return redirect(url);
  },
  {},
);
