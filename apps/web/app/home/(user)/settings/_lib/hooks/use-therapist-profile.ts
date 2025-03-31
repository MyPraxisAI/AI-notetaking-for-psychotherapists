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
        const { data: therapistData, error: therapistError } = await client
          .from('therapists')
          .select('*')
          .eq('account_id', accountId)
          .single();

        if (therapistError) {
          throw therapistError;
        }

        if (!therapistData) {
          return null;
        }

        // Fetch therapeutic approaches for this therapist
        const { data: approachesData, error: approachesError } = await client
          .from('therapists_approaches')
          .select(`
            id,
            priority,
            therapeutic_approaches(id, name)
          `)
          .eq('therapist_id', therapistData.id)
          .order('priority', { ascending: true });
        
        if (approachesError) {
          throw approachesError;
        }

        // Extract approaches and separate primary from secondary
        const approaches = approachesData || [];
        
        const primaryApproach = approaches.length > 0 && approaches[0]?.therapeutic_approaches ? 
          approaches[0].therapeutic_approaches.id || '' : 
          '';
        
        const secondaryApproaches = approaches.length > 1 ? 
          approaches.slice(1).map(a => a?.therapeutic_approaches?.id || '') : 
          [];

        // Transform the data from database format to our schema format
        const record = therapistData as TherapistRecord;
        return {
          fullName: record.full_professional_name || '',
          credentials: record.credentials || '',
          geoLocality: record.geo_locality_id || '',
          primaryTherapeuticApproach: primaryApproach,
          secondaryTherapeuticApproaches: secondaryApproaches,
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
        // Update or create the therapist record
        const { data: therapistData, error: therapistError } = await client
          .from('therapists')
          .upsert({
            account_id: accountId,
            full_professional_name: data.fullName,
            credentials: data.credentials,
            geo_locality_id: data.geoLocality, // Using the geo_locality_id directly
          }, {
            onConflict: 'account_id',
            ignoreDuplicates: false
          })
          .select('id')
          .single();

        if (therapistError) {
          throw therapistError;
        }

        if (!therapistData) {
          throw new Error('Failed to create or update therapist record');
        }

        const therapistId = therapistData.id;

        // Delete existing approaches for this therapist
        const { error: deleteError } = await client
          .from('therapists_approaches')
          .delete()
          .eq('therapist_id', therapistId);

        if (deleteError) {
          throw deleteError;
        }

        // Combine primary and secondary approaches
        const allApproaches = [
          data.primaryTherapeuticApproach,
          ...(data.secondaryTherapeuticApproaches || [])
        ].filter(Boolean);

        // Insert approaches with priority
        if (allApproaches.length > 0) {
          const approachRecords = allApproaches.map((approachId, index) => ({
            therapist_id: therapistId,
            account_id: accountId,
            approach_id: approachId,
            priority: index, // 0 for primary, 1+ for secondary
          }));

          const { error: insertError } = await client
            .from('therapists_approaches')
            .insert(approachRecords);

          if (insertError) {
            throw insertError;
          }
        }

        // Check for any errors in the process
        const error = null;

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
