import dotenv from 'dotenv';
import { SQSQueueManager } from '../lib/sqs';
import { AudioProcessingTaskData } from '../types';

// Load environment variables
dotenv.config();

/**
 * Sends a test message to the SQS queue
 */
async function sendTestMessage(): Promise<void> {
  try {
    console.log('Initializing SQS client...');
    const queueName = process.env.SQS_QUEUE_NAME || 'mypraxis-background-tasks-dev';
    const sqsManager = new SQSQueueManager(queueName);
    
    // Ensure the queue exists before sending a message
    console.log(`Ensuring queue '${queueName}' exists...`);
    await sqsManager.ensureQueueExists();
    
    // Create a test audio transcription message following the AudioProcessingTaskData interface
    const message: AudioProcessingTaskData = {
      id: `task_${Math.floor(Math.random() * 10000)}`,
      type: 'background_task',
      operation: 'audio:transcribe',
      accountId: `acc_${Math.floor(Math.random() * 1000)}`,
      recordingId: `rec_${Math.floor(Math.random() * 10000)}`,
      standaloneChunks: true,
      timestamp: new Date().toISOString()
    };
    
    // Send the message to the queue
    console.log('Sending test message to queue...');
    console.log('Message:', JSON.stringify(message, null, 2));
    
    const result = await sqsManager.sendMessage(message);
    console.log(`Message sent successfully with ID: ${result.MessageId}`);
    
    process.exit(0);
  } catch (error) {
    console.error('Error sending test message:', error);
    process.exit(1);
  }
}

// Execute the function
sendTestMessage();
