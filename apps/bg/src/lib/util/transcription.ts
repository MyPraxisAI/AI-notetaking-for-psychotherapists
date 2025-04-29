/**
 * Transcription utility functions for audio processing
 */

// Import OpenAI SDK using CommonJS require to avoid TypeScript type declaration issues
// eslint-disable-next-line @typescript-eslint/no-var-requires
const OpenAI = require('openai');
import * as fs from 'fs';
import * as path from 'path';

/**
 * Result of audio transcription
 */
export interface TranscriptionResult {
  text: string;
  confidence?: number;
  processingTime?: number;
  timestamp: string;
}

/**
 * Transcribe an audio file using OpenAI's API
 * 
 * @param audioFilePath - Path to the audio file to transcribe
 * @param options - Additional options for transcription
 * @returns Transcription result
 */
export async function transcribeAudio(
  audioFilePath: string,
  options?: {
    model?: 'whisper-1' | 'gpt-4o-audio-preview';
  }
): Promise<TranscriptionResult> {
  // Default options
  const model = options?.model || 'whisper-1';
  
  console.log(`Transcribing audio file: ${audioFilePath} using model: ${model}`);
  const startTime = Date.now();
  
  // Check if OPENAI_API_KEY is set
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY environment variable is not set');
  }
  
  // Initialize OpenAI client for audio transcription
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
  
  try {
    // Read the audio file as a buffer
    const audioBuffer = await fs.promises.readFile(audioFilePath);
    
    // Transcribe the audio using the OpenAI API
    // For Node.js environment, we need to use the OpenAI SDK's built-in file handling
    
    // Create a temporary file path for the audio file
    const tempFilePath = `/tmp/${path.basename(audioFilePath)}`;
    
    // Write the buffer to a temporary file
    await fs.promises.writeFile(tempFilePath, audioBuffer);
    
    // Use the OpenAI SDK to transcribe the audio file
    const transcriptionResponse = await openai.audio.transcriptions.create({
      file: fs.createReadStream(tempFilePath),
      model: model,
    });
    
    // Clean up the temporary file
    try {
      await fs.promises.unlink(tempFilePath);
    } catch (error) {
      console.warn(`Warning: Failed to clean up temporary file ${tempFilePath}:`, error);
    }
    
    // No need for response handling as we're using the SDK directly
    
    // Calculate processing time
    const processingTime = (Date.now() - startTime) / 1000;
    
    // Create the result object
    const result: TranscriptionResult = {
      text: transcriptionResponse.text,
      confidence: 0.9, // OpenAI doesn't provide confidence scores, using a default
      processingTime,
      timestamp: new Date().toISOString()
    };
    
    console.log(`Transcription completed in ${processingTime.toFixed(2)} seconds`);
    console.log(`Transcription text: ${result.text.substring(0, 100)}...`);
    
    return result;
  } catch (error) {
    console.error('Error during OpenAI transcription:', error);
    throw error;
  }
}
