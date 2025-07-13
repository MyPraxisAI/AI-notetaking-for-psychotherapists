/**
 * Base transcription provider implementation
 */

// Import Node.js modules with proper type declarations
import * as fs from 'node:fs';
import * as path from 'node:path';
import { getBackgroundLogger, createLoggerContext } from '../logger';

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
  model: string; // The model used for transcription
  segments?: TranscriptionSegment[]; // Segment information if available
  rawResponse?: unknown; // The raw response from the API
  content_json?: {
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
export type TranscriptionProvider = 'openai' | 'yandex' | 'assemblyai';

// Provider instances cache
const providers: Record<string, BaseTranscriptionProvider> = {};

/**
 * Factory function to get a transcription provider
 * 
 * @param provider - Provider name
 * @returns Transcription provider instance
 */
export async function getTranscriptionProvider(provider: TranscriptionProvider): Promise<BaseTranscriptionProvider> {
  if (providers[provider]) {
    return providers[provider];
  }
  let providerInstance: BaseTranscriptionProvider;
  switch (provider) {
    case 'openai':
      try {
        const mod = await import('./transcription/openai.js');
        providerInstance = await mod.OpenAITranscriptionProvider.create() as BaseTranscriptionProvider;
      } catch (error: unknown) {
        const loggerPromise = getBackgroundLogger();
        loggerPromise.then(logger => {
          logger.error(createLoggerContext('transcription', { error }), 'Error loading OpenAI transcription provider');
        });
        throw new Error(`Failed to load OpenAI transcription provider: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
      break;
    case 'yandex':
      try {
        const mod = await import('./transcription/yandex.js');
        providerInstance = new mod.YandexTranscriptionProvider() as BaseTranscriptionProvider;
      } catch (error: unknown) {
        const loggerPromise = getBackgroundLogger();
        loggerPromise.then(logger => {
          logger.error(createLoggerContext('transcription', { error }), 'Error loading Yandex transcription provider');
        });
        throw new Error(`Failed to load Yandex transcription provider: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
      break;
    case 'assemblyai':
      try {
        const mod = await import('./transcription/assemblyai.js');
        providerInstance = new mod.AssemblyAITranscriptionProvider() as BaseTranscriptionProvider;
      } catch (error: unknown) {
        const loggerPromise = getBackgroundLogger();
        loggerPromise.then(logger => {
          logger.error(createLoggerContext('transcription', { error }), 'Error loading AssemblyAI transcription provider');
        });
        throw new Error(`Failed to load AssemblyAI transcription provider: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
      break;
    default:
      throw new Error(`Unsupported transcription provider: ${provider}`);
  }
  providers[provider] = providerInstance;
  return providerInstance;
}

// Import provider-specific option types directly to avoid circular dependencies
// We need these types to be available for proper type checking

import { YandexTranscriptionOptions } from './transcription/yandex/common';
import { OpenAITranscriptionOptions } from './transcription/openai';
import { AssemblyAITranscriptionOptions } from './transcription/assemblyai';
import { SupabaseClient } from '@supabase/supabase-js';
import { formatTimestamp } from '@kit/web-bg-common';
import { classifySpeakerRoles } from './transcription/role_classification';

/**
 * Union type for all supported transcription options
 */
export type TranscriptionOptions = YandexTranscriptionOptions | OpenAITranscriptionOptions | AssemblyAITranscriptionOptions;

/**
 * Transcribe an audio file using the specified provider
 * 
 * @param supabaseClient - Supabase client for API access
 * @param audioFilePath - Path to the audio file to transcribe
 * @param options - Provider-specific options for transcription
 * @param provider - Provider name (defaults to 'yandex')
 * @returns Transcription result
 */
export async function transcribeAudio(
  supabaseClient: SupabaseClient,
  audioFilePath: string,
  options?: TranscriptionOptions,
  provider: TranscriptionProvider = 'yandex'
): Promise<TranscriptionResult> {
  const transcriptionProvider = await getTranscriptionProvider(provider);
  let transcriptionResult: TranscriptionResult;
  switch (provider) {
    case 'openai':
      transcriptionResult = await transcriptionProvider.transcribeAudio(audioFilePath, options as OpenAITranscriptionOptions);
      break;
    case 'yandex':
      transcriptionResult = await transcriptionProvider.transcribeAudio(audioFilePath, options as YandexTranscriptionOptions);
      break;
    case 'assemblyai':
      transcriptionResult = await transcriptionProvider.transcribeAudio(audioFilePath, options as AssemblyAITranscriptionOptions);
      break;
    default:
      throw new Error(`Unsupported transcription provider: ${provider}`);
  }

  // Classify speaker roles if segments exist and not already classified
  if (
    transcriptionResult.content_json?.segments &&
    transcriptionResult.content_json.segments.length > 0 &&
    !transcriptionResult.content_json.classified
  ) {
    try {
      transcriptionResult = await classifySpeakerRoles(supabaseClient, transcriptionResult);
    } catch (error) {
      const logger = await getBackgroundLogger();
      logger.error(createLoggerContext('transcription', { error }), 'Error during speaker role classification');
      // Continue with unclassified roles if there is an error
    }
  }

  // Format the combined text with timestamps if segments are available
  if (transcriptionResult.content_json?.segments && transcriptionResult.content_json.segments.length > 0) {
    const combinedText = transcriptionResult.content_json.segments
      .filter(segment => segment.content.trim().length > 0)
      .map(segment => {
        const startTimeFormatted = formatTimestamp(segment.start_ms / 1000);
        const endTimeFormatted = formatTimestamp(segment.end_ms / 1000);
        return `[${startTimeFormatted}-${endTimeFormatted}] ${segment.speaker || 'Unknown'}: ${segment.content}`;
      })
      .join('\n');

    transcriptionResult.text = combinedText;
  }

  return transcriptionResult;
}

