import * as nunjucks from 'nunjucks';
import { getLogger } from '@kit/shared/logger';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getUserLanguage, getFullLanguageName } from './language';
import { SupabaseClient } from '@supabase/supabase-js';
import { generateLLMResponse } from './models';
import { createPromptApi } from '../../app/home/(user)/mypraxis/_lib/api/prompt-api';
import { createTherapistApi } from '../../app/home/(user)/mypraxis/_lib/api/therapist-api';

// Define the artifact types
export type ArtifactType = 
  | 'session_therapist_summary' 
  | 'session_client_summary' 
  | 'client_prep_note' 
  | 'client_conceptualization' 
  | 'client_bio';

// Define the language types
export type LanguageType = 'en' | 'ru';

/**
 * Generate an artifact using OpenAI
 * @param type Artifact type
 * @param variables Template variables
 * @returns Generated artifact content
 */
export async function generateArtifact(
  type: ArtifactType,
  variables: Record<string, string>
): Promise<string> {
  // Get the user's preferred language
  const language = await getUserLanguage() as LanguageType;
  
  // Create a logger instance
  const _logger = getLogger();
  const _ctx = {
    name: 'generate-artifact',
    type,
    language,
    artifactGeneration: true
  };
  
  try {
    console.log(`Starting generation of ${type} artifact`);
    
    // Get the Supabase client
    const client = getSupabaseServerClient();
    
    // Get the template for the artifact type from the database
    const promptApi = createPromptApi(client);
    const promptData = await promptApi.getPromptByArtifactType(type);
    const templateString = promptData.template;
    
    // Get model parameters from the database
    const modelParameters = promptData.parameters || { temperature: 0.7 };
    
    // Prepare generation options
    const generationOptions = {
      ...modelParameters,
      model: promptData.model, 
      provider: (promptData.provider || 'openai') as 'openai' | 'anthropic' | 'google' 
    };
    
    // Log the prompt data
    console.log('Using prompt from database', { 
      type, 
      model: promptData.model, 
      provider: promptData.provider 
    });
    
    // Configure Nunjucks environment
    const env = new nunjucks.Environment(null, {
      autoescape: false  // Don't escape HTML since we're using this for plain text
    });
    
    // Get the primary therapeutic approach using the Therapist API
    const therapistApi = createTherapistApi(client);
    const therapeuticApproach = await therapistApi.getPrimaryTherapeuticApproach();
    const primaryApproach = therapeuticApproach.title;
        
    // Render the prompt template with variables
    let prompt = env.renderString(templateString, {
      ...variables,
      language: getFullLanguageName(language), // Convert language code to full name
      primary_therapeutic_approach: primaryApproach
    });
    
    // If mock services are enabled, inject the artifact type as a marker
    // This helps the mock implementation identify which response to return
    if (process.env.MOCK_EXTERNAL_SERVICES === 'true') {
      console.log(`Injecting artifact type marker '${type}' for mock detection`);
      prompt = `${type}\n${prompt}`;
    }
    
    // Log the prompt variables
    console.log('Prompt template variables', { type, primaryApproach });
    
    // In development, log the full prompt
    if (process.env.NODE_ENV === 'development') {
      console.log('Rendered Prompt:', prompt);
    }
    
    // Generate the artifact content using the model layer
    const result = await generateLLMResponse(prompt, generationOptions);
    
    // Log generation results
    console.log(`Successfully generated ${type} artifact`, { 
      duration: `${result.duration}ms`,
      promptTokens: result.promptTokens,
      completionTokens: result.completionTokens,
      totalTokens: result.totalTokens
    });
    
    return result.content;
  } catch (error) {
    console.error(`Error generating ${type} artifact:`, error);
    throw new Error(`Failed to generate ${type} artifact`);
  }
}

/**
 * Save an artifact to the database
 * @param client Supabase client
 * @param referenceId ID of the reference (session or client)
 * @param referenceType Type of reference ('session' or 'client')
 * @param type Artifact type
 * @param content Artifact content
 * @param language Language of the artifact
 * @returns Success status
 */
export async function saveArtifact(
  client: SupabaseClient,
  referenceId: string,
  referenceType: 'session' | 'client',
  type: ArtifactType,
  content: string,
  language: LanguageType
): Promise<boolean> {
  try {
    console.log(`Saving ${type} artifact to database`);
    
    // Check if the artifact already exists
    const { data: existingArtifact } = await client
      .from('artifacts')
      .select('id')
      .eq('reference_id', referenceId)
      .eq('reference_type', referenceType)
      .eq('type', type)
      .eq('language', language)
      .single();
    
    if (existingArtifact) {
      // Update existing artifact
      console.log(`Updating existing ${type} artifact`);
      const { error } = await client
        .from('artifacts')
        .update({ content })
        .eq('id', existingArtifact.id);
      
      if (error) throw error;
    } else {
      // Create new artifact
      console.log(`Creating new ${type} artifact`);
      const { error } = await client
        .from('artifacts')
        .insert({
          reference_id: referenceId,
          reference_type: referenceType,
          type,
          content,
          language
        });
      
      if (error) throw error;
    }
    
    console.log(`Successfully saved ${type} artifact`);
    return true;
  } catch (error) {
    console.error(`Error saving ${type} artifact:`, error);
    return false;
  }
}
