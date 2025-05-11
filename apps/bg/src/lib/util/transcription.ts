/**
 * Base transcription provider implementation
 */

// Import Node.js modules with proper type declarations
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Speaker information for diarized transcription
 */
export interface Speaker {
  id: string;
  name: string;
}

/**
 * Segment information for diarized transcription
 */
export interface TranscriptionSegment {
  id: number;
  seek: number;
  start: number;
  end: number;
  text: string;
  tokens: number[];
  temperature: number;
  avg_logprob: number;
  compression_ratio: number;
  no_speech_prob: number;
  speaker?: string; // Speaker ID if diarization is enabled
}

/**
 * Result of audio transcription
 */
export interface TranscriptionResult {
  text: string;
  processingTime?: number;
  timestamp: string;
  model?: string; // The model used for transcription
  segments?: TranscriptionSegment[]; // Segment information if available
  rawResponse?: any; // The raw response from the API
  contentJson?: {
    segments: Array<{
      start_ms: number;
      end_ms: number;
      speaker: string; // Can be 'speaker_1', 'speaker_2', 'therapist', 'client', etc.
      content: string;
    }>;
    classified?: boolean; // Indicates whether speaker roles have been classified
  }; // Structured content for database storage
}

/**
 * Base options for audio transcription
 */
export interface BaseTranscriptionOptions {
  model: string;
  language?: string; // Optional language code (e.g., 'en', 'fr')
  prompt?: string;   // Optional prompt to guide the transcription
  temperature?: number; // Controls randomness in the output (0.0 to 1.0)
}

/**
 * Base class for transcription providers
 */
export abstract class BaseTranscriptionProvider {
  /**
   * Transcribe an audio file
   * 
   * @param audioFilePath - Path to the audio file to transcribe
   * @param options - Provider-specific options for transcription
   * @returns Transcription result
   */
  abstract transcribeAudio(
    client: SupabaseClient,
    audioFilePath: string,
    options?: TranscriptionOptions
  ): Promise<TranscriptionResult>;

  /**
   * Create a temporary file from the audio buffer
   * 
   * @param audioFilePath - Path to the audio file
   * @returns Path to the temporary file
   */
  protected async createTempFile(audioFilePath: string): Promise<string> {
    // Read the audio file as a buffer
    const audioBuffer = await fs.promises.readFile(audioFilePath);
    
    // Create a temporary file path for the audio file
    const tempFilePath = `/tmp/${path.basename(audioFilePath)}`;
    
    // Write the buffer to a temporary file
    await fs.promises.writeFile(tempFilePath, audioBuffer);
    
    return tempFilePath;
  }

  /**
   * Clean up a temporary file
   * 
   * @param tempFilePath - Path to the temporary file
   */
  protected async cleanupTempFile(tempFilePath: string): Promise<void> {
    try {
      await fs.promises.unlink(tempFilePath);
    } catch (error) {
      console.warn(`Warning: Failed to clean up temporary file ${tempFilePath}:`, error);
    }
  }
}

// Provider type for type safety
export type TranscriptionProvider = 'openai' | 'yandex';

// Provider instances cache
const providers: Record<string, BaseTranscriptionProvider> = {};

/**
 * Factory function to get a transcription provider
 * 
 * @param provider - Provider name
 * @returns Transcription provider instance
 */
export function getTranscriptionProvider(provider: TranscriptionProvider): BaseTranscriptionProvider {
  // Return cached provider if it exists
  if (providers[provider]) {
    return providers[provider];
  }
  
  // Create a new provider instance
  let providerInstance: BaseTranscriptionProvider;
  
  // Dynamically import the provider implementation
  // This avoids circular dependencies
  switch (provider) {
    case 'openai':
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { OpenAITranscriptionProvider } = require('./transcription/openai');
        // Use type assertion to ensure TypeScript recognizes this as a proper subclass
        providerInstance = new OpenAITranscriptionProvider() as BaseTranscriptionProvider;
      } catch (error: any) {
        console.error('Error loading OpenAI transcription provider:', error);
        throw new Error(`Failed to load OpenAI transcription provider: ${error?.message || 'Unknown error'}`);
      }
      break;
    case 'yandex':
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { YandexTranscriptionProvider } = require('./transcription/yandex');
        // Use type assertion to ensure TypeScript recognizes this as a proper subclass
        providerInstance = new YandexTranscriptionProvider() as BaseTranscriptionProvider;
      } catch (error: any) {
        console.error('Error loading Yandex transcription provider:', error);
        throw new Error(`Failed to load Yandex transcription provider: ${error?.message || 'Unknown error'}`);
      }
      break;
    default:
      throw new Error(`Unsupported transcription provider: ${provider}`);
  }
  
  // Cache the provider instance
  providers[provider] = providerInstance;
  
  return providerInstance;
}

// Import provider-specific option types directly to avoid circular dependencies
// We need these types to be available for proper type checking

import { YandexTranscriptionOptions } from './transcription/yandex/common';
import { OpenAITranscriptionOptions } from './transcription/openai';
import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Union type for all supported transcription options
 */
export type TranscriptionOptions = YandexTranscriptionOptions | OpenAITranscriptionOptions;

/**
 * Transcribe an audio file using the specified provider
 * 
 * @param client - Supabase client for API access
 * @param audioFilePath - Path to the audio file to transcribe
 * @param options - Provider-specific options for transcription
 * @param provider - Provider name (defaults to 'yandex')
 * @returns Transcription result
 */
export async function transcribeAudio(
  client: SupabaseClient,
  audioFilePath: string,
  options?: TranscriptionOptions,
  provider: TranscriptionProvider = 'yandex'
): Promise<TranscriptionResult> {
  const transcriptionProvider = getTranscriptionProvider(provider);
  
  // Type narrowing based on the provider to ensure type safety
  switch (provider) {
    case 'openai':
      // For OpenAI, ensure options match OpenAI-specific options
      return transcriptionProvider.transcribeAudio(client, audioFilePath, options as OpenAITranscriptionOptions);
    case 'yandex':
      // For Yandex, ensure options match Yandex-specific options
      return transcriptionProvider.transcribeAudio(client, audioFilePath, options as YandexTranscriptionOptions);
    default:
      throw new Error(`Unsupported transcription provider: ${provider}`);
  }
}
