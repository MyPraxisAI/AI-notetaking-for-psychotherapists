/**
 * Script to clear all messages from the SQS queue
 * This script will purge the queue if it exists, or create it if it doesn't
 */

// Load environment variables from .env.development
require('dotenv').config({ path: '.env.development' });

const AWS = require('aws-sdk');

// Configure AWS SDK with environment variables
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

// Create SQS service object with endpoint for LocalStack
// When running outside Docker, we need to use localhost instead of localstack
const endpointUrl = (process.env.AWS_ENDPOINT_URL || 'http://localhost:4566').replace('localstack', 'localhost');
console.log(`Using SQS endpoint: ${endpointUrl}`);

const sqs = new AWS.SQS({
  endpoint: endpointUrl,
  apiVersion: '2012-11-05'
});

// Get queue name from environment variable
const queueName = process.env.SQS_QUEUE_NAME;

if (!queueName) {
  console.error('Error: SQS_QUEUE_NAME environment variable is not set');
  process.exit(1);
}

async function clearQueue() {
  try {
    console.log(`Attempting to clear queue: ${queueName}`);
    
    // First, try to get the queue URL
    try {
      const queueData = await sqs.getQueueUrl({ QueueName: queueName }).promise();
      const queueUrl = queueData.QueueUrl;
      
      console.log(`Queue exists. URL: ${queueUrl}`);
      console.log('Purging all messages from the queue...');
      
      // Purge the queue (removes all messages)
      await sqs.purgeQueue({ QueueUrl: queueUrl }).promise();
      console.log('Queue purged successfully');
    } catch (error) {
      // If queue doesn't exist, create it
      if (error.code === 'AWS.SimpleQueueService.NonExistentQueue') {
        console.log(`Queue ${queueName} doesn't exist. Creating it...`);
        
        const createParams = {
          QueueName: queueName,
          Attributes: {
            'DelaySeconds': '0',
            'MessageRetentionPeriod': '86400' // 24 hours
          }
        };
        
        const result = await sqs.createQueue(createParams).promise();
        console.log(`Queue created successfully. URL: ${result.QueueUrl}`);
      } else {
        throw error;
      }
    }
    
    console.log('Operation completed successfully');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

clearQueue();
