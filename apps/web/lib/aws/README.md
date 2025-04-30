# Background Task System

This module provides a generic background task system using AWS SQS for asynchronous processing of various operations in the MyPraxis application.

## Overview

The background task system allows you to queue different types of operations for asynchronous processing, including:

- Audio processing (transcription, combining)
- Notifications
- Emails
- Report generation

## Configuration

To use the background task system, you need to set the following environment variables:

```
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key_id
AWS_SECRET_ACCESS_KEY=your_secret_access_key
BACKGROUND_TASKS_QUEUE_URL=https://sqs.us-east-1.amazonaws.com/123456789012/mypraxis-background-tasks-dev
```

## Usage

### Queueing a Background Task

You can queue a background task using the `queueBackgroundTask` function:

```typescript
import { queueBackgroundTask } from 'lib/aws/sqs';

await queueBackgroundTask({
  operation: 'audio:process',
  accountId: 'account-id',
  recordingId: 'recording-id',
  standalone: true,
  priority: 'high',
  idempotencyKey: 'unique-key',
});
```

### Audio Processing

For audio processing, you can use the following helper functions:

```typescript
import { queueAudioTranscribe } from 'lib/aws/sqs';

// Audio transcription only
await queueAudioTranscribe({
  recordingId: 'recording-id',
  accountId: 'account-id',
});
```

## Task Types

The system supports the following task types:

### Audio Processing Tasks

- `audio:transcribe`: Transcribe audio chunks

## Priority Levels

Tasks can have the following priority levels:

- `high`: Processed immediately
- `normal`: Default priority
- `low`: Delayed processing (5 minutes)

## FIFO Queues

The system automatically detects if you're using a FIFO queue (URL ends with `.fifo`) and sets the appropriate parameters:

- `MessageGroupId`: Set to the account ID to ensure messages for the same account are processed in order
- `MessageDeduplicationId`: Set to a unique ID based on the operation and task data

## Worker Implementation

To process these tasks, you'll need to implement a worker that:

1. Polls the SQS queue for messages
2. Processes the messages based on the `operation` field
3. Deletes the messages from the queue when processing is complete

The worker should handle different task types and implement the appropriate processing logic for each.
