import AWS from 'aws-sdk';
import { SQSConfig, SQSMessage } from '../types';

/**
 * Initialize and configure the AWS SQS client
 */
export function initSQSClient(config?: Partial<SQSConfig>): AWS.SQS {
  // Determine if we're running locally with LocalStack
  const isLocalDevelopment = process.env.NODE_ENV === 'development';

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
  
  // Initialization tracking
  private initialized = false;
  private initializationPromise: Promise<void> | null = null;

  /**
   * Create a new SQS Queue Manager
   * @param queueName - The name of the SQS queue
   * @param options - Additional options
   */
  constructor(queueName?: string, options: SQSQueueManagerOptions = {}) {
    this.sqs = initSQSClient();
    
    // Use BACKGROUND_TASKS_QUEUE_URL directly if available
    if (process.env.BACKGROUND_TASKS_QUEUE_URL) {
      this.queueUrl = process.env.BACKGROUND_TASKS_QUEUE_URL;
      // Extract queue name from URL if needed
      const urlParts = this.queueUrl.split('/');
      this.queueName = queueName || urlParts[urlParts.length - 1] || 'mypraxis-background-tasks-dev';
    } else {
      // Fallback to queue name if URL is not available
      this.queueName = queueName || process.env.SQS_QUEUE_NAME || 'mypraxis-background-tasks-dev';
    }
    
    this.isLocalDevelopment = process.env.NODE_ENV === 'development' || 
      !!(process.env.AWS_ENDPOINT && (process.env.AWS_ENDPOINT?.includes('localstack') || process.env.AWS_ENDPOINT?.includes('localhost')));
    
    // Default receive parameters
    this.receiveParams = {
      MaxNumberOfMessages: options.maxMessages || 10,
      WaitTimeSeconds: options.waitTimeSeconds || 20, // Long polling
      VisibilityTimeout: options.visibilityTimeout || 30, // 30 seconds
      QueueUrl: this.queueUrl || '' // Set from constructor if available
    };
  }

  /**
   * Ensures the SQS Queue Manager is initialized
   * This method is called internally by other methods that need the queue to be ready
   */
  private async ensureInitialized(): Promise<void> {
    // If already initialized, return immediately
    if (this.initialized) return;
    
    // If initialization is in progress, wait for it to complete
    if (this.initializationPromise) {
      return this.initializationPromise;
    }
    
    // Start initialization
    console.log('Starting SQS Queue Manager initialization...');
    this.initializationPromise = this.ensureQueueExists().then(() => {
      this.initialized = true;
      console.log('SQS Queue Manager initialization complete');
    }).catch(err => {
      // Reset initialization promise on error so it can be retried
      this.initializationPromise = null;
      console.error('SQS Queue Manager initialization failed:', err);
      throw err;
    });
    
    return this.initializationPromise;
  }

  /**
   * Helper method to get the ARN of a queue from its URL
   */
  private async getQueueArn(queueUrl: string): Promise<string> {
    const result = await this.sqs.getQueueAttributes({
      QueueUrl: queueUrl,
      AttributeNames: ['QueueArn']
    }).promise();
    
    return result.Attributes!.QueueArn;
  }

  /**
   * Ensures the queue exists, creating it if necessary
   */
  async ensureQueueExists(): Promise<void> {
    try {
      console.log(`Checking if queue '${this.queueName}' exists...`);
      const getQueueUrlParams: AWS.SQS.GetQueueUrlRequest = {
        QueueName: this.queueName
      };
      
      const data = await this.sqs.getQueueUrl(getQueueUrlParams).promise();
      this.queueUrl = data.QueueUrl || '';
      console.log(`Found existing queue: ${this.queueUrl}`);
      return;
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
          // First, create a Dead Letter Queue
          const dlqName = `${this.queueName}-dlq`;
          console.log(`Creating Dead Letter Queue '${dlqName}'...`);
          const dlqResult = await this.sqs.createQueue({
            QueueName: dlqName,
            Attributes: {
              'MessageRetentionPeriod': '1209600', // 14 days for the DLQ
            }
          }).promise();

          const dlqUrl = dlqResult.QueueUrl!;
          console.log(`DLQ created successfully: ${dlqUrl}`);
          
          // Get the ARN of the DLQ
          const dlqArn = await this.getQueueArn(dlqUrl);
          console.log(`DLQ ARN: ${dlqArn}`);
          
          // Now create the main queue with a redrive policy
          console.log(`Creating main SQS queue '${this.queueName}'...`);
          const createQueueResult = await this.sqs.createQueue({
            QueueName: this.queueName,
            Attributes: {
              // Default queue settings - adjust as needed
              'MessageRetentionPeriod': '345600', // 4 days
              'VisibilityTimeout': '120',         // 2 minutes - increased for audio processing
              'ReceiveMessageWaitTimeSeconds': '20', // Long polling
              'RedrivePolicy': JSON.stringify({
                deadLetterTargetArn: dlqArn,
                maxReceiveCount: '5'  // Maximum number of retries before sending to DLQ
              })
            }
          }).promise();
          
          // Set the queue URL from the create result
          this.queueUrl = createQueueResult.QueueUrl!;
          console.log(`SQS queue created successfully: ${this.queueUrl}`);
          
          // Store the queue URL for future reference
          console.log(`Queue URL: ${this.queueUrl}`);
          
          return;
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
    // Ensure the queue is initialized before deleting a message
    await this.ensureInitialized();
    
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
    // Ensure the queue is initialized before sending a message
    await this.ensureInitialized();
    
    const params: AWS.SQS.SendMessageRequest = {
      QueueUrl: this.queueUrl!,
      MessageBody: typeof messageBody === 'string' ? messageBody : JSON.stringify(messageBody),
      MessageAttributes: messageAttributes
    };

    try {
      const result = await this.sqs.sendMessage(params).promise();
      console.log(`Message sent to queue: ${result.MessageId}`);
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
    // Ensure the queue is initialized before receiving messages
    await this.ensureInitialized();
    
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
