/**
 * This is a sample billing configuration file. You should copy this file to `billing.config.ts` and then replace
 * the configuration with your own billing provider and products.
 */
import { BillingProviderSchema, createBillingSchema } from '@kit/billing';
import { z } from 'zod';

// The billing provider to use. This should be set in the environment variables
// and should match the provider in the database. We also add it here so we can validate
// your configuration against the selected provider at build time.
const provider = BillingProviderSchema.parse(
  process.env.NEXT_PUBLIC_BILLING_PROVIDER,
);

const VariantsSchema = z.object({
  NEXT_PUBLIC_PRO_PLAN_MONTHLY_VARIANT_ID: z.string().min(1),
  NEXT_PUBLIC_PRO_PLAN_YEARLY_VARIANT_ID: z.string().min(1),
});

const variants = VariantsSchema.parse(
  process.env,
);

export default createBillingSchema({
  // also update config.billing_provider in the DB to match the selected
  provider,
  // products configuration
  products: [
    {
        id: 'free',
        name: 'Free',
        badge: 'Free',
        description: 'The perfect plan to get started',
        currency: 'USD',
        features: ['Up to 20 sessions', 'Up to 2 clients'],
        plans: [
          {
            id: 'free-plan',
            name: 'Free Plan',
            lineItems: [],
            custom: true,
            label: 'Free',
            buttonLabel: 'Get started with the free plan',
            paymentType: 'recurring',
            interval: 'month',
          },
          {
            id: 'free-plan-yearly',
            name: 'Free Plan',
            lineItems: [],
            custom: true,
            label: 'Free',
            buttonLabel: 'Get started with the free plan',
            paymentType: 'recurring',
            interval: 'year',
          },
        ],
    },  
    {
      id: 'pro',
      name: 'Pro',
      badge: `Popular`,
      highlighted: true,
      description: 'The plan for serious therapists',
      currency: 'USD',
      plans: [
        {
          name: 'Pro Monthly',
          id: 'pro-monthly',
          paymentType: 'recurring',
          interval: 'month',
          lineItems: [
            {
              id: variants.NEXT_PUBLIC_PRO_PLAN_MONTHLY_VARIANT_ID,
              name: 'Base',
              cost: 19.99,
              type: 'flat',
            },
          ],
        },
        {
          name: 'Pro Yearly',
          id: 'pro-yearly',
          paymentType: 'recurring',
          interval: 'year',
          lineItems: [
            {
              id: variants.NEXT_PUBLIC_PRO_PLAN_YEARLY_VARIANT_ID,
              name: 'Base',
              cost: 199.99,
              type: 'flat',
            },
          ],
        },
      ],
      features: [
        'Unlimited clients',
        'Unlimited sessions'
      ],
    }
  ],
});
