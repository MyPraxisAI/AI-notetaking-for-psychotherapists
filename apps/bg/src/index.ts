import * as dotenv from 'dotenv';
import * as http from 'http';
import { SQSQueueManager } from './lib/sqs';
import { MessageProcessor } from './lib/messageProcessor';
import { SQSMessage } from './types';

// Load environment variables
dotenv.config();

// Create a simple health check server for Fargate
const server = http.createServer((req: http.IncomingMessage, res: http.ServerResponse) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'healthy', timestamp: new Date().toISOString() }));
  } else {
    res.writeHead(404);
    res.end();
  }
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`Health check server listening on port ${PORT}`);
});

/**
 * Main application class
 */
class Application {
  private sqsManager: SQSQueueManager;
  private messageProcessor: MessageProcessor;
  private pollingInterval: number;
  private isPolling: boolean;

  constructor() {
    // Initialize SQS queue manager
    this.sqsManager = new SQSQueueManager(process.env.SQS_QUEUE_NAME);
    
    // Initialize message processor
    this.messageProcessor = new MessageProcessor({
      useAdminSupabase: true // Use admin privileges for background processing
    });
    
    // Polling interval in milliseconds
    this.pollingInterval = parseInt(process.env.POLLING_INTERVAL || '1000', 10);
    
    // Flag to track if polling is active
    this.isPolling = false;
  }
  
  /**
   * Initialize the application
   */
  async initialize(): Promise<boolean> {
    try {
      // Ensure the queue exists
      await this.sqsManager.ensureQueueExists();
      
      // Log startup information
      console.log(`Starting SQS poller for queue: ${this.sqsManager.queueName}`);
            
      // Start polling for messages
      this.startPolling();
      
      return true;
    } catch (error) {
      console.error('Failed to initialize application:', error);
      throw error;
    }
  }
  
  /**
   * Start polling for messages
   */
  startPolling(): void {
    if (this.isPolling) return;
    
    this.isPolling = true;
    this.pollQueue();
  }
  
  /**
   * Stop polling for messages
   */
  stopPolling(): void {
    this.isPolling = false;
  }
  
  /**
   * Poll the queue for messages
   */
  async pollQueue(): Promise<void> {
    if (!this.isPolling) return;
    
    try {
      // Receive messages from the queue
      const messages: SQSMessage[] = await this.sqsManager.receiveMessages();
      
      // Process messages if any were received
      if (messages.length > 0) {
        console.log(`Received ${messages.length} messages`);
        
        // Process each message
        const processPromises = messages.map(message => 
          this.messageProcessor.processMessage(message, this.sqsManager)
        );
        
        await Promise.all(processPromises);
      } else {
        console.log('No messages received');
      }
    } catch (error) {
      console.error('Error polling queue:', error);
    }
    
    // Schedule next poll
    setTimeout(() => this.pollQueue(), this.pollingInterval);
  }
}

// Create and start the application
const app = new Application();

console.log('Starting background worker application...');
app.initialize().catch(err => {
  console.error('Failed to initialize application:', err);
  process.exit(1);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down...');
  app.stopPolling();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('Shutting down...');
  app.stopPolling();
  process.exit(0);
});
