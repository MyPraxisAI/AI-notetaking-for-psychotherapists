import { SupabaseClient } from '@supabase/supabase-js';
import { BaseBackgroundTask } from '../../types';
import { getBackgroundLogger, createLoggerContext } from '../logger';
import { 
  transcribeAudio, 
  TranscriptionResult
} from '../util/transcription';
import { YandexV3RuOptions } from '../util/transcription/yandex/long_audio_v3';
import { combineAudioChunks } from '../util/audio';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

/**
 * Audio Processing Task Data
 */
export interface AudioProcessingTaskData extends BaseBackgroundTask {
  operation: 'audio:transcribe';
  accountId: string;
  recordingId: string;
}


// TranscriptionResult interface is now imported from '../util/transcription'

/**
 * Audio Transcription Processor
 * Handles processing of audio transcription tasks
 */
export class AudioTranscriptionProcessor {
  private supabase!: SupabaseClient; // Using definite assignment assertion
  /**
   * Process an audio transcription task
   * @param supabase - Supabase client
   * @param task - The audio processing task data
   * @param _messageId - The SQS message ID
   */
  public async process(
    supabase: SupabaseClient,
    task: AudioProcessingTaskData,
    _messageId: string
  ): Promise<void> {
    // Store the Supabase client for use in other methods
    this.supabase = supabase;
    try {
      const { accountId, recordingId } = task;
      
      console.log(`Processing audio recording: accountId=${accountId}, recordingId=${recordingId}`);
      
      // Perform the transcription
      const transcriptionResult = await this.performTranscription(task);
      
      // Store the result in Supabase
      await this.storeTranscriptionResult(supabase, task, transcriptionResult);
      
      // Clean up resources
      await this.cleanupResources(supabase, task);
      
    } catch (error: unknown) {
      const logger = await getBackgroundLogger();
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(createLoggerContext('audioTranscriptionProcessor', { error }), `Error processing audio transcription: ${errorMessage}`);
      throw error; // Rethrow to prevent message deletion
    }
  }
  
  /**
   * Perform the actual transcription
   * @param task - The audio processing task
   * @returns The transcription result
   */
  private async performTranscription(task: AudioProcessingTaskData): Promise<TranscriptionResult> {
    const { accountId, recordingId } = task;
    let tempDir: string | null = null;
    
    // We'll determine if chunks are standalone from the database
    let standaloneChunks = false; // Default to false for safety
    
    try {
      console.log(`Starting audio transcription process for recording ${recordingId}`);
      
      // Create a temporary directory for processing files
      tempDir = await this.createTempDirectory();
      console.log(`Created temporary directory: ${tempDir}`);
      
      // 1. Get recording info to determine if chunks are standalone
      const recordingInfo = await this.getRecordingInfo(accountId, recordingId);
      standaloneChunks = recordingInfo.standalone_chunks || false;
      console.log(`Recording ${recordingId} has standalone chunks: ${standaloneChunks}`);
      
      // 2. Retrieve the audio chunks from the database
      const chunks = await this.getRecordingChunks(accountId, recordingId);
      console.log(`Found ${chunks.length} audio chunks for recording ${recordingId}`);
      
      if (chunks.length === 0) {
        console.error(`No audio chunks found for recording ${recordingId}`);
        // Return an empty transcription result instead of throwing an error
        return {
          text: '',
          timestamp: new Date().toISOString(),
          model: 'empty-transcript',
          content_json: {
            segments: [],
            classified: false
          }
        };
      }
      
      // 3. Download each chunk from storage
      const chunkFiles = await this.downloadChunks(chunks, tempDir);
      console.log(`Downloaded ${chunkFiles.length} audio chunks to ${tempDir}`);
      
      // 4. Combine the chunks using FFmpeg (extension will be determined in combineAudioChunks)
      const outputBasePath = path.join(tempDir, `${recordingId}`);
      const finalOutputPath = await combineAudioChunks(chunkFiles, outputBasePath, standaloneChunks);
      console.log(`Combined audio chunks into ${finalOutputPath}`);
            
      // Get the transcription engine from the recording info
      const transcriptionEngine = recordingInfo.transcription_engine || 'yandex-v3-ru';
      console.log(`Using transcription engine: ${transcriptionEngine}`);
      
      let result: TranscriptionResult;
      
      // Currently only yandex-v3-ru is supported
      if (transcriptionEngine === 'yandex-v3-ru') {
        // Use Yandex SpeechKit V3 with default options for Russian language
        console.log('Using Yandex SpeechKit V3 (Russian) for transcription');
        result = await transcribeAudio(this.supabase, finalOutputPath, YandexV3RuOptions, 'yandex');
      } else {
        // Fallback to Yandex V3 if an unsupported engine is specified
        console.log(`Unsupported transcription engine: ${transcriptionEngine}, falling back to yandex-v3-ru`);
        result = await transcribeAudio(this.supabase, finalOutputPath, YandexV3RuOptions, 'yandex');
      }
      
      console.log(`Transcription completed using ${transcriptionEngine} engine`);
      console.log(`Transcription result length: ${result.text.length} characters`);
      
      // Return the transcription result
      
      return result;
    } catch (error) {
      console.error(`Error in performTranscription:`, error);
      throw error;
    } finally {
      // Clean up temporary files regardless of success or failure
      if (tempDir) {
        try {
          await this.cleanupTempFiles(tempDir);
          console.log(`Cleaned up temporary directory: ${tempDir}`);
        } catch (cleanupError) {
          console.warn(`Warning: Failed to clean up temporary directory ${tempDir}:`, cleanupError);
        }
      }
    }
  }
  
