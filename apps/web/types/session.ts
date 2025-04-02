export interface Session {
  id: string
  date: string
  title: string
  createdAt: string
  meetingLink?: string
  transcript?: {
    content: Array<{
      speaker: string
      text: string
    }>
  }
  summary?: {
    therapist: string
    client: string
  }
  notes?: {
    userNote: string
    lastModified: string
  }
}

export interface SessionsState {
  [clientId: string]: {
    [sessionId: string]: Session
  }
}

