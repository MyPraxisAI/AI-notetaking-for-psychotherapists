import { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseAdminClient } from './supabase';
import { SQSQueueManager } from './sqs';
import { AudioTranscriptionProcessor } from './processors';
import { withCurrentAccountId } from '@kit/web-bg-common/db';
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
  private options: MessageProcessorOptions;
  private audioTranscriptionProcessor: AudioTranscriptionProcessor;

  /**
   * Create a new message processor
   * @param options - Configuration options
   */
  constructor(options: MessageProcessorOptions = {}) {
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
      
      // Parse the message body first
      let body: any;
      try {
        body = JSON.parse(message.Body as string);
      } catch (error) {
        console.error('Error parsing message body:', error);
        await sqsManager.deleteMessage(message.ReceiptHandle);
        return;
      }
      
      // Ensure the message contains an accountId
      if (!body.accountId) {
        throw new Error('Message is missing required accountId field');
      }
      
      // Use the admin client with service role privileges
      const supabase = await getSupabaseAdminClient();
      
      // Process the message within the account context using AsyncLocalStorage
      await withCurrentAccountId(body.accountId, async () => {
        // Process the message based on its operation
        if (body.operation) {
          await this.processMessageByOperation(body, message.MessageId, supabase);
        } else {
          console.log('Message has no operation field, using default processing');
          await this.defaultProcessing(body, message.MessageId, supabase);
        }
      });
      
      console.log('Message processed successfully');
      
      // Delete the message from the queue
      await sqsManager.deleteMessage(message.ReceiptHandle);
    } catch (error: any) {
      console.error(`Error processing message ${message.MessageId}:`, error);
      // Note: Not deleting the message will cause it to become visible again after the visibility timeout
    }
  }

  /**
   * Process a message based on its operation
   * @param body - The parsed message body
   * @param messageId - The SQS message ID
   * @param supabase - The Supabase client to use for this task
   */
  async processMessageByOperation(body: any, messageId: string, supabase: SupabaseClient): Promise<void> {
    const { operation } = body;
    
    switch (operation) {
      case 'audio:transcribe':
        await this.processAudioTranscription(body as AudioProcessingTaskData, messageId, supabase);
        break;
      default:
        console.log(`Unknown operation: ${operation}, using default processing`);
        await this.defaultProcessing(body, messageId, supabase);
    }
  }

  /**
   * Process audio transcription message
   * @param body - The parsed message body
   * @param messageId - The SQS message ID
   * @param supabase - The Supabase client to use for this task
   */
  async processAudioTranscription(body: AudioProcessingTaskData, messageId: string, supabase: SupabaseClient): Promise<void> {
    // Delegate to the specialized processor
    await this.audioTranscriptionProcessor.process(supabase, body, messageId);
  }

  /**
   * Default message processing
   * @param body - The parsed message body
   * @param messageId - The SQS message ID
   * @param supabase - The Supabase client to use for this task
   */
  async defaultProcessing(body: BaseBackgroundTask, messageId: string, supabase: SupabaseClient): Promise<void> {
    console.log(`Default processing for message: ${messageId}`);
    console.log('Message content:', body);
    
    // For demonstration, we'll just log the message
    // In a real application, you might have default handling logic
  }
}
