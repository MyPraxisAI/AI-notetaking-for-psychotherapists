import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { getLogger } from '@kit/shared/logger';

// Initialize logger
const logger = await getLogger();

/**
 * Get the SQS client instance
 * This is a function to ensure we get fresh credentials each time
 */
function getSQSClient() {
  return new SQSClient({
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    },
  });
}

/**
 * Send a message to an SQS queue
 * 
 * @param queueUrl The URL of the SQS queue
 * @param messageBody The message body to send
 * @param delaySeconds Optional delay in seconds before the message becomes visible
 * @param messageGroupId Optional message group ID for FIFO queues
 * @param messageDeduplicationId Optional deduplication ID for FIFO queues
 * @returns The message ID if successful
 */
export async function sendSQSMessage({
  queueUrl,
  messageBody,
  delaySeconds = 0,
  messageGroupId,
  messageDeduplicationId,
}: {
  queueUrl: string;
  messageBody: Record<string, any>;
  delaySeconds?: number;
  messageGroupId?: string;
  messageDeduplicationId?: string;
}): Promise<string | undefined> {
  const ctx = {
    name: 'send-sqs-message',
    queueUrl,
  };

  try {
    // Create the message parameters
    const params: any = {
      QueueUrl: queueUrl,
      MessageBody: JSON.stringify(messageBody),
      DelaySeconds: delaySeconds,
    };

    // Add FIFO queue parameters if provided
    if (messageGroupId) {
      params.MessageGroupId = messageGroupId;
    }

    if (messageDeduplicationId) {
      params.MessageDeduplicationId = messageDeduplicationId;
    }

    // Send the message
    logger.info({ ...ctx, messageSize: JSON.stringify(messageBody).length }, 'Sending message to SQS queue');
    
    const sqsClient = getSQSClient();
    const command = new SendMessageCommand(params);
    const response = await sqsClient.send(command);
    
    logger.info({ ...ctx, messageId: response.MessageId }, 'Successfully sent message to SQS queue');
    
    return response.MessageId;
  } catch (error) {
    logger.error({ ...ctx, error }, 'Failed to send message to SQS queue');
    throw error;
  }
}

/**
 * Background task operation types
 */
export type BackgroundTaskOperation = 
  // Audio processing operations
  | 'audio:transcribe'
  // Add other operation types as needed

/**
 * Base background task data interface
 */
interface BaseBackgroundTaskData {
  accountId: string;
  operation: BackgroundTaskOperation;
  priority?: 'high' | 'normal' | 'low';
  idempotencyKey?: string;
}

/**
 * Audio processing task data
 */
export interface AudioProcessingTaskData extends BaseBackgroundTaskData {
  operation: 'audio:transcribe';
  accountId: string;
  recordingId: string;
  standaloneChunks?: boolean;
}


/**
 * Union type of all background task data types
 */
export type BackgroundTaskData = 
  | AudioProcessingTaskData;

/**
 * Queue a background task
 * 
 * @param taskData The task data
 * @returns The message ID if successful
 */
export async function queueBackgroundTask(taskData: BackgroundTaskData): Promise<string | undefined> {
  const queueUrl = process.env.BACKGROUND_TASKS_QUEUE_URL;
  
  if (!queueUrl) {
    throw new Error('BACKGROUND_TASKS_QUEUE_URL environment variable is not set');
  }
  
  const ctx = {
    name: 'queue-background-task',
    operation: taskData.operation,
    accountId: taskData.accountId,
  };
  
  try {
    // Check if this is a FIFO queue (ends with .fifo)
    const isFifoQueue = queueUrl.endsWith('.fifo');
    
    // Prepare message parameters
    const messageParams: {
      queueUrl: string;
      messageBody: Record<string, any>;
      messageGroupId?: string;
      messageDeduplicationId?: string;
      delaySeconds?: number;
    } = {
      queueUrl,
      messageBody: {
        ...taskData,
        timestamp: new Date().toISOString(),
      },
    };
    
    // Set delay based on priority if specified
    if (taskData.priority === 'low') {
      messageParams.delaySeconds = 300; // 5 minutes
    } else if (taskData.priority === 'high') {
      messageParams.delaySeconds = 0; // Immediate
    }
    
    // Add FIFO queue parameters if needed
    if (isFifoQueue) {
      // Use idempotencyKey as deduplication ID if provided, otherwise generate one
      messageParams.messageDeduplicationId = taskData.idempotencyKey || 
        `${taskData.operation}-${taskData.accountId}-${Date.now()}`;
      
      // Use accountId as message group ID to ensure messages for the same account are processed in order
      messageParams.messageGroupId = taskData.accountId;
    }
    
    logger.info(ctx, 'Queueing background task');
    return sendSQSMessage(messageParams);
  } catch (error) {
    logger.error({ ...ctx, error }, 'Failed to queue background task');
    throw error;
  }
}

/**
 * Queue an audio transcription task
 */
export async function queueAudioTranscribe({
  recordingId,
  accountId,
  standaloneChunks = false,
}: {
  recordingId: string;
  accountId: string;
  standaloneChunks?: boolean;
}): Promise<string | undefined> {
  return queueBackgroundTask({
    operation: 'audio:transcribe',
    accountId,
    recordingId,
    standaloneChunks,
    priority: 'normal',
    idempotencyKey: `transcribe-${recordingId}`,
  });
}
