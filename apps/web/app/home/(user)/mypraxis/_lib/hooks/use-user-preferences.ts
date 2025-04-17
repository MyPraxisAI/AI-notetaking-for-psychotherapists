'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSupabase } from '@kit/supabase/hooks/use-supabase';
import { useUserWorkspace } from '@kit/accounts/hooks/use-user-workspace';

// Define the user preferences interface
interface UserPreferences {
  language: string;
  use24HourClock: boolean;
  useUSDateFormat: boolean;
}

/**
 * Hook to fetch user preferences for MyPraxis
 */
export function useMyPraxisUserPreferences() {
  const { workspace } = useUserWorkspace();
  const accountId = workspace?.id;
  const client = useSupabase();

  const queryKey = ['mypraxis-user-preferences', accountId];

  return useQuery({
    queryKey,
    queryFn: async (): Promise<UserPreferences | null> => {
      if (!accountId) return null;

      try {
        // Use Supabase client directly to fetch user preferences
        const { data, error } = await client
          .from('user_preferences')
          .select('*')
          .eq('account_id', accountId)
          .single();

        if (error) {
          throw error;
        }

        if (!data) {
          return null;
        }

        // Transform the data from database format to our format
        return {
          language: data.language || 'en',
          use24HourClock: data.use_24hr_clock || false,
          useUSDateFormat: data.use_us_date_format || false,
        };
      } catch (error) {
        console.error('Error fetching user preferences:', error);
        throw error;
      }
    },
    enabled: !!accountId,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
}

/**
 * Hook to update user preferences for MyPraxis
 */
export function useUpdateMyPraxisUserPreferences() {
  const queryClient = useQueryClient();
  const { workspace } = useUserWorkspace();
  const accountId = workspace?.id;
  const client = useSupabase();

  const mutationKey = ['mypraxis-user-preferences:update', accountId];

  return useMutation({
    mutationKey,
    mutationFn: async ({ field, value }: { field: keyof UserPreferences; value: string | boolean }) => {
      if (!accountId) {
        throw new Error('Account not found');
      }

      try {
        // First, get current preferences to ensure we have the latest data
        const { data: currentData, error: fetchError } = await client
          .from('user_preferences')
          .select('*')
          .eq('account_id', accountId)
          .single();

        if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 is the error code for no rows returned
          throw fetchError;
        }

        // Prepare the data to update
        const updateData: Record<string, string | boolean> = {
          account_id: accountId,
        };

        // Map the field name to the database column name
        if (field === 'language') {
          updateData.language = value;
        } else if (field === 'use24HourClock') {
          updateData.use_24hr_clock = value;
        } else if (field === 'useUSDateFormat') {
          updateData.use_us_date_format = value;
        }

        // If we have existing data, preserve other fields
        if (currentData) {
          if (field !== 'language' && currentData.language) {
            updateData.language = currentData.language;
          }
          if (field !== 'use24HourClock' && currentData.use_24hr_clock !== undefined) {
            updateData.use_24hr_clock = currentData.use_24hr_clock;
          }
          if (field !== 'useUSDateFormat' && currentData.use_us_date_format !== undefined) {
            updateData.use_us_date_format = currentData.use_us_date_format;
          }
        }

        // Use Supabase client directly to update user preferences
        const { error: updateError } = await client
          .from('user_preferences')
          .upsert({
            account_id: accountId,
          ...(field === 'language' ? { language: value as string } : {}),
          ...(field === 'use24HourClock' ? { use_24hr_clock: value as boolean } : {}),
          ...(field === 'useUSDateFormat' ? { use_us_date_format: value as boolean } : {}),
          // Include existing values for fields we're not updating
          ...(currentData && field !== 'language' ? { language: currentData.language } : {}),
          ...(currentData && field !== 'use24HourClock' ? { use_24hr_clock: currentData.use_24hr_clock } : {}),
          ...(currentData && field !== 'useUSDateFormat' ? { use_us_date_format: currentData.use_us_date_format } : {}),
          }, {
            onConflict: 'account_id',
            ignoreDuplicates: false
          });

        if (updateError) {
          throw updateError;
        }

        return { success: true, field, value };
      } catch (error) {
        console.error(`Error updating ${field}:`, error);
        throw error;
      }
    },
    onSuccess: (_data) => {
      // Invalidate the user preferences query to refetch the data
      if (accountId) {
        queryClient.invalidateQueries({
          queryKey: ['mypraxis-user-preferences', accountId],
        });
      }
    },
  });
}

/**
 * Convenience hook to update a specific preference field
 */
export function useUpdatePreferenceField() {
  const updateMutation = useUpdateMyPraxisUserPreferences();

  const updatePreference = async (field: keyof UserPreferences, value: UserPreferences[keyof UserPreferences]) => {
    return updateMutation.mutateAsync({ field, value });
  };

  return {
    updatePreference,
    isLoading: updateMutation.isPending
  };
}
