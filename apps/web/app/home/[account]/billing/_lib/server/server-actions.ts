'use server';

import { redirect } from 'next/navigation';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerActionClient } from '@kit/supabase/server-actions-client';

// billing imports
import {
  TeamBillingPortalSchema,
  TeamCheckoutSchema,
} from '../schema/team-billing.schema';
import { createTeamBillingService } from './team-billing.service';

/**
 * @name createTeamAccountCheckoutSession
 * @description Creates a checkout session for a team account.
 */
export const createTeamAccountCheckoutSession = enhanceAction(
  (data) => {
    const client = getSupabaseServerActionClient();
    const service = createTeamBillingService(client);

    return service.createCheckout(data);
  },
  {
    schema: TeamCheckoutSchema,
  },
);

/**
 * @name createBillingPortalSession
 * @description Creates a Billing Session Portal and redirects the user to the
 * provider's hosted instance
 */
export const createBillingPortalSession = enhanceAction(
  async (formData: FormData) => {
    const params = TeamBillingPortalSchema.parse(Object.fromEntries(formData));

    const client = getSupabaseServerActionClient();
    const service = createTeamBillingService(client);

    // get url to billing portal
    const url = await service.createBillingPortalSession(params);

    return redirect(url);
  },
  {},
);
