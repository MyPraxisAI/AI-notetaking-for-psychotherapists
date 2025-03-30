'use client';

import { z } from 'zod';
import { 
  TherapistProfileSchema, 
  UserPreferencesSchema,
  MFASettingsSchema,
  AccountSettingsSchema,
} from '../server/schemas';

// Define types based on schemas
type TherapistProfileData = z.infer<typeof TherapistProfileSchema>;
type UserPreferencesData = z.infer<typeof UserPreferencesSchema>;
type MFASettingsData = z.infer<typeof MFASettingsSchema>;
type AccountSettingsData = z.infer<typeof AccountSettingsSchema>;

// Client-side action wrappers
// These functions act as a bridge between client components and server actions

/**
 * Update therapist profile
 */
export async function updateTherapistProfile(data: TherapistProfileData): Promise<{ success: boolean }> {
  const response = await fetch('/api/therapist/profile', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to update therapist profile');
  }

  return { success: true };
}

/**
 * Update user preferences
 */
export async function updateUserPreferences(data: UserPreferencesData): Promise<{ success: boolean }> {
  const response = await fetch('/api/user/preferences', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to update user preferences');
  }

  return { success: true };
}

/**
 * Update MFA settings
 */
export async function updateMFASettings(data: MFASettingsData): Promise<{ success: boolean }> {
  const response = await fetch('/api/user/mfa', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to update MFA settings');
  }

  return { success: true };
}

/**
 * Update account settings
 */
export async function updateAccountSettings(data: AccountSettingsData): Promise<{ success: boolean }> {
  const response = await fetch('/api/user/account', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to update account settings');
  }

  return { success: true };
}
