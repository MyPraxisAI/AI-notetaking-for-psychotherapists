import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { getLogger } from '../logger';

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
  messageBody: Record<string, unknown>;
  delaySeconds?: number;
  messageGroupId?: string;
  messageDeduplicationId?: string;
}): Promise<string | undefined> {
  const logger = await getLogger();
  const ctx = {
    name: 'send-sqs-message',
    queueUrl,
  };

  try {
    // Create the message parameters
    const params: {
      QueueUrl: string;
      MessageBody: string;
      DelaySeconds: number;
      MessageGroupId?: string;
      MessageDeduplicationId?: string;
    } = {
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
  // Artifact operations
  | 'artifacts:generate'
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
}

/**
 * Artifacts generation task data
 */
export interface ArtifactsGenerateTaskData extends BaseBackgroundTaskData {
  operation: 'artifacts:generate';
  accountId: string;
  sessionId: string;
}

/**
 * Union type of all background task data types
 */
export type BackgroundTaskData = 
  | AudioProcessingTaskData
  | ArtifactsGenerateTaskData;

/**
 * Queue a background task
 * 
 * @param taskData The task data
 * @returns The message ID if successful
 */
export async function queueBackgroundTask(taskData: BackgroundTaskData): Promise<string | undefined> {
  const logger = await getLogger();
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
      messageBody: Record<string, unknown>;
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
}: {
  recordingId: string;
  accountId: string;
}): Promise<string | undefined> {
  return queueBackgroundTask({
    operation: 'audio:transcribe',
    accountId,
    recordingId,
    priority: 'normal',
    idempotencyKey: `transcribe-${recordingId}`,
  });
}

/**
 * Queue an artifacts generation task
 * This is triggered when artifacts need to be generated or regenerated for a session
 */
export async function queueArtifactsGenerate({
  sessionId,
  accountId,
}: {
  sessionId: string;
  accountId: string;
}): Promise<string | undefined> {
  return queueBackgroundTask({
    operation: 'artifacts:generate',
    accountId,
    sessionId,
    priority: 'normal',
    idempotencyKey: `artifacts-generate-${sessionId}`,
  });
}
