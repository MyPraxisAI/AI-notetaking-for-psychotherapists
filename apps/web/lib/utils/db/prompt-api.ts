import { SupabaseClient } from '@supabase/supabase-js';
import { ArtifactType } from '../artifacts';

/**
 * Interface for prompt data from the database
 */
interface PromptData {
  id: string;
  artifact_type: ArtifactType | null;
  name: string | null;
  template: string;
  provider: string;
  model: string;
  parameters: Record<string, string | number | boolean | null>;
}

/**
 * Create a prompt API instance
 * @param client Supabase client
 * @returns Prompt API methods
 */
export function createPromptApi(client: SupabaseClient) {
  /**
   * Get a prompt by artifact type
   * @param artifactType The artifact type to get the prompt for
   * @returns The prompt data or null if not found
   */
  async function getPromptByArtifactType(artifactType: ArtifactType): Promise<PromptData> {
    try {
      const { data, error } = await client
        .from('prompts')
        .select('*')
        .eq('artifact_type', artifactType)
        .eq('active', true)
        .single();
      
      if (error) {
        throw error;
      }
      
      if (!data) {
        throw new Error(`No active prompt found for artifact type: ${artifactType}`);
      }
      
      return data as PromptData;
    } catch (error) {
      console.error(`Error fetching prompt for artifact type ${artifactType}:`, error);
      throw new Error(`Failed to get prompt for artifact type ${artifactType}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get a prompt by name
   * @param name The name of the prompt
   * @returns The prompt data or null if not found
   */
  async function getPromptByName(name: string): Promise<PromptData> {
    try {
      const { data, error } = await client
        .from('prompts')
        .select('*')
        .eq('name', name)
        .eq('active', true)
        .single();
      
      if (error) {
        throw error;
      }
      
      if (!data) {
        throw new Error(`No active prompt found with name: ${name}`);
      }
      
      return data as PromptData;
    } catch (error) {
      console.error(`Error fetching prompt with name ${name}:`, error);
      throw new Error(`Failed to get prompt with name ${name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get all active prompts
   * @returns Array of active prompts
   */
  async function getAllActivePrompts(): Promise<PromptData[]> {
    try {
      const { data, error } = await client
        .from('prompts')
        .select('*')
        .eq('active', true)
        .order('artifact_type', { ascending: true });
      
      if (error) {
        throw error;
      }
      
      return data as PromptData[];
    } catch (error) {
      console.error('Error fetching active prompts:', error);
      throw new Error(`Failed to get active prompts: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Return the API methods
  return {
    getPromptByArtifactType,
    getPromptByName,
    getAllActivePrompts
  };
}
