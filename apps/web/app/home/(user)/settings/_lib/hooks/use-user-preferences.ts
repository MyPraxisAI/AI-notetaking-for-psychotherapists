'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { toast } from 'sonner';

// Import Supabase client hook
import { useSupabase } from '@kit/supabase/hooks/use-supabase';

// Import the useUserWorkspace hook from Makerkit
import { useUserWorkspace } from '@kit/accounts/hooks/use-user-workspace';

import { UserPreferencesData, DatabaseRecord } from '../schemas';

// Using UserPreferencesData type from shared schemas

/**
 * Hook to fetch user preferences
 */
export function useUserPreferences() {
  const { workspace } = useUserWorkspace();
  const accountId = workspace?.id;

  const client = useSupabase();

  const queryKey = ['user-preferences', accountId];

  return useQuery({
    queryKey,
    queryFn: async (): Promise<UserPreferencesData | null> => {
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

        // Transform the data from database format to our schema format
        const record = data as DatabaseRecord;
        return {
          use24HourClock: record.use_24hr_clock || false,
          useUsDateFormat: record.use_us_date_format || false,
          language: record.language || 'en',
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
 * Hook to update user preferences
 */
export function useUpdateUserPreferences() {
  const queryClient = useQueryClient();
  const { workspace } = useUserWorkspace();
  const accountId = workspace?.id;
  const client = useSupabase();

  const mutationKey = ['user-preferences:update', accountId];

  return useMutation({
    mutationKey,
    mutationFn: async (data: UserPreferencesData) => {
      if (!accountId) {
        throw new Error('Account not found');
      }

      try {
        // Use Supabase client directly to update user preferences
        const { error } = await client
          .from('user_preferences')
          .upsert({
            account_id: accountId,
            use_24hr_clock: data.use24HourClock,
            use_us_date_format: data.useUsDateFormat,
            language: data.language,
          }, {
            onConflict: 'account_id',
            ignoreDuplicates: false
          });

        if (error) {
          throw error;
        }

        return { success: true };
      } catch (error) {
        console.error('Error updating user preferences:', error);
        throw error;
      }
    },
    onSuccess: () => {
      // Invalidate the user preferences query to refetch the data
      if (accountId) {
        queryClient.invalidateQueries({
          queryKey: ['user-preferences', accountId],
        });
      }
    },
    onError: (error) => {
      toast.error(`Failed to update preferences: ${error instanceof Error ? error.message : 'Unknown error'}`);
    },
  });
}
