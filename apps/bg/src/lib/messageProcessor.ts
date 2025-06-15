import { SupabaseClient } from '@supabase/supabase-js';
import { SQSMessage } from '../types';
import { AudioTranscriptionProcessor, AudioProcessingTaskData } from './processors/audioTranscriptionProcessor';
import { ArtifactsGenerationProcessor, ArtifactsGenerateTaskData } from './processors/artifactsGenerationProcessor';
import { getBackgroundLogger, createLoggerContext } from './logger';
import { getSupabaseAdminClient } from './supabase';
import { SQSQueueManager } from './sqs';
import { withCurrentAccountId } from '@kit/web-bg-common/db';

interface MessageProcessorOptions {
  useAdminSupabase?: boolean;
}

// Base interface for all message bodies
interface BaseMessageBody {
  accountId: string;
  operation: string;
  priority?: 'high' | 'normal' | 'low';
  idempotencyKey?: string;
}

// Specific message body types for different operations
interface AudioTranscribeMessageBody extends BaseMessageBody {
  operation: 'audio:transcribe';
  recordingId: string;
}

interface ArtifactsGenerateMessageBody extends BaseMessageBody {
  operation: 'artifacts:generate';
  sessionId: string;
}

// Union type of all possible message bodies
type MessageBody = AudioTranscribeMessageBody | ArtifactsGenerateMessageBody;

/**
 * Message Processor class
 */
export class MessageProcessor {
  private options: MessageProcessorOptions;
  private audioTranscriptionProcessor: AudioTranscriptionProcessor;
  private artifactsGenerationProcessor: ArtifactsGenerationProcessor;
  private supabase!: SupabaseClient;
  private loggerPromise = getBackgroundLogger();

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
    const logger = await this.loggerPromise;
    try {
      console.log(`Processing message: ${message.MessageId}`);
      
      // Parse message body
      let body: MessageBody;
      try {
        body = JSON.parse(message.Body as string) as MessageBody;
      } catch (error) {
        logger.error(
          createLoggerContext('message-processor', {
            error,
            messageId: message.MessageId,
            body: message.Body
          }),
          'Failed to parse message body'
        );
        throw error;
      }

      // Validate required fields
      if (!body.accountId) {
        const error = new Error('Message is missing required accountId field');
        logger.error(
          createLoggerContext('message-processor', {
            error,
            messageId: message.MessageId,
            body
          }),
          'Message validation failed'
        );
        throw error;
      }

      // Process message based on operation
      if (!body.operation) {
        const error = new Error(`Message has no operation field. Message ID: ${message.MessageId}`);
        logger.error(
          createLoggerContext('message-processor', {
            error,
            messageId: message.MessageId,
            body
          }),
          'Message validation failed'
        );
        throw error;
      }
      
      // Use the admin client with service role privileges
      const supabase = await getSupabaseAdminClient();
      
      // Process the message within the account context using AsyncLocalStorage
      await withCurrentAccountId(body.accountId, async () => {
        // Process the message based on its operation
        await this.processMessageByOperation(body, message.MessageId, supabase);
      });
      
      console.log('Message processed successfully');
      
      // Delete the message from the queue
      await sqsManager.deleteMessage(message.ReceiptHandle);
    } catch (error: unknown) {
      const logger = await this.loggerPromise;
      logger.error(
        createLoggerContext('message-processor', {
          error,
          messageId: message.MessageId,
          body: message.Body
        }),
        'Failed to process message'
      );
      throw error;
    }
  }

  /**
   * Process a message based on its operation
   * @param body - The parsed message body
   * @param messageId - The SQS message ID
   * @param supabase - The Supabase client to use for this task
   */
  async processMessageByOperation(body: MessageBody, messageId: string, supabase: SupabaseClient): Promise<void> {
    const { operation } = body;
    switch (operation) {
      case 'audio:transcribe': {
        const taskData: AudioProcessingTaskData = {
          id: messageId,
          type: 'background-task',
          timestamp: new Date().toISOString(),
          operation: operation,
          accountId: body.accountId,
          recordingId: body.recordingId,
          priority: body.priority,
          idempotencyKey: body.idempotencyKey
        };
        await this.audioTranscriptionProcessor.process(supabase, taskData, messageId);
        break;
      }
      case 'artifacts:generate': {
        const taskData: ArtifactsGenerateTaskData = {
          operation: 'artifacts:generate',
          accountId: body.accountId,
          sessionId: (body as ArtifactsGenerateMessageBody).sessionId,
          priority: body.priority,
          idempotencyKey: body.idempotencyKey
        };
        await this.artifactsGenerationProcessor.process(supabase, taskData, messageId);
        break;
      }
      default:
        throw new Error(`Unknown operation: ${operation}. Message ID: ${messageId}`);
        // This will cause the message to go to the dead letter queue
    }
  }
}
