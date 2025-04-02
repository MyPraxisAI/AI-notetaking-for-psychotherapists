import { z } from 'zod';

// Session schema for validation
export const SessionSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255, 'Title must be less than 255 characters'),
  transcript: z.string().optional(),
  note: z.string().optional()
});

// Type for session data from UI
export type SessionData = z.infer<typeof SessionSchema>;

// Database record type (snake_case)
export interface SessionRecord {
  id: string;
  created_at: string;
  updated_at: string;
  account_id: string;
  client_id: string;
  transcript: string | null;
  note: string | null;
  title: string | null;
}

// Session with ID for frontend use
export interface SessionWithId extends SessionData {
  id: string;
  clientId: string;
  createdAt: string;
}
