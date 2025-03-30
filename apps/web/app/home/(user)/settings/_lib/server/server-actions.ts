import { z } from 'zod';

import { enhanceAction } from '@kit/next/actions';
import { getLogger } from '@kit/shared/logger';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { SupabaseClient } from '@supabase/supabase-js';

// Initialize logger
let logger: any;
getLogger().then((l) => {
  logger = l;
});

// Type assertion to allow access to custom tables
type CustomClient = SupabaseClient & {
  from: (table: string) => any;
};

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

// Action to update therapist profile
export const updateTherapistProfileAction = enhanceAction(
  async function updateTherapistProfile(data: z.infer<typeof TherapistProfileSchema>, user: { id: string }) {
    const ctx = {
      name: 'update-therapist-profile',
      userId: user.id,
    };

    logger.info(ctx, 'Updating therapist profile...');

    try {
      const client = getSupabaseServerClient() as CustomClient;
      
      // Check if therapist record exists
      const { data: existingTherapist, error: fetchError } = await client
        .from('therapists')
        .select('id, account_id')
        .eq('user_id', user.id)
        .single();
      
      if (fetchError && fetchError.code !== 'PGRST116') {
        logger.error(ctx, 'Error fetching therapist record', { error: fetchError });
        throw fetchError;
      }

      // Get the user's personal account
      const { data: account, error: accountError } = await client
        .from('accounts')
        .select('id')
        .eq('is_personal_account', true)
        .eq('user_id', user.id)
        .single();
      
      if (accountError) {
        logger.error(ctx, 'Error fetching user account', { error: accountError });
        throw accountError;
      }

      const accountId = account.id;

      // Get therapeutic approach IDs
      const { data: approaches, error: approachesError } = await client
        .from('therapeutic_approaches')
        .select('id, name')
        .in('name', [
          data.primaryTherapeuticApproach, 
          ...(data.secondaryTherapeuticApproaches || [])
        ]);
      
      if (approachesError) {
        logger.error(ctx, 'Error fetching therapeutic approaches', { error: approachesError });
        throw approachesError;
      }

      // Get country ID
      const { data: country, error: countryError } = await client
        .from('geo_localities')
        .select('id')
        .eq('name', data.country)
        .single();
      
      if (countryError) {
        logger.error(ctx, 'Error fetching country', { error: countryError });
        throw countryError;
      }

      // Find primary approach ID
      const primaryApproach = approaches.find((a: { name: string, id: string }) => a.name === data.primaryTherapeuticApproach);
      if (!primaryApproach) {
        throw new Error('Primary therapeutic approach not found');
      }

      // If therapist record exists, update it
      if (existingTherapist) {
        const { error: updateError } = await client
          .from('therapists')
          .update({
            full_name: data.fullName,
            credentials: data.credentials || null,
            geo_locality_id: country.id,
            primary_therapeutic_approach_id: primaryApproach.id,
            language: data.language,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingTherapist.id);
        
        if (updateError) {
          logger.error(ctx, 'Error updating therapist record', { error: updateError });
          throw updateError;
        }

        // Update therapist approaches
        if (data.secondaryTherapeuticApproaches && data.secondaryTherapeuticApproaches.length > 0) {
          // First delete existing approaches
          const { error: deleteError } = await client
            .from('therapists_approaches')
            .delete()
            .eq('therapist_id', existingTherapist.id);
          
          if (deleteError) {
            logger.error(ctx, 'Error deleting existing approaches', { error: deleteError });
            throw deleteError;
          }

          // Then insert new approaches
          const approachInserts = approaches.map((approach: { id: string }) => ({
            therapist_id: existingTherapist.id,
            therapeutic_approach_id: approach.id,
            account_id: accountId,
          }));

          const { error: insertError } = await client
            .from('therapists_approaches')
            .insert(approachInserts);
          
          if (insertError) {
            logger.error(ctx, 'Error inserting approaches', { error: insertError });
            throw insertError;
          }
        }
      } else {
        // Create new therapist record
        const { data: newTherapist, error: createError } = await client
          .from('therapists')
          .insert({
            user_id: user.id,
            account_id: accountId,
            full_name: data.fullName,
            credentials: data.credentials || null,
            geo_locality_id: country.id,
            primary_therapeutic_approach_id: primaryApproach.id,
            language: data.language,
          })
          .select('id')
          .single();
        
        if (createError) {
          logger.error(ctx, 'Error creating therapist record', { error: createError });
          throw createError;
        }

        // Insert therapist approaches
        if (data.secondaryTherapeuticApproaches && data.secondaryTherapeuticApproaches.length > 0) {
          const approachInserts = approaches.map((approach: { id: string }) => ({
            therapist_id: newTherapist.id,
            therapeutic_approach_id: approach.id,
            account_id: accountId,
          }));

          const { error: insertError } = await client
            .from('therapists_approaches')
            .insert(approachInserts);
          
          if (insertError) {
            logger.error(ctx, 'Error inserting approaches', { error: insertError });
            throw insertError;
          }
        }
      }

      logger.info(ctx, 'Therapist profile updated successfully');
      return { success: true };
    } catch (error) {
      logger.error(ctx, 'Failed to update therapist profile', { error });
      throw error;
    }
  },
  {
    auth: true,
    schema: TherapistProfileSchema,
  }
);

// Action to update user preferences
export const updateUserPreferencesAction = enhanceAction(
  async function updateUserPreferences(data: z.infer<typeof UserPreferencesSchema>, user: { id: string }) {
    const ctx = {
      name: 'update-user-preferences',
      userId: user.id,
    };

    logger.info(ctx, 'Updating user preferences...');

    try {
      const client = getSupabaseServerClient() as CustomClient;
      
      // Update user preferences in the user_preferences table
      const { error } = await client
        .from('user_preferences')
        .upsert({
          user_id: user.id,
          use_24_hour_clock: data.use24HourClock,
          use_international_date_format: data.useInternationalDateFormat,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id'
        });
      
      if (error) {
        logger.error(ctx, 'Error updating user preferences', { error });
        throw error;
      }

      logger.info(ctx, 'User preferences updated successfully');
      return { success: true };
    } catch (error) {
      logger.error(ctx, 'Failed to update user preferences', { error });
      throw error;
    }
  },
  {
    auth: true,
    schema: UserPreferencesSchema,
  }
);
