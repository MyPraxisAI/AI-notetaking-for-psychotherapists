import { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseAdminClient } from './supabase';
import { SQSQueueManager } from './sqs';
import { AudioTranscriptionProcessor, AudioProcessingTaskData, ArtifactsGenerationProcessor, ArtifactsGenerateTaskData } from './processors';
import { withCurrentAccountId } from '@kit/web-bg-common/db';
import { getBackgroundLogger, createLoggerContext } from './logger';
import { 
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
  private artifactsGenerationProcessor: ArtifactsGenerationProcessor;

  /**
   * Create a new message processor
   * @param options - Configuration options
   */
  constructor(options: MessageProcessorOptions = {}) {
    this.options = options;
    this.audioTranscriptionProcessor = new AudioTranscriptionProcessor();
    this.artifactsGenerationProcessor = new ArtifactsGenerationProcessor();
  }

  /**
   * Process a single message
   * @param message - The SQS message to process
   * @param sqsManager - The SQS queue manager for deleting messages
   */
  async processMessage(message: SQSMessage, sqsManager: SQSQueueManager): Promise<void> {
    const logger = await getBackgroundLogger();
    try {
      console.log(`Processing message: ${message.MessageId}`);
      console.log(`Message body: ${message.Body}`);
      
      // Parse the message body first
      let body: any;
      try {
        body = JSON.parse(message.Body as string);
      } catch (error) {
        logger.error(
          createLoggerContext('message-processor', {
            error,
            messageId: message.MessageId,
            messageBody: message.Body,
            receiptHandle: message.ReceiptHandle,
            errorType: 'message_parse_error'
          }),
          'Error parsing message body'
        );
        await sqsManager.deleteMessage(message.ReceiptHandle);
        return;
      }
      
      // Ensure the message contains an accountId
      if (!body.accountId) {
        const error = new Error('Message is missing required accountId field');
        logger.error(
          createLoggerContext('message-processor', {
            error,
            messageId: message.MessageId,
            messageBody: message.Body,
            receiptHandle: message.ReceiptHandle,
            errorType: 'missing_account_id'
          }),
          'Message is missing required accountId field'
        );
        throw error;
      }
      
      // Use the admin client with service role privileges
      const supabase = await getSupabaseAdminClient();
      
      // Process the message within the account context using AsyncLocalStorage
      await withCurrentAccountId(body.accountId, async () => {
        // Process the message based on its operation
        if (!body.operation) {
          const error = new Error(`Message has no operation field. Message ID: ${message.MessageId}`);
          logger.error(
            createLoggerContext('message-processor', {
              error,
              messageId: message.MessageId,
              messageBody: message.Body,
              receiptHandle: message.ReceiptHandle,
              errorType: 'missing_operation'
            }),
            'Message has no operation field'
          );
          throw error;
          // This will cause the message to go to the dead letter queue
        }
        await this.processMessageByOperation(body, message.MessageId, supabase);
      });
      
      console.log('Message processed successfully');
      
      // Delete the message from the queue
      await sqsManager.deleteMessage(message.ReceiptHandle);
    } catch (error: any) {
      logger.error(
        createLoggerContext('message-processor', {
          error,
          messageId: message.MessageId,
          messageBody: message.Body,
          receiptHandle: message.ReceiptHandle,
          errorType: 'message_processing_error'
        }),
        `Error processing message ${message.MessageId}`
      );
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
        await this.audioTranscriptionProcessor.process(supabase, body as AudioProcessingTaskData, messageId);
        break;
      case 'artifacts:generate':
        await this.artifactsGenerationProcessor.process(supabase, body as ArtifactsGenerateTaskData, messageId);
        break;
      default:
        throw new Error(`Unknown operation: ${operation}. Message ID: ${messageId}`);
        // This will cause the message to go to the dead letter queue
    }
  }
}
