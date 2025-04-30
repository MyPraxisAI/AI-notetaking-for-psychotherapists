import AWS from 'aws-sdk';

// Configure AWS SDK for LocalStack
const sqs = new AWS.SQS({
  endpoint: process.env.AWS_ENDPOINT || 'http://localhost:4566',
  region: process.env.AWS_REGION || 'us-east-1',
  accessKeyId: 'test',
  secretAccessKey: 'test',
});

async function deleteQueues() {
  try {
    // List all queues
    console.log('Listing all SQS queues...');
    const queues = await sqs.listQueues({}).promise();
    
    if (!queues.QueueUrls || queues.QueueUrls.length === 0) {
      console.log('No queues found');
      return;
    }
    
    console.log('Found queues:', queues.QueueUrls);
    
    // Delete each queue
    for (const queueUrl of queues.QueueUrls) {
      console.log(`Deleting queue: ${queueUrl}`);
      await sqs.deleteQueue({ QueueUrl: queueUrl }).promise();
      console.log(`Queue deleted: ${queueUrl}`);
    }
    
    console.log('All queues deleted successfully');
  } catch (error) {
    console.error('Error deleting queues:', error);
  }
}

// Execute the function
deleteQueues();
