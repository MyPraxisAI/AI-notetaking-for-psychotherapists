import { ChatOpenAI } from '@langchain/openai';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { encodingForModel } from 'js-tiktoken';

// Import the mock implementations
import * as mockOpenAIClient from './__mocks__/openai-client';
import * as mockGoogleGenAIClient from './__mocks__/google-genai-client';

// Define client options type
export interface AIClientOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  provider?: 'openai' | 'google';
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

  // Default models for each provider
  private readonly defaultModels = {
    openai: 'gpt-4o-mini',
    google: 'gemini-2.0-flash'
  };

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
   * Get an AI client instance based on the specified provider
   * Will return either a real or mock client based on environment configuration
   */
  public getAIClient(options: AIClientOptions = {}): unknown {
    // Determine provider (default to OpenAI)
    const provider = options.provider || 'openai';
    const cacheKey = this.getCacheKey(options);
    
    // Return cached client if available
    if (this.cachedClients.has(cacheKey)) {
      return this.cachedClients.get(cacheKey);
    }
    
    let client;
    
    if (this.useMocks) {
      // Use mock implementation based on provider
      if (provider === 'google') {
        console.log('Using mock Google Gemini client');
        client = mockGoogleGenAIClient.getGoogleGenAIClient(options);
      } else {
        console.log('Using mock OpenAI client');
        client = mockOpenAIClient.getOpenAIClient(options);
      }
    } else {
      // Use real implementation based on provider
      if (provider === 'google') {
        console.log('Using real Google Gemini client');
        
        const apiKey = process.env.GOOGLE_API_KEY;
        if (!apiKey) {
          throw new Error('GOOGLE_API_KEY environment variable is not set');
        }
        
        client = new ChatGoogleGenerativeAI({
          apiKey,
          model: options.model || this.defaultModels.google,
          temperature: options.temperature || 0.7,
          maxOutputTokens: options.maxTokens
          // Note: Google Generative AI client doesn't support timeout and maxRetries directly
        });
      } else {
        console.log('Using real OpenAI client');
        
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
          throw new Error('OPENAI_API_KEY environment variable is not set');
        }
        
        client = new ChatOpenAI({
          modelName: options.model || this.defaultModels.openai,
          temperature: options.temperature || 0.7,
          maxTokens: options.maxTokens,
          openAIApiKey: apiKey,
          timeout: 60000, // 60 second timeout
          maxRetries: 3,  // Retry 3 times on failure
        });
      }
    }
    
    // Cache the client
    this.cachedClients.set(cacheKey, client);
    return client;
  }
  
  /**
   * Get an OpenAI client instance (for backward compatibility)
   */
  public getOpenAIClient(options: AIClientOptions = {}): unknown {
    return this.getAIClient({ ...options, provider: 'openai' });
  }
  
  /**
   * Get a Google Gemini client instance
   */
  public getGoogleGenAIClient(options: AIClientOptions = {}): unknown {
    return this.getAIClient({ ...options, provider: 'google' });
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
  private getCacheKey(options: AIClientOptions): string {
    const provider = options.provider || 'openai';
    const defaultModel = provider === 'google' ? this.defaultModels.google : this.defaultModels.openai;
    
    return JSON.stringify({
      provider,
      model: options.model || defaultModel,
      temperature: options.temperature || 0.7,
      maxTokens: options.maxTokens
    });
  }
}

// Export a singleton instance
export const aiService = AIService.getInstance();
