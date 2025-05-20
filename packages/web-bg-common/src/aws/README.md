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
import { queueBackgroundTask } from '@kit/web-bg-common/aws';

await queueBackgroundTask({
  operation: 'audio:transcribe',
  accountId: 'account-123',
  recordingId: 'recording-456',
  priority: 'high',
  idempotencyKey: 'unique-key-789',
});
```

### Queueing an Audio Transcription Task

For convenience, there's a helper function for queueing audio transcription tasks:

```typescript
import { queueAudioTranscribe } from '@kit/web-bg-common/aws';

await queueAudioTranscribe({
  recordingId: 'recording-456',
  accountId: 'account-123',
});
```
