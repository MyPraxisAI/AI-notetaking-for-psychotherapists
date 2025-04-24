'use strict';

/**
 * Mock implementation of the Google Genai client for testing
 * This file provides mock implementations for Google's Gemini models
 */

import { getMockResponses, getMockResponseForPrompt } from './mock-responses';

// Get mock responses with Google Gemini provider name
const mockResponses = getMockResponses('Google', 'gemini-pro');

// Use the shared function to get responses
function getResponseForPrompt(prompt: string): string {
  return getMockResponseForPrompt(prompt, mockResponses);
}

/**
 * Mock implementation of the ChatGoogleGenerativeAI class
 */
class MockChatGoogleGenerativeAI {
  modelName: string;
  temperature: number;
  maxOutputTokens?: number;
  
  constructor(options: { modelName?: string; temperature?: number; maxOutputTokens?: number }) {
    this.modelName = options.modelName || 'gemini-pro';
    this.temperature = options.temperature || 0.7;
    this.maxOutputTokens = options.maxOutputTokens;
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
 * Initialize the mock Google Genai client
 */
export function getGoogleGenAIClient(options: {
  model?: string;
  temperature?: number;
  maxOutputTokens?: number;
  [key: string]: string | number | boolean | undefined;
} = {}): MockChatGoogleGenerativeAI {  
  // Always return the mock in test environments
  return new MockChatGoogleGenerativeAI({
    modelName: options.model || 'gemini-pro',
    temperature: options.temperature || 0.7,
    maxOutputTokens: options.maxOutputTokens
  });
}
