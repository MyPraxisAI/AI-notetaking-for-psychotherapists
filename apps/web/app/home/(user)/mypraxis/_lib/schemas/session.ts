import { z } from 'zod';
import type { Transcript } from '@kit/web-bg-common';

// Session metadata schema
export const SessionMetadataSchema = z.object({
  title_initialized: z.boolean().optional()
}).passthrough(); // Allow additional properties

// Session schema for validation
export const SessionSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255, 'Title must be less than 255 characters'),
  transcript: z.custom<Transcript>().optional(),
  note: z.string().optional(),
  metadata: SessionMetadataSchema.optional()
});

// Type for session data from UI
export type SessionData = z.infer<typeof SessionSchema>;

// Session metadata type
export interface SessionMetadata {
  title_initialized?: boolean;
  [key: string]: unknown; // Allow additional properties
}

// Database record type (snake_case)
export interface SessionRecord {
  id: string;
  created_at: string;
  updated_at: string;
  account_id: string;
  client_id: string;
  // transcript field is now in the transcripts table
  note: string | null;
  title: string | null;
  metadata: SessionMetadata | null;
}

// Session with ID for frontend use
export interface SessionWithId extends SessionData {
  id: string;
  clientId: string;
  createdAt: string;
  metadata?: SessionMetadata;
}
