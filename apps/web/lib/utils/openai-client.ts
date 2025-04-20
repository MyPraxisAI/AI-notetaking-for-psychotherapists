import { ChatOpenAI } from '@langchain/openai';
import { encodingForModel } from 'js-tiktoken';

/**
 * Initialize the OpenAI client
 * @param options Configuration options including model name and parameters
 * @returns ChatOpenAI instance
 */
export function getOpenAIClient(options: {
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

/**
 * Estimate token count for a string using tiktoken
 * @param text Text to estimate tokens for
 * @returns Estimated token count
 */
export function estimateTokenCount(text: string): number {
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
