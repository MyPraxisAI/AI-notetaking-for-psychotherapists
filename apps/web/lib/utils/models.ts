/**
 * Generic model interaction layer
 * This module abstracts away the specific model implementation (OpenAI, etc.)
 * and provides a unified interface for text generation.
 */

import { getOpenAIClient, estimateTokenCount } from './openai-client';

// Define the supported model providers
export type ModelProvider = 'openai' | 'anthropic' | 'google';

/**
 * Options for text generation
 */
export interface GenerationOptions {
  model: string;
  temperature?: number;
  maxTokens?: number;
  provider: ModelProvider;
  [key: string]: any;
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
  const promptTokens = estimateTokenCount(prompt);
  
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
        // For future implementation
        throw new Error('Google provider not yet implemented');
      default:
        throw new Error(`Unsupported model provider: ${options.provider}`);
    }
  } catch (error) {
    console.error(`Error generating text with ${options.provider}:`, error);
    throw new Error(`Failed to generate text: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
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
  const client = getOpenAIClient({
    temperature: options.temperature,
    max_tokens: options.maxTokens,
    ...options
  });
  
  // Call the model
  console.log(`Starting OpenAI request with model: ${options.model}`);
  const response = await client.invoke(prompt);
  
  // Calculate duration
  const duration = Date.now() - startTime;
  
  // Get the response text
  const content = response.content.toString();
  
  // Estimate completion token count
  const completionTokens = estimateTokenCount(content);
  
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
