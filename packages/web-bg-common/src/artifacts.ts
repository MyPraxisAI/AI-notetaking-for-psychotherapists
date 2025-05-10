import * as nunjucks from 'nunjucks';
import { SupabaseClient } from '@supabase/supabase-js';
import { generateLLMResponse } from './ai/models';
import { createPromptApi, createTherapistApi, getUserLanguage, getFullLanguageName } from '.';
import { getLogger } from './logger';

// Import types
import type { ArtifactType, PromptSourceType, LanguageType } from './types';

/**
 * Generate content using a prompt template
 * @param client Supabase client
 * @param promptSource Source of the prompt (artifact_type or name)
 * @param variables Template variables
 * @returns Generated content
 */
export async function generateContent(
  client: SupabaseClient,
  promptSource: PromptSourceType,
  variables: Record<string, string>
): Promise<string> {
  // Get the user's preferred language
  const language = await getUserLanguage(client) as LanguageType;
  
  // Create a logger instance
  const logger = await getLogger();
  const ctx = {
    name: 'generate-content',
    promptSource,
    language,
    contentGeneration: true
  };
  
  const sourceType = promptSource.type;
  const sourceValue = promptSource.value;
  const logPrefix = `[${sourceType}:${sourceValue}]`;
  
  try {
    logger.info(ctx, `${logPrefix} Starting generation process`);
    logger.info(ctx, `${logPrefix} Supabase client initialized`);
    
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
    logger.info(ctx, `${logPrefix} Using prompt from database`, { 
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
      logger.info(ctx, `${logPrefix} Using mock services, injecting source marker`);
      prompt = `${sourceType}:${sourceValue}\n${prompt}`;
    }
    
    // Log the prompt variables
    logger.info(ctx, `${logPrefix} Prompt template variables`, { sourceType, sourceValue, primaryApproach });
    
    // In development, log the full prompt
    if (process.env.NODE_ENV === 'development') {
      logger.debug(ctx, `${logPrefix} Rendered Prompt:`, prompt);
    }
    
    logger.info(ctx, `${logPrefix} Starting LLM request with model: ${promptData.model}`);
    
    // Generate the content using the model layer with timeout handling
    let result;
    try {
      const startTime = Date.now();
      result = await generateLLMResponse(prompt, generationOptions);
      const duration = Date.now() - startTime;
      logger.info(ctx, `${logPrefix} LLM request completed in ${duration}ms`);
    } catch (error) {
      logger.error(ctx, `${logPrefix} LLM request failed:`, error);
      throw error;
    }
    
    // Log generation results
    logger.info(ctx, `${logPrefix} Successfully generated content`, { 
      duration: `${result.duration}ms`,
      promptTokens: result.promptTokens,
      completionTokens: result.completionTokens,
      totalTokens: result.totalTokens
    });
    
    return result.content;
  } catch (error) {
    logger.error(ctx, `Error generating content for ${sourceType}:${sourceValue}:`, error);
    throw new Error(`Failed to generate content for ${sourceType}:${sourceValue}`);
  }
}

/**
 * Generate an artifact using OpenAI
 * @param client Supabase client
 * @param type Artifact type
 * @param variables Template variables
 * @returns Generated artifact content
 */
export async function generateArtifact(
  client: SupabaseClient,
  type: ArtifactType,
  variables: Record<string, string>
): Promise<string> {
  // Use the core generation function with artifact_type as the source
  return generateContent(client, { type: 'artifact_type', value: type }, variables);
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
  const logger = await getLogger();
  const ctx = {
    name: 'save-artifact',
    referenceId,
    referenceType,
    type,
    language
  };
  
  try {
    logger.info(ctx, `Saving ${type} artifact to database`);
    
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
      logger.info(ctx, `Updating existing ${type} artifact`);
      const { error } = await client
        .from('artifacts')
        .update({ content })
        .eq('id', existingArtifact.id);
      
      if (error) throw error;
    } else {
      // Create new artifact
      logger.info(ctx, `Creating new ${type} artifact`);
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
    
    logger.info(ctx, `Successfully saved ${type} artifact`);
    return true;
  } catch (error) {
    logger.error(ctx, `Error saving ${type} artifact:`, error);
    return false;
  }
}
