import { SupabaseClient } from '@supabase/supabase-js';
import { AudioProcessingTaskData, TranscriptionChunk } from '../../types';
import { setSupabaseUser } from '../supabase';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { promisify } from 'util';
import { exec } from 'child_process';

/**
 * Result of audio transcription processing
 */
export interface TranscriptionResult {
  text: string;
  confidence: number;
  processingTime: number;
  timestamp: string;
  chunks: TranscriptionChunk[] | undefined;
}

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
      
      // Set the Supabase user session to the accountId for this specific task
      // accountId is guaranteed to exist as it's required in AudioProcessingTaskData
      await setSupabaseUser(supabase, accountId);
      console.log(`Set Supabase user session to account ID: ${accountId}`);
      
      // Perform the transcription
      const transcriptionResult = await this.performTranscription(task);
      console.log('Transcription completed:', transcriptionResult);
      
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
      
      // 4. Create a file list for FFmpeg
      const fileListPath = path.join(tempDir, 'filelist.txt');
      await this.createFileList(chunkFiles, fileListPath);
      
      // 5. Combine the chunks using FFmpeg
      const outputFilePath = path.join(tempDir, `${recordingId}.webm`);
      await this.combineAudioChunks(fileListPath, outputFilePath, standaloneChunks);
      console.log(`Combined audio chunks into ${outputFilePath}`);
      
      // TODO: Send to transcription service
      // For now, we'll simulate a transcription result
      const result = {
        text: "This is a simulated transcription of the audio recording.",
        confidence: 0.95,
        processingTime: 2.5,
        timestamp: new Date().toISOString(),
        chunks: standaloneChunks ? [
          { start: 0, end: 30, text: "First chunk of transcription." },
          { start: 30, end: 60, text: "Second chunk of transcription." }
        ] : undefined
      };
      
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
  private async downloadChunks(chunks: any[], tempDir: string): Promise<string[]> {
    const chunkFiles: string[] = [];
    
    for (const chunk of chunks) {
      const { storage_bucket, storage_path, chunk_number } = chunk;
      const outputPath = path.join(tempDir, `chunk_${chunk_number.toString().padStart(5, '0')}.webm`);
      
      try {
        // Download the chunk from storage
        const { data, error } = await this.supabase
          .storage
          .from(storage_bucket)
          .download(storage_path);
          
        if (error) {
          throw new Error(`Failed to download chunk ${chunk_number}: ${error.message}`);
        }
        
        if (!data) {
          throw new Error(`No data received for chunk ${chunk_number}`);
        }
        
        // Convert Blob to Buffer and write to file
        const buffer = await data.arrayBuffer().then(arrayBuffer => Buffer.from(arrayBuffer));
        await fs.promises.writeFile(outputPath, buffer);
        
        chunkFiles.push(outputPath);
        console.log(`Downloaded chunk ${chunk_number} to ${outputPath}`);
      } catch (error) {
        console.error(`Error downloading chunk ${chunk_number}:`, error);
        throw error;
      }
    }
    
    return chunkFiles;
  }
  
  /**
   * Create a file list for FFmpeg
   * @param chunkFiles - Array of paths to the chunk files
   * @param fileListPath - Path to write the file list
   */
  private async createFileList(chunkFiles: string[], fileListPath: string): Promise<void> {
    // Create a file with the list of input files for FFmpeg
    const fileListContent = chunkFiles.map(file => `file '${file}'`).join('\n');
    await fs.promises.writeFile(fileListPath, fileListContent);
  }
  
  /**
   * Combine audio chunks using FFmpeg
   * @param fileListPath - Path to the file list
   * @param outputFilePath - Path to write the combined audio file
   * @param standaloneChunks - Whether the chunks are standalone (complete WebM files) or not
   */
  private async combineAudioChunks(fileListPath: string, outputFilePath: string, standaloneChunks: boolean): Promise<void> {
    const execPromise = promisify(exec);
    
    try {
      let command: string;
      
      if (standaloneChunks) {
        // For standalone chunks, use the concat demuxer which works with complete files
        // -f concat: Use the concat demuxer
        // -safe 0: Don't require safe filenames
        // -i: Input file list
        // -c copy: Copy the audio streams without re-encoding
        command = `ffmpeg -f concat -safe 0 -i "${fileListPath}" -c copy "${outputFilePath}"`;
      } else {
        // For non-standalone chunks, use the concat filter which works at the stream level
        // This approach decodes and re-encodes the audio, which is necessary for incomplete chunks
        // Generate a complex filter for concatenation
        const inputFiles = fs.readFileSync(fileListPath, 'utf8')
          .split('\n')
          .filter(line => line.trim().length > 0)
          .map(line => line.replace(/^file '(.+)'$/, '$1'));
        
        // Create input arguments for each file
        const inputArgs = inputFiles.map(file => `-i "${file}"`).join(' ');
        
        // Create the filter complex argument
        const filterComplex = `"concat=n=${inputFiles.length}:v=0:a=1[outa]"`;
        
        // Final command with filter complex
        command = `ffmpeg ${inputArgs} -filter_complex ${filterComplex} -map "[outa]" "${outputFilePath}"`;
      }
      
      console.log(`Executing FFmpeg command: ${command}`);
      
      const { stdout, stderr } = await execPromise(command);
      
      if (stderr) {
        console.log('FFmpeg stderr:', stderr);
      }
      
      if (!fs.existsSync(outputFilePath)) {
        throw new Error('FFmpeg did not create the output file');
      }
      
      return;
    } catch (error) {
      console.error('Error combining audio chunks with FFmpeg:', error);
      throw error;
    }
  }
  
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
      
      // Update the transcript in the sessions table
      const { data, error } = await supabase
        .from('sessions')
        .update({ 
          transcript: result.text
        })
        .eq('id', recordingData.session_id);
        
      if (error) {
        console.error('Error updating transcript in sessions table:', error);
        throw new Error(`Failed to update transcript in sessions table: ${error.message}`);
      } else {
        console.log('Transcript updated in sessions table successfully');
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
