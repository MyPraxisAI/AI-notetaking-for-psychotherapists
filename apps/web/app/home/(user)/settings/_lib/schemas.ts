// Common schema definitions that can be shared between client and server
import { z } from 'zod';

// User preferences schema
export const UserPreferencesSchema = z.object({
  use24HourClock: z.boolean(),
  useUsDateFormat: z.boolean(),
  language: z.string().min(1, 'Language is required'),
});

// Therapist profile schema
export const TherapistProfileSchema = z.object({
  fullName: z.string().min(1, 'Full name is required'),
  credentials: z.string().optional(),
  country: z.string().min(1, 'Country is required'),
  primaryTherapeuticApproach: z.string().min(1, 'Primary therapeutic approach is required'),
  secondaryTherapeuticApproaches: z.array(z.string()).optional(),
});

// Define types based on schemas
export type UserPreferencesData = z.infer<typeof UserPreferencesSchema>;
export type TherapistProfileData = z.infer<typeof TherapistProfileSchema>;

// Database types for reference
export interface TherapistRecord {
  id: string;
  account_id: string;
  full_name: string;
  credentials?: string;
  country?: string;
  primary_therapeutic_approach?: string;
  secondary_therapeutic_approaches?: string[];
  created_at: string;
  updated_at: string;
}

export interface UserPreferencesRecord {
  id: string;
  account_id: string;
  use_24hr_clock: boolean;
  use_us_date_format: boolean;
  language: string;
  created_at: string;
  updated_at: string;
}

// Type for the database response
export interface DatabaseRecord {
  id: string;
  account_id: string;
  [key: string]: any;
}
