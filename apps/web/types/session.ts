export interface SessionMetadata {
  title_initialized?: boolean;
  [key: string]: unknown; // Allow additional properties
}

export interface Session {
  id: string
  date: string
  title: string
  createdAt: string
  meetingLink?: string
  transcript?: {
    content: string
  }
  summary?: {
    therapist: string
    client: string
  }
  notes?: {
    userNote: string
  }
  metadata?: SessionMetadata
}

export interface SessionsState {
  [clientId: string]: {
    [sessionId: string]: Session
  }
}

