'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { toast } from 'sonner';

// Import Supabase client hook
import { useSupabase } from '@kit/supabase/hooks/use-supabase';

// Import the useUserWorkspace hook from Makerkit
import { useUserWorkspace } from '@kit/accounts/hooks/use-user-workspace';

import { TherapistProfileSchema, TherapistProfileData, TherapistRecord, DatabaseRecord } from '../schemas';

// Using TherapistProfileData type from shared schemas with optional id
export interface TherapistProfileWithId extends TherapistProfileData {
  id?: string;
};

/**
 * Hook to fetch therapist profile data
 */
export function useTherapistProfile() {
  const { workspace } = useUserWorkspace();
  const accountId = workspace?.id;
  const client = useSupabase();

  const queryKey = ['therapist-profile', accountId];

  return useQuery({
    queryKey,
    queryFn: async (): Promise<TherapistProfileWithId | null> => {
      if (!accountId) return null;

      try {
        // Use Supabase client directly to fetch therapist profile
        const { data, error } = await client
          .from('therapists')
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
          fullName: record.full_name || '',
          credentials: record.credentials || '',
          country: record.country || '',
          primaryTherapeuticApproach: record.primary_therapeutic_approach || '',
          secondaryTherapeuticApproaches: record.secondary_therapeutic_approaches || [],
        };
      } catch (error) {
        console.error('Error fetching therapist profile:', error);
        throw error;
      }
    },
    enabled: !!accountId,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
}

/**
 * Hook to update therapist profile
 */
export function useUpdateTherapistProfile() {
  const queryClient = useQueryClient();
  const { workspace } = useUserWorkspace();
  const accountId = workspace?.id;
  const client = useSupabase();

  const mutationKey = ['therapist-profile:update', accountId];

  return useMutation({
    mutationKey,
    mutationFn: async (data: TherapistProfileWithId) => {
      if (!accountId) {
        throw new Error('Account not found');
      }

      try {
        // Use Supabase client directly to update therapist profile
        const { error } = await client
          .from('therapists')
          .upsert({
            account_id: accountId,
            full_name: data.fullName,
            credentials: data.credentials,
            country: data.country,
            primary_therapeutic_approach: data.primaryTherapeuticApproach,
            secondary_therapeutic_approaches: data.secondaryTherapeuticApproaches,
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'account_id',
            ignoreDuplicates: false
          });

        if (error) {
          throw error;
        }

        return { success: true };
      } catch (error) {
        console.error('Error updating therapist profile:', error);
        throw error;
      }
    },
    onSuccess: () => {
      // Invalidate the therapist profile query to refetch the data
      if (accountId) {
        queryClient.invalidateQueries({
          queryKey: ['therapist-profile', accountId],
        });
      }
    },
  });
}
