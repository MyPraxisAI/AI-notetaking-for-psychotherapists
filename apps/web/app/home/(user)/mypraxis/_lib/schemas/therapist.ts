// Schema definitions for therapist profile
import { z } from 'zod';

// Therapist profile schema
export const TherapistProfileSchema = z.object({
  fullName: z.string().min(1, 'Full name is required'),
  credentials: z.string().optional(),
  country: z.string().min(1, 'Country is required'),
  countryName: z.string().optional(),
  primaryTherapeuticApproach: z.string().min(1, 'Primary therapeutic approach is required'),
  primaryApproachName: z.string().optional(),
  secondaryTherapeuticApproaches: z.array(z.string()).optional(),
  secondaryApproachNames: z.array(z.string()).optional(),
});

// Define types based on schemas
export type TherapistProfileData = z.infer<typeof TherapistProfileSchema>;

// Database types for reference
export interface TherapistRecord {
  id: string;
  account_id: string;
  full_professional_name?: string;
  credentials?: string;
  geo_locality_id?: string;
  created_at: string;
  updated_at: string;
}

// Type for therapist profile with optional ID
export interface TherapistProfileWithId extends TherapistProfileData {
  id?: string;
}

// Type for therapist approaches
export interface TherapistApproach {
  id: string;
  therapist_id: string;
  approach_id: string;
  priority: number;
  therapeutic_approaches?: {
    id: string;
    name: string;
  }
}
