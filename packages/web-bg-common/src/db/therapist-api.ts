import { SupabaseClient } from '@supabase/supabase-js';
import { createAccountsApi } from './account-api';

/**
 * Create a therapist API instance
 * @param client Supabase client
 * @returns Therapist API methods
 */
export function createTherapistApi(client: SupabaseClient) {
  /**
   * Get the primary therapeutic approach for the current user
   * @returns The primary therapeutic approach object with id, name, and title
   */
  async function getPrimaryTherapeuticApproach(): Promise<{ id: string; name: string; title: string }> {
    try {
      // Get the account ID using MakerKit's accounts API
      const accountsApi = createAccountsApi(client);
      const accountId = await accountsApi.getCurrentAccountId();
      
      // Get the therapist for this account
      const { data: therapistData } = await client
        .from('therapists')
        .select('id')
        .eq('account_id', accountId)
        .single();
      
      if (!therapistData?.id) {
        throw new Error('Therapist profile not found for account');
      }
      
      // Get the primary therapeutic approach
      type TherapeuticApproachResponse = {
        therapeutic_approaches: {
          id: string;
          name: string;
          title: string;
        };
      };
      
      const { data: approachData } = await client
        .from('therapists_approaches')
        .select('therapeutic_approaches(id, name, title)')
        .eq('therapist_id', therapistData.id)
        .order('priority', { ascending: true })
        .limit(1)
        .single<TherapeuticApproachResponse>();
      
      // Check if we have a valid therapeutic approach
      if (!approachData?.therapeutic_approaches) {
        throw new Error('Therapeutic approach not found');
      }
      
      // Supabase returns this as a single object when using .single()
      const approach = {
        id: approachData.therapeutic_approaches.id,
        name: approachData.therapeutic_approaches.name,
        title: approachData.therapeutic_approaches.title
      };
      
      if (!approach.name || approach.name === 'other') {
        throw new Error('Primary therapeutic approach is required');
      }
      
      return {
        id: approach.id,
        name: approach.name,
        title: approach.title
      };
      
    } catch (error) {
      console.error('Error fetching therapeutic approach:', error);
      throw new Error(`Failed to get therapeutic approach: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get therapist profile for the current user
   * @returns Therapist profile data
   */
  async function getTherapistProfile() {
    try {
      // Get the account ID
      const accountsApi = createAccountsApi(client);
      const accountId = await accountsApi.getCurrentAccountId();
      
      // Get the therapist profile
      const { data: therapistData, error } = await client
        .from('therapists')
        .select('*')
        .eq('account_id', accountId)
        .single();
      
      if (error) {
        throw error;
      }
      
      return therapistData;
    } catch (error) {
      console.error('Error fetching therapist profile:', error);
      throw new Error(`Failed to get therapist profile: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get all therapeutic approaches for the current therapist
   * @returns Array of therapeutic approaches with priority
   */
  async function getTherapeuticApproaches() {
    try {
      // Get the therapist profile first
      const therapist = await getTherapistProfile();
      
      if (!therapist?.id) {
        throw new Error('Therapist profile not found');
      }
      
      // Get all therapeutic approaches for this therapist
      const { data: approachesData, error } = await client
        .from('therapists_approaches')
        .select(`
          id,
          priority,
          therapeutic_approaches(id, name, title, description)
        `)
        .eq('therapist_id', therapist.id)
        .order('priority', { ascending: true });
      
      if (error) {
        throw error;
      }
      
      return approachesData;
    } catch (error) {
      console.error('Error fetching therapeutic approaches:', error);
      throw new Error(`Failed to get therapeutic approaches: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Return the API methods
  return {
    getPrimaryTherapeuticApproach,
    getTherapistProfile,
    getTherapeuticApproaches,
  };
}
