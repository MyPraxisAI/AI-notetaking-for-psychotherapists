import AWS from 'aws-sdk';
import { SQSConfig, SQSMessage } from '../types';

/**
 * Initialize and configure the AWS SQS client
 */
export function initSQSClient(config?: Partial<SQSConfig>): AWS.SQS {
  // Determine if we're running locally with LocalStack
  const isLocalDevelopment = process.env.NODE_ENV === 'development' || 
    (process.env.SQS_QUEUE_URL && (process.env.SQS_QUEUE_URL.includes('localstack') || process.env.SQS_QUEUE_URL.includes('localhost')));

  // Configure AWS
  const awsConfig: AWS.SQS.ClientConfiguration = {
    region: config?.region || process.env.AWS_REGION || 'us-east-1',
    apiVersion: '2012-11-05'
  };

  // Add LocalStack specific configuration if in development
  if (isLocalDevelopment) {
    console.log('Running in local development mode with LocalStack');
    // Set the endpoint to the LocalStack instance
    awsConfig.endpoint = process.env.AWS_ENDPOINT || 'http://localstack:4566';
    // Disable endpoint discovery (important for LocalStack)
    awsConfig.sslEnabled = false;
    awsConfig.s3ForcePathStyle = true;
    // Disable endpoint discovery which can cause issues with LocalStack
    awsConfig.endpointDiscoveryEnabled = false;
    // For local testing
    awsConfig.accessKeyId = process.env.AWS_ACCESS_KEY_ID || 'test';
    awsConfig.secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY || 'test';
  }

  // Create SQS service object
  return new AWS.SQS(awsConfig);
}

interface SQSQueueManagerOptions {
  maxMessages?: number;
  waitTimeSeconds?: number;
  visibilityTimeout?: number;
}

/**
 * SQS Queue Manager
 */
export class SQSQueueManager {
  private sqs: AWS.SQS;
  public queueName: string;
  public queueUrl: string | undefined;
  private isLocalDevelopment: boolean;
  private receiveParams: AWS.SQS.ReceiveMessageRequest;

  /**
   * Create a new SQS Queue Manager
   * @param queueName - The name of the SQS queue
   * @param options - Additional options
   */
  constructor(queueName?: string, options: SQSQueueManagerOptions = {}) {
    this.sqs = initSQSClient();
    this.queueName = queueName || process.env.SQS_QUEUE_NAME || 'mypraxis-background-tasks-dev';
    this.queueUrl = process.env.SQS_QUEUE_URL;
    this.isLocalDevelopment = process.env.NODE_ENV === 'development' || 
      !!(process.env.SQS_QUEUE_URL && (process.env.SQS_QUEUE_URL?.includes('localstack') || process.env.SQS_QUEUE_URL?.includes('localhost')));
    
    // Default receive parameters
    this.receiveParams = {
      MaxNumberOfMessages: options.maxMessages || 10,
      WaitTimeSeconds: options.waitTimeSeconds || 20, // Long polling
      VisibilityTimeout: options.visibilityTimeout || 30, // 30 seconds
      QueueUrl: '' // Will be set before use
    };
  }

  /**
   * Ensures the SQS queue exists, creating it if necessary
   * @returns The queue URL
   */
  async ensureQueueExists(): Promise<string> {
    // First try to get the queue URL if it exists
    try {
      console.log(`Checking if queue '${this.queueName}' exists...`);
      const getQueueUrlParams: AWS.SQS.GetQueueUrlRequest = {
        QueueName: this.queueName
      };
      
      const data = await this.sqs.getQueueUrl(getQueueUrlParams).promise();
      this.queueUrl = data.QueueUrl || '';
      console.log(`Found existing queue: ${this.queueUrl}`);
      return this.queueUrl;
    } catch (error: any) {
      // Queue doesn't exist or other error occurred
      if (error.code !== 'AWS.SimpleQueueService.NonExistentQueue') {
        console.error('Error getting queue URL:', error);
        
        // In production, if we can't get the queue and it's not because it doesn't exist,
        // we should fail rather than trying to create it (which might also fail)
        if (!this.isLocalDevelopment) {
          throw error;
        }
      }
      
      // Only create the queue in development mode
      if (this.isLocalDevelopment) {
        try {
          console.log(`Creating SQS queue '${this.queueName}'...`);
          const createQueueResult = await this.sqs.createQueue({
            QueueName: this.queueName,
            Attributes: {
              // Default queue settings - adjust as needed
              'MessageRetentionPeriod': '345600', // 4 days
              'VisibilityTimeout': '30',          // 30 seconds
              'ReceiveMessageWaitTimeSeconds': '20' // Long polling
            }
          }).promise();
          
          this.queueUrl = createQueueResult.QueueUrl!;
          console.log(`SQS queue created successfully: ${this.queueUrl}`);
          
          // If the queue URL wasn't provided in env vars, use the one we just created
          if (!process.env.SQS_QUEUE_URL) {
            process.env.SQS_QUEUE_URL = this.queueUrl;
          }
          
          return this.queueUrl;
        } catch (createError) {
          console.error('Error creating SQS queue:', createError);
          throw createError;
        }
      } else {
        console.error(`Queue '${this.queueName}' does not exist. In production, queues should be created through infrastructure as code.`);
        throw new Error(`Queue '${this.queueName}' does not exist. In production, queues should be created through infrastructure as code.`);
      }
    }
  }

  /**
   * Delete a message from the queue
   * @param receiptHandle - The receipt handle of the message to delete
   */
  async deleteMessage(receiptHandle: string): Promise<void> {
    const deleteParams: AWS.SQS.DeleteMessageRequest = {
      QueueUrl: this.queueUrl!,
      ReceiptHandle: receiptHandle
    };
    
    try {
      await this.sqs.deleteMessage(deleteParams).promise();
      console.log('Message deleted from queue');
    } catch (error) {
      console.error('Error deleting message:', error);
      throw error;
    }
  }

  /**
   * Send a message to the queue
   * @param messageBody - The message body to send
   * @param messageAttributes - Optional message attributes
   * @returns The send message result
   */
  async sendMessage(messageBody: any, messageAttributes: Record<string, AWS.SQS.MessageAttributeValue> = {}): Promise<AWS.SQS.SendMessageResult> {
    if (!this.queueUrl) {
      await this.ensureQueueExists();
    }

    const params: AWS.SQS.SendMessageRequest = {
      QueueUrl: this.queueUrl!,
      MessageBody: typeof messageBody === 'string' ? messageBody : JSON.stringify(messageBody),
      MessageAttributes: messageAttributes
    };

    try {
      const result = await this.sqs.sendMessage(params).promise();
      console.log(`Message sent successfully: ${result.MessageId}`);
      return result;
    } catch (error) {
      console.error('Error sending message to SQS:', error);
      throw error;
    }
  }

  /**
   * Receive messages from the queue
   * @returns Array of messages
   */
  async receiveMessages(): Promise<SQSMessage[]> {
    if (!this.queueUrl) {
      await this.ensureQueueExists();
    }

    // Ensure we have the latest queue URL
    this.receiveParams.QueueUrl = this.queueUrl || '';
    
    try {
      // Log the queue URL being used for debugging
      console.log(`Polling queue with URL: ${this.queueUrl}`);
      
      // Receive messages from the queue
      const data = await this.sqs.receiveMessage(this.receiveParams).promise();
      
      // Return messages or empty array
      return (data.Messages as SQSMessage[]) || [];
    } catch (error) {
      console.error('Error receiving messages:', error);
      return [];
    }
  }
}
