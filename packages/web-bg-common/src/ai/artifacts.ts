import * as nunjucks from 'nunjucks';
import { SupabaseClient } from '@supabase/supabase-js';
import { generateLLMResponse } from './models';
import { createPromptApi, getUserLanguage } from '..';
import { getLogger } from '../logger';
import { generateVariableData, extractTemplateVariables, canGenerateVariable } from './artifact-vars';
import { cleanupMarkdownCodeBlocks } from './artifact-utils';
import { getArtifact, saveArtifact } from '../db/artifact-api';
import { invalidateSessionAndClientArtifacts } from '../db/artifact-api';
import { aws } from '..';

// Import types
import type { ArtifactType, PromptSourceType, LanguageType, VariableContext } from '../types';

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
        
    // Filter out variables that are already provided in the incoming variables
    const missingVariables = templateVariables.filter(variable => !(variable in variables));
    
    // Check if all missing variables can be generated
    for (const variable of missingVariables) {
      if (!canGenerateVariable(variable)) {
        throw new Error(`Cannot generate content: variable '${variable}' is not provided and cannot be generated`);
      }
    }
    
    // Only generate data for variables that aren't already provided
    const generatedVariableData = missingVariables.length > 0 ? 
      await generateVariableData(client, sourceValue as ArtifactType, missingVariables, variableContext) : {};
      
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
        
    // Render the prompt template with variables
    let prompt = env.renderString(templateString, variableData);
    
    // If mock services are enabled, inject the source identifier as a marker
    // This helps the mock implementation identify which response to return
    if (process.env.MOCK_EXTERNAL_SERVICES === 'true') {
      logger.info(ctx, `${logPrefix} Using mock services, injecting source marker`);
      prompt = `${sourceType}:${sourceValue}\n${prompt}`;
    }
    
    // Log the prompt variables
    logger.info(ctx, `${logPrefix} Prompt template variables`, { sourceType, sourceValue });
    
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

    // Clean up the content by removing markdown code block markers if they exist
    const cleanedContent = cleanupMarkdownCodeBlocks(result.content);

    return cleanedContent;
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

// saveArtifact function has been moved to db/artifact-api.ts

// Template variable functions moved to artifact-vars.ts

/**
 * Get an existing artifact or create a new one if it doesn't exist
 * @param client Supabase client
 * @param referenceId ID of the reference (session or client)
 * @param referenceType Type of reference ('session' or 'client')
 * @param artifactType Type of artifact to get or create
 * @param userLanguage User's preferred language (optional, will use language API if not provided)
 * @param variableData Optional data for template variables
 * @returns Artifact content and metadata
 */
export async function getOrCreateArtifact(
  client: SupabaseClient,
  referenceId: string,
  referenceType: 'session' | 'client',
  artifactType: ArtifactType,
  userLanguage?: LanguageType,
  variableData?: Record<string, string>
): Promise<{ content: string; language: string; isNew: boolean }> {
  const logger = await getLogger();
  
  // If language is not provided, fetch it using the language API
  const language = userLanguage || await getUserLanguage(client) as LanguageType;
  
  const ctx = {
    name: 'get-or-create-artifact',
    referenceId,
    referenceType,
    artifactType,
    language
  };
  
  try {
    logger.info(ctx, `Checking if artifact exists for ${referenceType} ${referenceId}`);
    // Check if the artifact already exists in the database using the new API
    const existingArtifact = await getArtifact(client, referenceId, referenceType, artifactType);
    
    // If the artifact exists and is not stale, return it
    if (existingArtifact && !existingArtifact.stale) {
      logger.info(ctx, `Found existing non-stale artifact for ${referenceType} ${referenceId}`);
      return {
        content: existingArtifact.content,
        language: existingArtifact.language,
        isNew: false
      };
    }
    
    // If the artifact exists but is stale, we'll regenerate it
    if (existingArtifact && existingArtifact.stale) {
      logger.info(ctx, `Found stale artifact for ${referenceType} ${referenceId}, regenerating...`);
    }
    
    // At this point either no artifact exists or it's stale and needs regeneration
    logger.info(ctx, `${existingArtifact ? 'Regenerating stale' : 'Creating new'} artifact for ${referenceType} ${referenceId}...`);
        
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
    await saveArtifact(client, referenceId, referenceType, artifactType, content, language);
    
    return {
      content,
      language,
      isNew: !existingArtifact // Only true if we created a new artifact, false if we regenerated a stale one
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
        language,
        isNew: true
      };
    }
    
    throw new Error(`Failed to get or create ${artifactType}: ${errorMessage}`);
  }
}

/**
 * Regenerate artifacts for a session
 * This function will:
 * 1. Invalidate all artifacts related to the session and its client (mark them as stale)
 * 2. Queue a background task to regenerate the artifacts
 * 
 * @param client Supabase client
 * @param sessionId ID of the session
 * @param accountId ID of the account
 */
export async function regenerateArtifactsForSession(
  client: SupabaseClient,
  sessionId: string,
  accountId: string
): Promise<void> {
  const logger = await getLogger();
  const ctx = {
    name: 'regenerate-artifacts-for-session',
    sessionId,
    accountId
  };
  
  try {
    logger.info(ctx, `Invalidating artifacts and queueing regeneration for session ${sessionId}`);
    
    // 1. Invalidate all artifacts related to the session and its client
    await invalidateSessionAndClientArtifacts(
      client,
      sessionId
    );
    
    // 2. Queue a background task to regenerate the artifacts
    await aws.queueArtifactsGenerate({
      sessionId,
      accountId
    });
    
    // Log a comprehensive message with all the actions taken
    logger.info(ctx, `Invalidated artifacts and queued regeneration for session ${sessionId}`);
  } catch (error) {
    logger.error(ctx, `Error regenerating artifacts for session ${sessionId}:`, { error });
    throw error;
  }
}
