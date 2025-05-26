import { z } from 'zod';

export const UserSettingsSchema = z.object({
  id: z.string().optional(),
  account_id: z.string().optional(),
  onboarding_completed: z.boolean().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export const CompleteOnboardingSchema = z.object({});

export type UserSettings = z.infer<typeof UserSettingsSchema>;
export type CompleteOnboardingData = z.infer<typeof CompleteOnboardingSchema>;
