import { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseClient, setSupabaseUser, resetSupabaseUser } from './supabase';
import { SQSQueueManager } from './sqs';
import { 
  AudioProcessingTaskData, 
  BaseBackgroundTask, 
  SQSMessage, 
  TranscriptionChunk, 
  AudioTranscription 
} from '../types';

interface MessageProcessorOptions {
  useAdminSupabase?: boolean;
}

interface TranscriptionResult {
  text: string;
  confidence: number;
  processingTime: number;
  timestamp: string;
  chunks: TranscriptionChunk[] | undefined;
}

/**
 * Message Processor class
 */
export class MessageProcessor {
  private supabase: SupabaseClient;
  private options: MessageProcessorOptions;

  /**
   * Create a new message processor
   * @param options - Configuration options
   */
  constructor(options: MessageProcessorOptions = {}) {
    this.supabase = getSupabaseClient(options.useAdminSupabase);
    this.options = options;
  }

  /**
   * Process a single message
   * @param message - The SQS message to process
   * @param sqsManager - The SQS queue manager for deleting messages
   */
  async processMessage(message: SQSMessage, sqsManager: SQSQueueManager): Promise<void> {
    try {
      console.log(`Processing message: ${message.MessageId}`);
      console.log(`Message body: ${message.Body}`);
      
      // Parse the message body
      let body: any;
      try {
        body = JSON.parse(message.Body as string);
      } catch (error) {
        console.error('Error parsing message body:', error);
        await sqsManager.deleteMessage(message.ReceiptHandle);
        return;
      }
      
      // Process the message based on its operation
      if (body.operation) {
        await this.processMessageByOperation(body, message.MessageId);
      } else {
        console.log('Message has no operation field, using default processing');
        await this.defaultProcessing(body, message.MessageId);
      }
      
      console.log('Message processed successfully');
      
      // Delete the message from the queue
      await sqsManager.deleteMessage(message.ReceiptHandle);
    } catch (error: any) {
      console.error(`Error processing message ${message.MessageId}:`, error);
      // Note: Not deleting the message will cause it to become visible again after the visibility timeout
    } finally {
      // Always reset the Supabase user session, even if there was an error
      try {
        await resetSupabaseUser(this.supabase);
      } catch (resetError) {
        console.warn('Error resetting Supabase user session:', resetError);
        // Don't throw this error as it's a cleanup operation
      }
    }
  }

  /**
   * Process a message based on its operation
   * @param body - The parsed message body
   * @param messageId - The SQS message ID
   */
  async processMessageByOperation(body: any, messageId: string): Promise<void> {
    const { operation } = body;
    
    switch (operation) {
      case 'audio:transcribe':
        await this.processAudioTranscription(body as AudioProcessingTaskData, messageId);
        break;
      default:
        console.log(`Unknown operation: ${operation}, using default processing`);
        await this.defaultProcessing(body, messageId);
    }
  }

  /**
   * Process audio transcription message
   * @param body - The parsed message body
   * @param messageId - The SQS message ID
   */
  async processAudioTranscription(body: AudioProcessingTaskData, messageId: string): Promise<void> {
    try {
      const { accountId, recordingId, standaloneChunks = false } = body;
      
      console.log(`Processing audio recording: accountId=${accountId}, recordingId=${recordingId}`);
      console.log(`Standalone chunks: ${standaloneChunks ? 'Yes' : 'No'}`);
      
      // Set the Supabase user session to the accountId for this specific task
      // accountId is guaranteed to exist as it's required in AudioProcessingTaskData
      await setSupabaseUser(this.supabase, accountId);
      console.log(`Set Supabase user session to account ID: ${accountId}`);
      
      // TODO: Implement actual audio transcription
      // 1. Retrieve the audio recording using accountId and recordingId
      // 2. Use ffmpeg to convert/prepare if needed
      // 3. Process in chunks if standaloneChunks is true
      // 4. Send to transcription service or process locally
      
      // For now, we'll simulate a transcription result
      const transcriptionResult: TranscriptionResult = {
        text: "This is a simulated transcription of the audio recording.",
        confidence: 0.95,
        processingTime: 2.5,
        timestamp: new Date().toISOString(),
        chunks: standaloneChunks ? [
          { start: 0, end: 30, text: "First chunk of transcription." },
          { start: 30, end: 60, text: "Second chunk of transcription." }
        ] : undefined
      };
      
      console.log('Transcription completed:', transcriptionResult);
      
      // Store the result in Supabase if available
      if (this.supabase) {
        try {
          // First, get the session_id from the recording
          const { data: recordingData, error: recordingError } = await this.supabase
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
          const { data, error } = await this.supabase
            .from('sessions')
            .update({ 
              transcript: transcriptionResult.text
            })
            .eq('id', recordingData.session_id);
            
          if (error) {
            console.error('Error updating transcript in sessions table:', error);
            throw new Error(`Failed to update transcript in sessions table: ${error.message}`);
          } else {
            console.log('Transcript updated in sessions table successfully');
          }
          
          // Delete all storage objects in the recordings bucket with the prefix {accountId}/{recordingId}
          try {
            const storagePrefix = `${accountId}/${recordingId}`;
            console.log(`Deleting storage objects with prefix: ${storagePrefix}`);
            
            // List all objects with the prefix
            const { data: storageObjects, error: listError } = await this.supabase
              .storage
              .from('recordings')
              .list(storagePrefix);
              
            if (listError) {
              console.error('Error listing storage objects:', listError);
            } else if (storageObjects && storageObjects.length > 0) {
              // Delete each object found
              const filesToDelete = storageObjects.map(obj => `${storagePrefix}/${obj.name}`);
              const { error: deleteError } = await this.supabase
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
          } catch (storageError) {
            console.error('Error in storage operations:', storageError);
          }
          
          // Delete the recording from the database
          const { error: recordingDeleteError } = await this.supabase
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
          console.error('Error in Supabase operation:', error);
        }
      } else {
        console.log('Supabase client not available, skipping database storage');
      }
    } catch (error: any) {
      console.error(`Error processing audio transcription: ${error.message}`);
      throw error; // Rethrow to prevent message deletion
    }
  }

  /**
   * Default message processing
   * @param body - The parsed message body
   * @param messageId - The SQS message ID
   */
  async defaultProcessing(body: BaseBackgroundTask, messageId: string): Promise<void> {
    console.log(`Default processing for message: ${messageId}`);
    console.log('Message content:', body);
    
    // For demonstration, we'll just log the message
    // In a real application, you might have default handling logic
  }
}
