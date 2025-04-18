import { ChatOpenAI } from '@langchain/openai';
import * as nunjucks from 'nunjucks';
import { encodingForModel } from 'js-tiktoken';

// For structured logging
import { getLogger } from '@kit/shared/logger';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

// Define the artifact types
export type ArtifactType = 
  | 'session_therapist_summary' 
  | 'session_client_summary' 
  | 'client_prep_note' 
  | 'client_conceptualization' 
  | 'client_bio';

// Define the language types
export type LanguageType = 'en' | 'ru';

// Import the prompt API
import { createPromptApi } from '../../app/home/(user)/mypraxis/_lib/api/prompt-api';

/**
 * Initialize the OpenAI client
 * @param options Configuration options including model name and parameters
 * @returns ChatOpenAI instance
 */
function getOpenAIClient(options: {
  model?: string;
  temperature?: number;
  max_tokens?: number;
  [key: string]: any;
} = {}) {
  // Get the OpenAI API key from environment variables
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is not set');
  }
  
  // Initialize the OpenAI client with API key from environment
  return new ChatOpenAI({
    modelName: options.model || 'gpt-4o-mini',
    temperature: options.temperature || 0.7,
    maxTokens: options.max_tokens,
    openAIApiKey: apiKey,
  });
}

// Import the therapist API
import { createTherapistApi } from '../../app/home/(user)/mypraxis/_lib/api/therapist-api';

/**
 * Estimate token count for a string using tiktoken
 * @param text Text to estimate tokens for
 * @returns Estimated token count
 */
function estimateTokenCount(text: string): number {
  try {
    // Use cl100k_base encoding which is used by gpt-4 models
    const enc = encodingForModel('gpt-4');
    const tokens = enc.encode(text);
    // Note: js-tiktoken doesn't have a free method like the Python version
    // We rely on JavaScript's garbage collection
    return tokens.length;
  } catch (error) {
    // Fallback to character-based estimation if tiktoken fails
    // Rough estimate: 4 characters per token
    return Math.ceil(text.length / 4);
  }
}

/**
 * Generate an artifact using OpenAI
 * @param type Artifact type
 * @param language Language for the artifact
 * @param variables Template variables
 * @returns Generated artifact content
 */
export async function generateArtifact(
  type: ArtifactType,
  language: LanguageType,
  variables: Record<string, string>
): Promise<string> {
  // Create a logger instance
  const logger = getLogger();
  const ctx = {
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
    
    // Get the OpenAI client with the model from the model column and parameters from the parameters column
    const clientOptions = {
      ...modelParameters,
      model: promptData.model // Explicitly use the model column, not parameters.model
    };
    
    // Log the options being passed to the OpenAI client
    console.log('OpenAI client options:', clientOptions);
    
    const model = getOpenAIClient(clientOptions);
    
    // Log the prompt data
    const logger = await getLogger();
    logger.debug({ 
      type, 
      model: promptData.model, 
      provider: promptData.provider 
    }, 'Using prompt from database');
    
    // Configure Nunjucks environment
    const env = new nunjucks.Environment(null, {
      autoescape: false  // Don't escape HTML since we're using this for plain text
    });
    
    // Get the primary therapeutic approach using the Therapist API
    const therapistApi = createTherapistApi(client);
    const therapeuticApproach = await therapistApi.getPrimaryTherapeuticApproach();
    const primaryApproach = therapeuticApproach.title;
        
    const prompt = env.renderString(templateString, {
      ...variables,
      language,
      primary_therapeutic_approach: primaryApproach
    });
    
    // Log the prompt variables
    logger.debug({ type, primaryApproach }, 'OpenAI prompt template variables');
    
    // In development, log the full prompt
    if (process.env.NODE_ENV === 'development') {
      console.log('OpenAI Prompt:', prompt);
    }
    
    // Estimate token count
    const tokenCount = estimateTokenCount(prompt);
    console.log(`Sending request to OpenAI API`, { tokenCount, modelName: promptData.model });
    
    // Generate the artifact content
    const startTime = Date.now();
    console.log(`Starting OpenAI request with model: ${promptData.model}`);
    const response = await model.invoke(prompt);
    console.log('OpenAI response:', response);
    const duration = Date.now() - startTime;
    
    // Estimate response token count
    const responseText = response.content.toString();
    const responseTokenCount = estimateTokenCount(responseText);
    
    console.log(`Successfully generated ${type} artifact`, { 
      duration: `${duration}ms`,
      promptTokens: tokenCount,
      responseTokens: responseTokenCount,
      totalTokens: tokenCount + responseTokenCount
    });
    
    return responseText;
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
  client: any,
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
