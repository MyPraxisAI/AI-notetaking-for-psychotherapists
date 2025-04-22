import { ChatOpenAI } from '@langchain/openai';
import { encodingForModel } from 'js-tiktoken';

// Import the mock implementation
import * as mockOpenAIClient from './__mocks__/openai-client';

// Define client options type
export interface OpenAIClientOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  [key: string]: string | number | boolean | undefined;
}

/**
 * Centralized service for AI-related functionality
 * This ensures consistent use of either real or mock implementations
 * based on environment configuration
 */
class AIService {
  private static instance: AIService;
  private readonly useMocks: boolean;
  private cachedClients: Map<string, unknown> = new Map();

  private constructor() {
    // Check environment once during initialization
    this.useMocks = process.env.MOCK_EXTERNAL_SERVICES === 'true';
  }
  
  /**
   * Get the singleton instance of AIService
   */
  public static getInstance(): AIService {
    if (!AIService.instance) {
      AIService.instance = new AIService();
    }
    return AIService.instance;
  }
  
  /**
   * Get an OpenAI client instance
   * Will return either a real or mock client based on environment configuration
   */
  public getOpenAIClient(options: OpenAIClientOptions = {}): unknown {
    const cacheKey = this.getCacheKey(options);
    
    // Return cached client if available
    if (this.cachedClients.has(cacheKey)) {
      return this.cachedClients.get(cacheKey);
    }
    
    let client;
    
    if (this.useMocks) {
      // Use mock implementation
      console.log('Using mock OpenAI client');
      client = mockOpenAIClient.getOpenAIClient(options);
    } else {
      // Use real implementation
      console.log('Using real OpenAI client');
      
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        throw new Error('OPENAI_API_KEY environment variable is not set');
      }
      
      client = new ChatOpenAI({
        modelName: options.model || 'gpt-4o-mini',
        temperature: options.temperature || 0.7,
        maxTokens: options.maxTokens,
        openAIApiKey: apiKey,
        timeout: 60000, // 60 second timeout
        maxRetries: 3,  // Retry 3 times on failure
      });
    }
    
    // Cache the client
    this.cachedClients.set(cacheKey, client);
    return client;
  }
  
  /**
   * Estimate token count for a string using tiktoken
   * This function always uses the real implementation since it's local computation
   * and doesn't require API calls
   */
  public estimateTokenCount(text: string): number {
    try {
      // Use cl100k_base encoding which is used by gpt-4 models
      const enc = encodingForModel('gpt-4');
      const tokens = enc.encode(text);
      return tokens.length;
    } catch {
      // Fallback to character-based estimation if tiktoken fails
      // Rough estimate: 4 characters per token
      console.log('Tiktoken encoding failed, using character-based estimation');
      return Math.ceil(text.length / 4);
    }
  }
  
  /**
   * Create a cache key for client options
   */
  private getCacheKey(options: OpenAIClientOptions): string {
    return JSON.stringify({
      model: options.model || 'gpt-4o-mini',
      temperature: options.temperature || 0.7,
      maxTokens: options.maxTokens
    });
  }
}

// Export a singleton instance
export const aiService = AIService.getInstance();
