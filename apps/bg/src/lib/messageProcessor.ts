import { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseClient, resetSupabaseUser } from './supabase';
import { SQSQueueManager } from './sqs';
import { AudioTranscriptionProcessor } from './processors';
import { 
  AudioProcessingTaskData, 
  BaseBackgroundTask, 
  SQSMessage 
} from '../types';

interface MessageProcessorOptions {
  useAdminSupabase?: boolean;
}

/**
 * Message Processor class
 */
export class MessageProcessor {
  private supabase: SupabaseClient;
  private options: MessageProcessorOptions;
  private audioTranscriptionProcessor: AudioTranscriptionProcessor;

  /**
   * Create a new message processor
   * @param options - Configuration options
   */
  constructor(options: MessageProcessorOptions = {}) {
    this.supabase = getSupabaseClient(options.useAdminSupabase);
    this.options = options;
    this.audioTranscriptionProcessor = new AudioTranscriptionProcessor();
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
    // Delegate to the specialized processor
    await this.audioTranscriptionProcessor.process(this.supabase, body, messageId);
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
