import { SupabaseClient } from '@supabase/supabase-js';
import { TranscriptionChunk } from '../../types';
import { BaseBackgroundTask } from '../../types';

/**
 * Audio Processing Task Data
 */
export interface AudioProcessingTaskData extends BaseBackgroundTask {
  operation: 'audio:transcribe';
  accountId: string;
  recordingId: string;
}
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { promisify } from 'util';
import { exec } from 'child_process';
import { 
  transcribeAudio, 
  TranscriptionResult
} from '../util/transcription';
import { YandexV3RuOptions } from '../util/transcription/yandex/long_audio_v3';
import { combineAudioChunks } from '../util/audio';
import { regenerateArtifactsForSession } from '@kit/web-bg-common';

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
   * @param messageId - The SQS message ID
   */
  public async process(
    supabase: SupabaseClient,
    task: AudioProcessingTaskData,
    messageId: string
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
      
    } catch (error: any) {
      console.error(`Error processing audio transcription: ${error.message}`);
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
    const execPromise = promisify(exec);
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
        throw new Error(`No audio chunks found for recording ${recordingId}`);
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
  private async getRecordingInfo(accountId: string, recordingId: string): Promise<any> {
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
  private async getRecordingChunks(accountId: string, recordingId: string): Promise<any[]> {
    const { data, error } = await this.supabase
      .from('recordings_chunks')
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
   * Downloads all chunks to a temporary directory
   * @param chunks - Array of chunk objects with storage information
   * @param tempDir - Temporary directory to store the chunks
   * @returns Array of paths to the downloaded chunk files
   */
  private async downloadChunks(chunks: any[], tempDir: string): Promise<string[]> {
    const chunkFiles: string[] = [];
    const MAX_RETRIES = 1;
    
    for (const chunk of chunks) {
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
          
          chunkFiles.push(outputPath);
          console.log(`Downloaded chunk ${chunk_number} to ${outputPath}`);
          success = true;
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
    const { accountId, recordingId } = task;
        
    // Use the model name directly from the TranscriptionResult
    // It already includes the provider prefix (e.g., 'openai/whisper-1')
    
    try {
      // First, get the session_id from the recording
      const { data: recordingData, error: recordingError } = await supabase
        .from('recordings')
        .select('session_id')
        .eq('id', recordingId)
        .single();
        
      if (recordingError) {
        console.error('Error retrieving recording data from Supabase:', recordingError);
        throw new Error(`Failed to retrieve recording data: ${recordingError.message}`);
      }
      
      if (!recordingData.session_id) {
        console.error('Recording does not have an associated session_id');
        throw new Error('Recording does not have an associated session_id');
      }
      
      // Insert the transcript into the transcripts table
      const { data, error } = await supabase
        .from('transcripts')
        .insert({ 
          session_id: recordingData.session_id,
          account_id: accountId,
          transcription_model: result.model || 'openai/whisper-1',
          content: result.text,
          content_json: result.content_json
        });
        
      if (error) {
        console.error('Error inserting transcript into transcripts table:', error);
        throw new Error(`Failed to insert transcript into transcripts table: ${error.message}`);
      } else {
        console.log('Transcript inserted into transcripts table successfully');
      }

      // Invalidate all artifacts related to this session and its client and queue regeneration
      // This will mark them as stale and trigger a background task to regenerate them
      try {
        await regenerateArtifactsForSession(
          supabase,
          recordingData.session_id,
          task.accountId
        );
      } catch (invalidateError) {
        console.error('Error invalidating artifacts and queueing regeneration:', invalidateError);
        // Continue processing even if invalidation fails
      }
      
    } catch (error) {
      console.error('Error in Supabase operation:', error);
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
    const { accountId, recordingId } = task;
    
    try {
      // Delete all storage objects in the recordings bucket with the prefix {accountId}/{recordingId}
      const storagePrefix = `${accountId}/${recordingId}`;
      console.log(`Deleting storage objects with prefix: ${storagePrefix}`);
      
      // List all objects with the prefix
      const { data: storageObjects, error: listError } = await supabase
        .storage
        .from('recordings')
        .list(storagePrefix);
        
      if (listError) {
        console.error('Error listing storage objects:', listError);
      } else if (storageObjects && storageObjects.length > 0) {
        // Delete each object found
        const filesToDelete = storageObjects.map(obj => `${storagePrefix}/${obj.name}`);
        const { error: deleteError } = await supabase
          .storage
          .from('recordings')
          .remove(filesToDelete);
          
        if (deleteError) {
          console.error('Error deleting storage objects:', deleteError);
          throw new Error(`Failed to delete storage objects: ${deleteError.message}`);
        } else {
          console.log(`Successfully deleted ${filesToDelete.length} storage objects`);
        }
      } else {
        console.log('No storage objects found to delete');
      }
      
      // Delete the recording from the database
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
      console.error('Error in cleanup operations:', error);
      throw error;
    }
  }
}
