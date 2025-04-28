import { SupabaseClient } from '@supabase/supabase-js';
import { AudioProcessingTaskData, TranscriptionChunk } from '../../types';
import { setSupabaseUser } from '../supabase';

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
    try {
      const { accountId, recordingId, standaloneChunks = false } = task;
      
      console.log(`Processing audio recording: accountId=${accountId}, recordingId=${recordingId}`);
      console.log(`Standalone chunks: ${standaloneChunks ? 'Yes' : 'No'}`);
      
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
    const { standaloneChunks = false } = task;
    
    // TODO: Implement actual audio transcription
    // 1. Retrieve the audio recording using accountId and recordingId
    // 2. Use ffmpeg to convert/prepare if needed
    // 3. Process in chunks if standaloneChunks is true
    // 4. Send to transcription service or process locally
    
    // For now, we'll simulate a transcription result
    return {
      text: "This is a simulated transcription of the audio recording.",
      confidence: 0.95,
      processingTime: 2.5,
      timestamp: new Date().toISOString(),
      chunks: standaloneChunks ? [
        { start: 0, end: 30, text: "First chunk of transcription." },
        { start: 30, end: 60, text: "Second chunk of transcription." }
      ] : undefined
    };
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
