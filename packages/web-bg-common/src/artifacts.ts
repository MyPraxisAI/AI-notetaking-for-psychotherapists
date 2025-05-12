import * as nunjucks from 'nunjucks';
import { SupabaseClient } from '@supabase/supabase-js';
import { generateLLMResponse } from './ai/models';
import { createPromptApi, createTherapistApi, getUserLanguage, getFullLanguageName } from '.';
import { getLogger } from './logger';
import { generateVariableData } from './ai/artifact-vars';

// Import types
import type { ArtifactType, PromptSourceType, LanguageType, VariableContext } from './types';

/**
 * Generate content using a prompt template
 * @param client Supabase client
 * @param promptSource Source of the prompt (artifact_type or name)
 * @param variables Template variables
 * @param variableContext Optional context for variable generation
 * @returns Generated content
 */
export async function generateContent(
  client: SupabaseClient,
  promptSource: PromptSourceType,
  variables: Record<string, string>,
  variableContext?: VariableContext
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
    
    // Extract variables from the template
    const templateVariables = extractTemplateVariables(templateString);
    
    // Validate that all variables have corresponding generators
    validateTemplateVariables(templateVariables);

    // Filter out variables that are already provided in the incoming variables
    const missingVariables = templateVariables.filter(variable => !(variable in variables));
    
    // Only generate data for variables that aren't already provided
    const generatedVariableData = missingVariables.length > 0 && variableContext ? 
      await generateVariableData(client, variableContext, sourceValue as ArtifactType, missingVariables) : {};
      
    // Combine provided variables with generated ones
    const variableData = { ...generatedVariableData, ...variables };
    
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
 * @param variableContext Optional context for variable generation
 * @returns Generated artifact content
 */
export async function generateArtifact(
  client: SupabaseClient,
  type: ArtifactType,
  variables: Record<string, string>,
  variableContext?: VariableContext
): Promise<string> {
  // Use the core generation function with artifact_type as the source
  return generateContent(client, { type: 'artifact_type', value: type }, variables, variableContext);
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
    
    return true;
  } catch (error) {
    logger.error(ctx, `Error saving ${type} artifact:`, error);
    throw error;
  }
}

/**
 * Extract variables from a template string
 * @param templateString The template string to extract variables from
 * @returns Array of variable names
 */
export function extractTemplateVariables(templateString: string): string[] {
  const variableRegex = /\{\{\s*([a-z_]+)\s*\}\}/g;
  const variables = new Set<string>();
  let match: RegExpExecArray | null;
  
  while ((match = variableRegex.exec(templateString)) !== null) {
    const variableName = match[1];
    // Skip global variables that are handled at a lower level
    if (variableName && variableName !== 'language' && variableName !== 'primary_therapeutic_approach') {
      variables.add(variableName);
    }
  }
  
  return Array.from(variables);
}

/**
 * Validate that all template variables have corresponding generators
 * @param variables Array of variable names to validate
 * @throws Error if any variable doesn't have a generator
 */
export function validateTemplateVariables(variables: string[]): void {
  const supportedVariables = [
    'full_session_contents',
    'last_session_content',
    'session_summaries',
    'client_conceptualization',
    'client_bio',
    'session_transcript',
    'session_note'
  ];
  
  for (const variable of variables) {
    if (!supportedVariables.includes(variable)) {
      throw new Error(`Unsupported template variable: ${variable}`);
    }
  }
}

/**
 * Get an existing artifact or create a new one if it doesn't exist
 * @param client Supabase client
 * @param referenceId ID of the reference (session or client)
 * @param referenceType Type of reference ('session' or 'client')
 * @param artifactType Type of artifact to get or create
 * @param userLanguage User's preferred language
 * @param variableData Optional data for template variables
 * @returns Artifact content and metadata
 */
export async function getOrCreateArtifact(
  client: SupabaseClient,
  referenceId: string,
  referenceType: 'session' | 'client',
  artifactType: ArtifactType,
  userLanguage: LanguageType,
  variableData?: Record<string, string>
): Promise<{ content: string; language: string; isNew: boolean }> {
  const logger = await getLogger();
  const ctx = {
    name: 'get-or-create-artifact',
    referenceId,
    referenceType,
    artifactType,
    userLanguage
  };
  
  try {
    logger.info(ctx, `Checking if artifact exists for ${referenceType} ${referenceId}`);
    // Check if the artifact already exists in the database
    const { data: existingArtifact } = await client
      .from('artifacts')
      .select('content, language')
      .eq('reference_type', referenceType)
      .eq('reference_id', referenceId)
      .eq('type', artifactType)
      .maybeSingle();
    
    // If the artifact exists, return it
    if (existingArtifact) {
      logger.info(ctx, `Found existing artifact for ${referenceType} ${referenceId}`);
      return {
        content: existingArtifact.content,
        language: existingArtifact.language,
        isNew: false
      };
    }
    
    logger.info(ctx, `No existing artifact found for ${referenceType} ${referenceId}, generating...`);
        
    // Use provided variable data or empty object
    const variables = variableData || {};
    
    // Generate the artifact using OpenAI
    const startTime = Date.now();
    let content;
    try {
      // Create a variable context for the artifact generation
      const variableContext: VariableContext = {
        contextType: referenceType as 'client' | 'session',
        contextId: referenceId
      };
      content = await generateArtifact(client, artifactType, variables, variableContext);
      const duration = Date.now() - startTime;
      logger.info(ctx, `Generation completed successfully in ${duration}ms`);
    } catch (genError) {
      const duration = Date.now() - startTime;
      logger.error(ctx, `Generation failed after ${duration}ms:`, genError);
      throw genError;
    }
    
    // Save the generated artifact to the database
    await saveArtifact(client, referenceId, referenceType, artifactType, content, userLanguage);
    
    return {
      content,
      language: userLanguage,
      isNew: true
    };
  } catch (error) {
    logger.error(ctx, `Error getting or creating artifact for ${referenceType} ${referenceId}:`, error);
    
    // Check for timeout errors specifically
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const isTimeout = errorMessage.includes('timeout') || errorMessage.includes('timed out');
    
    if (isTimeout) {
      logger.error(ctx, `Request timed out. This could be due to high server load or an issue with the API.`);
      return {
        content: `We're sorry, but we couldn't generate this content at the moment due to high demand. Please try again later.`,
        language: userLanguage,
        isNew: true
      };
    }
    
    throw new Error(`Failed to get or create ${artifactType}: ${errorMessage}`);
  }
}


