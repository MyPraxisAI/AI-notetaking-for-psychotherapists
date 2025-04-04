'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useSupabase } from '@kit/supabase/hooks/use-supabase';
import { useUserWorkspace } from '@kit/accounts/hooks/use-user-workspace';

import { 
  TherapistProfileData, 
  TherapistProfileWithId, 
  TherapistRecord,
  TherapistApproach
} from '../schemas/therapist';

/**
 * Hook to fetch therapist profile data
 */
export function useMyPraxisTherapistProfile() {
  const { workspace } = useUserWorkspace();
  const accountId = workspace?.id;
  const client = useSupabase();

  const queryKey = ['mypraxis-therapist-profile', accountId];

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
            approach_id,
            therapeutic_approaches(id, name)
          `)
          .eq('therapist_id', therapistData.id)
          .order('priority', { ascending: true });
        
        if (approachesError) {
          throw approachesError;
        }

        // Extract approaches and separate primary from secondary
        const approaches = approachesData || [];
        
        // Get the primary approach (priority 0)
        const primaryApproach = approaches.length > 0 && approaches[0] ? 
          approaches[0].approach_id || '' : 
          '';
        
        // Get the secondary approaches (priority > 0)
        const secondaryApproaches = approaches.length > 1 ? 
          approaches.slice(1).map(a => a.approach_id || '') : 
          [];
        
        // Also store the approach names for display purposes
        const approachNames = new Map<string, string>();
        approaches.forEach(approach => {
          if (approach.therapeutic_approaches) {
            const approachData = approach.therapeutic_approaches as any;
            approachNames.set(approach.approach_id, approachData.name || '');
          }
        });

        // Fetch geo locality information
        let geoLocalityName = '';
        
        if (therapistData.geo_locality_id) {
          const { data: geoLocality, error: geoLocalityError } = await client
            .from('geo_localities')
            .select('id, name')
            .eq('id', therapistData.geo_locality_id)
            .single();
            
          if (!geoLocalityError && geoLocality) {
            // Use type assertion with any as an intermediate step for type safety
            const locality = geoLocality as any;
            geoLocalityName = locality.name || '';
          }
        }
        
        // Transform the data from database format to our schema format
        const record = therapistData as TherapistRecord;
        return {
          id: record.id,
          fullName: record.full_professional_name || '',
          credentials: record.credentials || '',
          country: record.geo_locality_id || '', // Store the UUID
          countryName: geoLocalityName, // Store the name for display
          primaryTherapeuticApproach: primaryApproach, // Store the UUID
          primaryApproachName: approachNames.get(primaryApproach) || '', // Store the name for display
          secondaryTherapeuticApproaches: secondaryApproaches, // Store the UUIDs
          secondaryApproachNames: secondaryApproaches.map(id => approachNames.get(id) || ''), // Store the names for display
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
export function useUpdateMyPraxisTherapistProfile() {
  const queryClient = useQueryClient();
  const { workspace } = useUserWorkspace();
  const accountId = workspace?.id;
  const client = useSupabase();

  const mutationKey = ['mypraxis-therapist-profile:update', accountId];

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
            geo_locality_id: data.country && data.country !== '' ? data.country : null, // Convert empty string to null
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

        return { success: true, therapistId, data };
      } catch (error) {
        console.error('Error updating therapist profile:', error);
        throw error;
      }
    },
    onSuccess: (result) => {
      // Invalidate the therapist profile query to refetch the data
      if (accountId) {
        queryClient.invalidateQueries({
          queryKey: ['mypraxis-therapist-profile', accountId],
        });
      }
    },
  });
}

/**
 * Hook to update a specific field in the therapist profile
 */
export function useUpdateTherapistField() {
  const therapistProfileQuery = useMyPraxisTherapistProfile();
  const updateMutation = useUpdateMyPraxisTherapistProfile();

  const updateField = async (field: string, value: any) => {
    try {
      const currentProfile = therapistProfileQuery.data;
      
      if (!currentProfile) {
        throw new Error('Therapist profile not found');
      }

      // Handle UUID fields - convert empty strings to null
      let processedValue = value;
      if ((field === 'country' || field === 'geoLocality' || field === 'primaryTherapeuticApproach') && 
          (value === '' || value === undefined)) {
        processedValue = null;
      }

      // Create an updated profile with the new field value
      const updatedProfile: TherapistProfileWithId = {
        ...currentProfile,
        [field]: processedValue,
      };

      // Update the profile
      return await updateMutation.mutateAsync(updatedProfile);
    } catch (error) {
      console.error(`Error updating ${field}:`, error);
      throw error;
    }
  };

  return {
    updateField,
    isLoading: updateMutation.isPending
  };
}
