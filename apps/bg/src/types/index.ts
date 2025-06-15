// Base interface for all background tasks
export interface BaseBackgroundTask {
  id: string;
  type: string;
  timestamp: string;
  operation: string;
  accountId: string;
  sessionId?: string;
  priority?: 'high' | 'normal' | 'low';
  idempotencyKey?: string;
  metadata?: Record<string, unknown>;
}


// Database interfaces
export interface TranscriptionChunk {
  start: number;
  end: number;
  text: string;
}

export interface AudioTranscription {
  id?: string;
  account_id: string;
  recording_id: string;
  transcription?: string;
  confidence?: number;
  chunks?: TranscriptionChunk[];
  standalone_chunks: boolean;
  metadata?: Record<string, unknown>;
  created_at?: string;
  processed_at?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
}

// SQS Message types
export interface SQSMessage {
  MessageId: string;
  ReceiptHandle: string;
  Body: string;
  [key: string]: string | number | boolean | null | undefined;
}

export interface SQSBatchDeleteItem {
  Id: string;
  ReceiptHandle: string;
}

// Configuration interfaces
export interface SupabaseConfig {
  url: string;
  key: string;
}

export interface SQSConfig {
  region: string;
  endpoint?: string;
  queueName: string;
  queueUrl?: string;
}

export interface AppConfig {
  port: number;
  supabase: SupabaseConfig;
  sqs: SQSConfig;
}