  /**
   * Create a temporary directory for processing files
   * @returns Path to the temporary directory
   */
  private async createTempDirectory(): Promise<string> {
    const tempDir = path.join(os.tmpdir(), `audio-processing-${Date.now()}`);
    await fs.promises.mkdir(tempDir, { recursive: true });
    return tempDir;
  }
  
  /**
   * Get recording information from the database
   * @param accountId - The account ID
   * @param recordingId - The recording ID
   * @returns Recording information
   */
  private async getRecordingInfo(accountId: string, recordingId: string): Promise<{
    standalone_chunks: boolean;
    transcription_engine?: string;
  }> {
    const { data, error } = await this.supabase
      .from('recordings')
      .select('*')
      .eq('account_id', accountId)
      .eq('id', recordingId)
      .single();
      
    if (error) {
      console.error('Error retrieving recording info:', error);
      throw new Error(`Failed to retrieve recording info: ${error.message}`);
    }
    
    if (!data) {
      throw new Error(`Recording ${recordingId} not found`);
    }
    
    return data;
  }
  
  /**
   * Get recording chunks from the database
   * @param accountId - The account ID
   * @param recordingId - The recording ID
   * @returns Array of recording chunks
   */
  private async getRecordingChunks(accountId: string, recordingId: string): Promise<Array<{
    storage_bucket: string;
    storage_path: string;
    chunk_number: number;
  }>> {
    const { data, error } = await this.supabase
      .from('recording_chunks')
      .select('*')
      .eq('account_id', accountId)
      .eq('recording_id', recordingId)
      .order('chunk_number', { ascending: true });
      
    if (error) {
      console.error('Error retrieving recording chunks:', error);
      throw new Error(`Failed to retrieve recording chunks: ${error.message}`);
    }
    
    return data || [];
  }
  
  /**
   * Download audio chunks from storage
   * @param chunks - Array of recording chunks
   * @param tempDir - Temporary directory to store the chunks
   * @returns Array of paths to the downloaded chunk files
   */
  /**
   * Helper function to attempt a download with better error handling
   * @param storage_bucket - The storage bucket name
   * @param storage_path - The path to the file in the bucket
   * @param chunk_number - The chunk number for error reporting
   * @returns The downloaded blob
   */
  private async attemptDownloadChunk(storage_bucket: string, storage_path: string, chunk_number: number): Promise<Blob> {
    const { data, error } = await this.supabase
      .storage
      .from(storage_bucket)
      .download(storage_path);
      
    if (error) {
      // Properly format the error message with all available details
      const errorDetails = JSON.stringify(error, Object.getOwnPropertyNames(error));
      throw new Error(`Failed to download chunk ${chunk_number}: ${error.message || errorDetails}`);
    }
    
    if (!data) {
      throw new Error(`No data received for chunk ${chunk_number}`);
    }
    
    return data;
  }

