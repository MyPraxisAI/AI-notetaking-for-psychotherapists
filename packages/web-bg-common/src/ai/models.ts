/**
 * Generic model interaction layer
 * This module abstracts away the specific model implementation (OpenAI, etc.)
 * and provides a unified interface for text generation.
 */

import { aiService } from './ai-service';

// Default timeout for model requests in milliseconds (2 minutes)
const DEFAULT_MODEL_TIMEOUT_MS = 120000;

// Define the supported model providers
export type ModelProvider = 'openai' | 'anthropic' | 'google';

// Map ModelProvider to AIClientOptions provider type
function mapProviderType(provider: ModelProvider): 'openai' | 'google' | undefined {
  if (provider === 'openai' || provider === 'google') {
    return provider;
  }
  return undefined;
}

/**
 * Options for text generation
 */
export interface GenerationOptions {
  model: string;
  temperature?: number;
  maxTokens?: number;
  provider: ModelProvider;
  [key: string]: string | number | boolean | undefined;
}

/**
 * Result of text generation
 */
export interface GenerationResult {
  content: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  duration: number;
}

/**
 * Generate a response from an LLM using the specified model and provider
 * @param prompt The rendered prompt to send to the model
 * @param options Generation options including model, temperature, etc.
 * @returns Generated response and metadata
 */
export async function generateLLMResponse(
  prompt: string,
  options: GenerationOptions
): Promise<GenerationResult> {
  // Log the request
  console.log(`Sending request to ${options.provider} API`, { 
    model: options.model,
    provider: options.provider,
    temperature: options.temperature
  });
  
  // Estimate prompt token count
  const promptTokens = aiService.estimateTokenCount(prompt);
  
  // Start timing
  const startTime = Date.now();
  
  try {
    // Route to the appropriate provider
    switch (options.provider.toLowerCase()) {
      case 'openai':
        return await generateWithOpenAI(prompt, options, startTime, promptTokens);
      case 'anthropic':
        // For future implementation
        throw new Error('Anthropic provider not yet implemented');
      case 'google':
        return await generateWithGoogle(prompt, options, startTime, promptTokens);
      default:
        throw new Error(`Unsupported model provider: ${options.provider}`);
    }
  } catch (error) {
    console.error(`Error generating text with ${options.provider}:`, error);
    throw new Error(`Failed to generate text: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Generate text using Google Gemini models
 * @param prompt The rendered prompt
 * @param options Generation options
 * @param startTime Start time for duration calculation
 * @param promptTokens Number of tokens in the prompt
 * @returns Generated text and metadata
 */
async function generateWithGoogle(
  prompt: string,
  options: GenerationOptions,
  startTime: number,
  promptTokens: number
): Promise<GenerationResult> {
  // Initialize Google client with options
  const client = aiService.getGoogleGenAIClient({
    temperature: options.temperature,
    maxTokens: options.maxTokens,
    model: options.model,
    provider: mapProviderType(options.provider) // Ensure proper type mapping
  });
  
  // Call the model with improved error handling
  console.log(`Starting Google request with model: ${options.model}`);
  // Type assertion for the client
  const typedClient = client as { invoke: (prompt: string) => Promise<{ content: string }> };
  
  let response;
  try {
    // Set up a timeout promise to compete with the Google call
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(
        () => reject(new Error(`Google request timed out after ${DEFAULT_MODEL_TIMEOUT_MS / 60000} minutes`)), 
        DEFAULT_MODEL_TIMEOUT_MS
      );
    });
    
    // Race the Google call against the timeout
    response = await Promise.race([
      typedClient.invoke(prompt),
      timeoutPromise
    ]) as { content: string };
    
    console.log(`Google request completed successfully for model: ${options.model}`);
  } catch (error) {
    console.error(`Google request failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    console.error('Error details:', error);
    throw error;
  }
  
  // Calculate duration
  const duration = Date.now() - startTime;
  
  // Get the response text
  const content = response.content.toString();
  
  // Estimate completion token count
  const completionTokens = aiService.estimateTokenCount(content);
  
  // Log success
  console.log(`Successfully generated text with ${options.provider}`, 
    JSON.stringify({ duration: `${duration}ms`, promptTokens, completionTokens, totalTokens: promptTokens + completionTokens }));

    return {
    content,
    promptTokens,
    completionTokens,
    totalTokens: promptTokens + completionTokens,
    duration
  };
}

/**
 * Generate text using OpenAI
 * @param prompt The rendered prompt
 * @param options Generation options
 * @param startTime Start time for duration calculation
 * @param promptTokens Number of tokens in the prompt
 * @returns Generated text and metadata
 */
async function generateWithOpenAI(
  prompt: string,
  options: GenerationOptions,
  startTime: number,
  promptTokens: number
): Promise<GenerationResult> {
  // Initialize OpenAI client with options
  const client = aiService.getOpenAIClient({
    temperature: options.temperature,
    maxTokens: options.maxTokens,
    model: options.model,
    provider: mapProviderType(options.provider) // Ensure proper type mapping
  });
  
  // Call the model with improved error handling
  console.log(`Starting OpenAI request with model: ${options.model}`);
  // Type assertion for the client
  const typedClient = client as { invoke: (prompt: string) => Promise<{ content: string }> };
  
  let response;
  try {
    // Set up a timeout promise to compete with the OpenAI call
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(
        () => reject(new Error(`OpenAI request timed out after ${DEFAULT_MODEL_TIMEOUT_MS / 60000} minutes`)), 
        DEFAULT_MODEL_TIMEOUT_MS
      );
    });
    
    // Race the OpenAI call against the timeout
    response = await Promise.race([
      typedClient.invoke(prompt),
      timeoutPromise
    ]) as { content: string };
    
    console.log(`OpenAI request completed successfully for model: ${options.model}`);
  } catch (error) {
    console.error(`OpenAI request failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    console.error('Error details:', error);
    throw error;
  }
  
  // Calculate duration
  const duration = Date.now() - startTime;
  
  // Get the response text
  const content = response.content.toString();
  
  // Estimate completion token count
  const completionTokens = aiService.estimateTokenCount(content);
  
  // Log success
  console.log(`Successfully generated text with ${options.provider}`, { 
    duration: `${duration}ms`,
    promptTokens,
    completionTokens,
    totalTokens: promptTokens + completionTokens
  });
  
  // Return the result
  return {
    content,
    promptTokens,
    completionTokens,
    totalTokens: promptTokens + completionTokens,
    duration
  };
}
