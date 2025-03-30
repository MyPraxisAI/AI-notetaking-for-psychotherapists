import { z } from 'zod';

// Schema for therapist profile
export const TherapistProfileSchema = z.object({
  fullName: z.string().min(1, 'Full name is required'),
  credentials: z.string().optional(),
  country: z.string().min(1, 'Country is required'),
  primaryTherapeuticApproach: z.string().min(1, 'Primary therapeutic approach is required'),
  secondaryTherapeuticApproaches: z.array(z.string()).optional(),
  language: z.string().min(1, 'Language is required'),
});

// Schema for user preferences
export const UserPreferencesSchema = z.object({
  use24HourClock: z.boolean(),
  useInternationalDateFormat: z.boolean(),
});

// Schema for MFA settings
export const MFASettingsSchema = z.object({
  enableMFA: z.boolean(),
  preferredMethod: z.enum(['app', 'sms']).optional(),
  phoneNumber: z.string().optional(),
}).refine(data => {
  // If MFA is enabled and SMS is selected, phone number is required
  if (data.enableMFA && data.preferredMethod === 'sms' && !data.phoneNumber) {
    return false;
  }
  return true;
}, {
  message: "Phone number is required for SMS authentication",
  path: ["phoneNumber"],
});

// Schema for account settings
export const AccountSettingsSchema = z.object({
  email: z.string().email('Invalid email address'),
  name: z.string().min(1, 'Name is required'),
  password: z.string().optional(),
  confirmPassword: z.string().optional(),
}).refine(data => {
  // If password is provided, confirmPassword must match
  if (data.password && data.password !== data.confirmPassword) {
    return false;
  }
  return true;
}, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});