  /**
   * Downloads all chunks to a temporary directory with parallelism
   * @param chunks - Array of chunk objects with storage information
   * @param tempDir - Temporary directory to store the chunks
   * @returns Array of paths to the downloaded chunk files
   */
  private async downloadChunks(
    chunks: Array<{
      storage_bucket: string;
      storage_path: string;
      chunk_number: number;
    }>,
    tempDir: string
  ): Promise<string[]> {
    const chunkFiles: string[] = [];
    const MAX_RETRIES = 1;
    const PARALLELISM = 5; // Download 5 chunks in parallel
    
    // Process chunks in batches for controlled parallelism
    for (let i = 0; i < chunks.length; i += PARALLELISM) {
      const batch = chunks.slice(i, i + PARALLELISM);
      console.log(`Processing batch ${Math.floor(i/PARALLELISM) + 1}/${Math.ceil(chunks.length/PARALLELISM)}: chunks ${i+1}-${Math.min(i+PARALLELISM, chunks.length)} of ${chunks.length}`);
      
      // Create an array of download promises for this batch
      const batchPromises = batch.map(async (chunk) => {
        const { storage_bucket, storage_path, chunk_number } = chunk;
        // Extract the file extension from the storage_path
        const fileExtension = path.extname(storage_path) || '.webm'; // Default to .webm if no extension found
        const outputPath = path.join(tempDir, `chunk_${chunk_number.toString().padStart(5, '0')}${fileExtension}`);
        
        let attempts = 0;
        let success = false;
        let lastError: Error | null = null;
        
        while (attempts <= MAX_RETRIES && !success) {
          try {
            attempts++;
            if (attempts > 1) {
              console.log(`Retry attempt ${attempts-1} for chunk ${chunk_number}...`);
            }
            
            // Download the chunk from storage with improved error handling
            const data = await this.attemptDownloadChunk(storage_bucket, storage_path, chunk_number);
            
            // Convert Blob to Buffer and write to file
            const buffer = await data.arrayBuffer().then(arrayBuffer => Buffer.from(arrayBuffer));
            await fs.promises.writeFile(outputPath, buffer);
            
            console.log(`Downloaded chunk ${chunk_number} to ${outputPath}`);
            success = true;
            return outputPath; // Return the path for this chunk
          } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
            if (attempts > MAX_RETRIES) {
              console.error(`Error downloading chunk ${chunk_number} after ${attempts} attempts:`, lastError);
              throw lastError;
            }
            // Wait briefly before retrying
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
        
        return outputPath; // This will be reached if success = true
      });
      
      // Wait for all downloads in this batch to complete
      const batchResults = await Promise.all(batchPromises);
      chunkFiles.push(...batchResults);
    }
    
    return chunkFiles;
  }
  
  // FFmpeg-related methods have been moved to the audio utility
  
  /**
   * Clean up temporary files
   * @param tempDir - Path to the temporary directory
   */
  private async cleanupTempFiles(tempDir: string): Promise<void> {
    try {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      console.warn(`Warning: Failed to clean up temporary directory ${tempDir}:`, error);
      // Don't throw error for cleanup failures
    }
  }
  
  /**
   * Store the transcription result in Supabase
   * @param supabase - Supabase client
   * @param task - The audio processing task
   * @param result - The transcription result
   */
  private async storeTranscriptionResult(
    supabase: SupabaseClient,
    task: AudioProcessingTaskData,
    result: TranscriptionResult
  ): Promise<void> {
    const { recordingId } = task;
    
    try {
      const { error } = await supabase
        .from('transcriptions')
        .upsert({
          recording_id: recordingId,
          text: result.text,
          content_json: result.content_json,
          model: result.model,
          timestamp: result.timestamp
        });
        
      if (error) {
        console.error('Error storing transcription result:', error);
        throw new Error(`Failed to store transcription result: ${error.message}`);
      }
      
      console.log(`Successfully stored transcription result for recording ${recordingId}`);
    } catch (error) {
      console.error(`Error storing transcription result for recording ${recordingId}:`, error);
      throw error;
    }
  }
  
  /**
   * Clean up resources after processing
   * @param supabase - Supabase client
   * @param task - The audio processing task
   */
  private async cleanupResources(
    supabase: SupabaseClient,
    task: AudioProcessingTaskData
  ): Promise<void> {
    const { recordingId } = task;
    const _logger = await getBackgroundLogger();
    
    try {
      // Delete the recording from the database
      // This will trigger deletion of the corresponding storage objects and recordings_chunks
      const { error: recordingDeleteError } = await supabase
        .from('recordings')
        .delete()
        .eq('id', recordingId);
        
      if (recordingDeleteError) {
        console.error('Error deleting recording:', recordingDeleteError);
        throw new Error(`Failed to delete recording: ${recordingDeleteError.message}`);
      } else {
        console.log('Recording deleted successfully');
      }
    } catch (error) {
      console.error(`Error cleaning up resources for recording ${recordingId}:`, error);
      throw error;
    }
  }
}
