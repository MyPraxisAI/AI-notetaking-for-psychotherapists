/**
 * OpenAI transcription provider implementation
 */

// Import OpenAI SDK using CommonJS require to avoid TypeScript type declaration issues
// eslint-disable-next-line @typescript-eslint/no-var-requires
const OpenAI = require('openai');
import * as fs from 'fs';
import { BaseTranscriptionProvider, TranscriptionResult } from '../transcription';
import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Options for Whisper-1 model transcription
 */
export interface WhisperTranscriptionOptions {
  model: 'whisper-1';
  language?: string; // Optional language code (e.g., 'en', 'fr')
  prompt?: string;   // Optional prompt to guide the transcription
  temperature?: number; // Controls randomness in the output (0.0 to 1.0)
  response_format?: 'json' | 'text' | 'srt' | 'verbose_json' | 'vtt';
  timestamp_granularities?: Array<'word' | 'segment'>; // Controls the level of timestamp detail
}

// GPT-4o support has been removed

/**
 * Union type for all supported OpenAI transcription options
 */
export type OpenAITranscriptionOptions = WhisperTranscriptionOptions;

/**
 * Default transcription options for therapy sessions using OpenAI Whisper
 */
export const defaultOpenAITranscriptionOptions: WhisperTranscriptionOptions = {
  model: 'whisper-1',
  response_format: 'json',
  prompt: "The following is a psychotherapy session between a therapist and a client." // Provide context to improve transcription accuracy
};

/**
 * OpenAI transcription provider
 */
export class OpenAITranscriptionProvider extends BaseTranscriptionProvider {
  private openai: any;

  constructor() {
    super();
    
    // Check if OPENAI_API_KEY is set
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY environment variable is not set');
    }
    
    // Initialize OpenAI client for audio transcription
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  /**
   * Transcribe an audio file using OpenAI's API
   * 
   * @param audioFilePath - Path to the audio file to transcribe
   * @param options - Model-specific options for transcription
   * @returns Transcription result
   */
  async transcribeAudio(
    client: SupabaseClient,
    audioFilePath: string,
    options?: OpenAITranscriptionOptions
  ): Promise<TranscriptionResult> {
    // Default to whisper-1 if no options provided
    const defaultOptions: WhisperTranscriptionOptions = {
      model: 'whisper-1'
    };
    
    const transcriptionOptions = options || defaultOptions;
    const model = transcriptionOptions.model;
    
    console.log(`Transcribing audio file: ${audioFilePath} using OpenAI model: ${model}`);
    const startTime = Date.now();
    
    try {
      // Create a temporary file from the audio buffer
      const tempFilePath = await this.createTempFile(audioFilePath);
      
      let transcriptionResponse;
      
      // Type checking to ensure correct options are used for each model
      if (model === 'whisper-1') {
        if (!this.isWhisperOptions(transcriptionOptions)) {
          throw new Error('Invalid options provided for whisper-1 model');
        }
        
        // Use the OpenAI SDK to transcribe the audio file with Whisper model
        transcriptionResponse = await this.openai.audio.transcriptions.create({
          file: fs.createReadStream(tempFilePath),
          model: transcriptionOptions.model,
          language: transcriptionOptions.language,
          prompt: transcriptionOptions.prompt,
          temperature: transcriptionOptions.temperature,
          response_format: transcriptionOptions.response_format,
          timestamp_granularities: transcriptionOptions.timestamp_granularities
        });
      // GPT-4o support has been removed
      } else {
        throw new Error(`Unsupported model: ${model}`);
      }
      
      // Clean up the temporary file
      await this.cleanupTempFile(tempFilePath);
      
      // Calculate processing time
      const processingTime = (Date.now() - startTime) / 1000;
      
      // Create the result object
      const result: TranscriptionResult = {
        text: transcriptionResponse.text,
        processingTime,
        timestamp: new Date().toISOString(),
        model: `openai/${model}`, // Include the provider/model format
        rawResponse: transcriptionResponse // Store the full response
      };

      console.log('Raw transcription response:', transcriptionResponse);
      
      // GPT-4o speaker identification support has been removed
      
      console.log(`Transcription completed in ${processingTime.toFixed(2)} seconds`);
      
      return result;
    } catch (error) {
      console.error('Error during OpenAI transcription:', error);
      throw error;
    }
  }

  /**
   * Type guard to check if options are valid for Whisper model
   */
  // All options are now WhisperTranscriptionOptions
  private isWhisperOptions(options: OpenAITranscriptionOptions): options is WhisperTranscriptionOptions {
    return true; // All options are now WhisperTranscriptionOptions
  }

  // GPT-4o type guard has been removed
}
