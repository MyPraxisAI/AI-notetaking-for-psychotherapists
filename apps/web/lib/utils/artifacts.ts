import * as nunjucks from 'nunjucks';
import { getLogger } from '@kit/shared/logger';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getUserLanguage, getFullLanguageName } from './language';
import { SupabaseClient } from '@supabase/supabase-js';
import { generateLLMResponse } from './models';
import { createPromptApi } from '../../app/home/(user)/mypraxis/_lib/api/prompt-api';
import { createTherapistApi } from '../../app/home/(user)/mypraxis/_lib/api/therapist-api';

// Define the prompt source type
export type PromptSourceType = 
  | { type: 'artifact_type'; value: ArtifactType }
  | { type: 'name'; value: string };

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
 * Cleans up markdown code block markers from LLM responses
 * @param content The content to clean up
 * @returns The cleaned content without markdown code block markers
 */
function cleanupMarkdownCodeBlocks(content: string): string {
  const trimmedContent = content.trim();
  
  // Check if content starts with ```markdown (or other language specifier) and ends with ```
  if (trimmedContent.startsWith('```') && trimmedContent.endsWith('```')) {
    // Find the first newline to skip the opening marker line
    const firstNewline = trimmedContent.indexOf('\n');
    if (firstNewline !== -1) {
      // Find the last ``` marker
      const lastMarkerPos = trimmedContent.lastIndexOf('```');
      
      // Extract the content between the markers
      const innerContent = trimmedContent.substring(firstNewline + 1, lastMarkerPos).trim();
      return innerContent;
    }
  }
  
  // If not wrapped in code blocks or format doesn't match, return original
  return content;
}

/**
 * Generate content using a prompt template
 * @param promptSource Source of the prompt (artifact_type or name)
 * @param variables Template variables
 * @returns Generated content
 */
export async function generateContent(
  promptSource: PromptSourceType,
  variables: Record<string, string>
): Promise<string> {
  // Get the user's preferred language
  const language = await getUserLanguage() as LanguageType;
  
  // Create a logger instance
  const _logger = getLogger();
  const _ctx = {
    name: 'generate-content',
    promptSource,
    language,
    contentGeneration: true
  };
  
  const sourceType = promptSource.type;
  const sourceValue = promptSource.value;
  const logPrefix = `[${sourceType}:${sourceValue}]`;
  
  try {
    console.log(`${logPrefix} Starting generation process`);
    
    // Get the Supabase client
    const client = getSupabaseServerClient();
    console.log(`${logPrefix} Supabase client initialized`);
    
    // Get the template for the prompt from the database
    const promptApi = createPromptApi(client);
    let promptData;
    
    if (sourceType === 'artifact_type') {
      promptData = await promptApi.getPromptByArtifactType(sourceValue as ArtifactType);
    } else {
      promptData = await promptApi.getPromptByName(sourceValue);
    }
    
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
    console.log(`${logPrefix} Using prompt from database`, { 
      sourceType,
      sourceValue, 
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
    
    // If mock services are enabled, inject the source identifier as a marker
    // This helps the mock implementation identify which response to return
    if (process.env.MOCK_EXTERNAL_SERVICES === 'true') {
      console.log(`${logPrefix} Using mock services, injecting source marker`);
      prompt = `${sourceType}:${sourceValue}\n${prompt}`;
    }
    
    // Log the prompt variables
    console.log(`${logPrefix} Prompt template variables`, { sourceType, sourceValue, primaryApproach });
    
    // In development, log the full prompt
    if (process.env.NODE_ENV === 'development') {
      console.log(`${logPrefix} Rendered Prompt:`, prompt);
    }
    
    console.log(`${logPrefix} Starting LLM request with model: ${promptData.model}`);
    
    // Generate the content using the model layer with timeout handling
    let result;
    try {
      const startTime = Date.now();
      result = await generateLLMResponse(prompt, generationOptions);
      const duration = Date.now() - startTime;
      console.log(`${logPrefix} LLM request completed in ${duration}ms`);
    } catch (error) {
      console.error(`${logPrefix} LLM request failed:`, error);
      throw error;
    }
    
    // Log generation results
    console.log(`${logPrefix} Successfully generated content`, { 
      duration: `${result.duration}ms`,
      promptTokens: result.promptTokens,
      completionTokens: result.completionTokens,
      totalTokens: result.totalTokens
    });
    
    // Clean up the content by removing markdown code block markers if they exist
    const cleanedContent = cleanupMarkdownCodeBlocks(result.content);
    
    return cleanedContent;
  } catch (error) {
    console.error(`Error generating content for ${sourceType}:${sourceValue}:`, error);
    throw new Error(`Failed to generate content for ${sourceType}:${sourceValue}`);
  }
}

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
  // Use the core generation function with artifact_type as the source
  return generateContent({ type: 'artifact_type', value: type }, variables);
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
