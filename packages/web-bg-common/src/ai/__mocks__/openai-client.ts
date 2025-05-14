/**
 * Mock implementation of the OpenAI client for testing
 * This file will be automatically used by Jest when tests import from '../openai-client'
 */

import { getMockResponses, getMockResponseForPrompt } from './mock-responses';

// Get mock responses with OpenAI provider name
const mockResponses = getMockResponses('OpenAI', 'gpt-4o-mini');

// Use the shared function to get responses
function getResponseForPrompt(prompt: string): string {
  return getMockResponseForPrompt(prompt, mockResponses);
}

/**
 * Mock implementation of the ChatOpenAI class
 */
class MockChatOpenAI {
  modelName: string;
  temperature: number;
  maxTokens?: number;
  
  constructor(options: { modelName?: string; temperature?: number; maxTokens?: number }) {
    this.modelName = options.modelName || 'gpt-4o-mini';
    this.temperature = options.temperature || 0.7;
    this.maxTokens = options.maxTokens;
  }
  
  async invoke(messages: string | Array<{ content: string }> | { content: string }): Promise<{ content: string; role: string }> {
    let promptContent: string;
    
    // Handle both string and array inputs
    if (typeof messages === 'string') {
      // Direct string input
      promptContent = messages;
    } else if (Array.isArray(messages)) {
      // Array of message objects (LangChain format)
      promptContent = messages.map(m => m.content).join('\n');
    } else {
      // Single message object or other format
      promptContent = messages.content || messages.toString();
    }
    
    // Get the appropriate mock response
    const responseContent = getResponseForPrompt(promptContent);
    
    // Return in the format expected by LangChain
    return {
      content: responseContent,
      role: 'assistant'
    };
  }
}

/**
 * Initialize the mock OpenAI client
 */
export function getOpenAIClient(options: {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  [key: string]: string | number | boolean | undefined;
} = {}): MockChatOpenAI {  
  // Always return the mock in test environments
  return new MockChatOpenAI({
    modelName: options.model || 'gpt-4o-mini',
    temperature: options.temperature || 0.7,
    maxTokens: options.maxTokens
  });
}
