/**
 * API functions for recording management
 * This file contains functions for interacting with the recording API endpoints
 */

import { getI18n } from 'react-i18next';
import { STALE_RECORDING_THRESHOLD_MS } from './recording-constants';

export interface StartRecordingOptions {
  clientId: string;
  transcriptionEngine: string;
  standaloneChunks?: boolean;
}

/**
 * Start a new recording session
 * @param options Options for starting the recording
 * @returns The recording ID if successful, null otherwise
 */
export interface ExistingRecordingResponse {
  id: string;
  last_heartbeat_at: string;
  isExistingRecording: boolean;
  isStale?: boolean;
}

export const startRecording = async (options: StartRecordingOptions): Promise<string | ExistingRecordingResponse | null> => {
  try {
    const response = await fetch('/api/recordings/start', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        clientId: options.clientId,
        transcriptionEngine: options.transcriptionEngine,
        standaloneChunks: options.standaloneChunks
      })
    });
    
    // Special handling for 409 Conflict (existing recording)
    if (response.status === 409) {
      const data = await response.json();
      
      // Calculate if the recording is stale based on last heartbeat
      const lastHeartbeat = new Date(data.existingRecording.last_heartbeat_at);
      const now = new Date();
      const timeSinceHeartbeatMs = now.getTime() - lastHeartbeat.getTime();
      
      // Compare directly with the millisecond threshold from constants
      const isStale = timeSinceHeartbeatMs >= STALE_RECORDING_THRESHOLD_MS;
      
      // Return the existing recording information with explicit flags
      return {
        ...data.existingRecording,
        isExistingRecording: true,
        isStale: isStale
      };
    }
    
    if (!response.ok) {
      const errorData = await response.json();
      const t = getI18n().t;
      throw new Error(errorData.error || t('mypraxis:recordingApi.errors.startFailed'));
    }
    
    const data = await response.json();
    return data.recording.id;
  } catch (err) {
    console.error('Error starting recording:', err);
    // Re-throw the error so it can be caught and displayed in the UI
    if (err instanceof Error) {
      throw err;
    } else {
      const t = getI18n().t;
      throw new Error(t('mypraxis:recordingApi.errors.startFailed'));
    }
  }
};

/**
 * Pause an active recording
 * @param recordingId The ID of the recording to pause
 * @returns The response data if successful, null otherwise
 */
interface RecordingResponse {
  id: string;
  status: string;
  session_id?: string;
  created_at: string;
  updated_at: string;
}

export const pauseRecording = async (recordingId: string): Promise<RecordingResponse | null> => {
  if (!recordingId) return null;
  
  try {
    const response = await fetch(`/api/recordings/${recordingId}/pause`, {
      method: 'POST'
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      const t = getI18n().t;
      throw new Error(errorData.error || t('mypraxis:recordingApi.errors.pauseFailed'));
    }
    
    return await response.json();
  } catch (err) {
    console.error('Error pausing recording:', err);
    return null;
  }
};

/**
 * Resume a paused recording
 * @param recordingId The ID of the recording to resume
 * @returns The response data if successful, null otherwise
 */
export const resumeRecording = async (recordingId: string): Promise<RecordingResponse | null> => {
  if (!recordingId) return null;
  
  try {
    const response = await fetch(`/api/recordings/${recordingId}/resume`, {
      method: 'POST'
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      const t = getI18n().t;
      throw new Error(errorData.error || t('mypraxis:recordingApi.errors.resumeFailed'));
    }
    
    return await response.json();
  } catch (err) {
    console.error('Error resuming recording:', err);
    return null;
  }
};

/**
 * Complete a recording and optionally create a session
 * @param recordingId The ID of the recording to complete
 * @returns The response data with session ID if successful, null otherwise
 */
/**
 * Upload an audio chunk for a recording
 * @param recordingId The ID of the recording
 * @param formData FormData containing the audio chunk and metadata
 * @returns The response data if successful
 * @throws Error if the upload fails
 */
export const uploadAudioChunk = async (recordingId: string, formData: FormData): Promise<RecordingResponse> => {
  if (!recordingId) throw new Error('Recording ID is required');
  
  const response = await fetch(`/api/recordings/${recordingId}/chunk`, {
    method: 'POST',
    body: formData
  });
  
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to upload audio chunk');
  }
  
  return await response.json();
};

interface CompleteRecordingResponse {
  recording: RecordingResponse;
  sessionId: string;
}

export const completeRecording = async (recordingId: string): Promise<CompleteRecordingResponse | null> => {
  if (!recordingId) return null;
  
  try {
    const response = await fetch(`/api/recordings/${recordingId}/complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ createSession: true })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      const t = getI18n().t;
      throw new Error(errorData.error || t('mypraxis:recordingApi.errors.completeFailed'));
    }
    
    const data = await response.json();
    
    // The API returns { recording: {...}, sessionId: "..." }
    return {
      ...data,
      // Ensure we have a consistent property name for the session ID
      sessionId: data.sessionId
    };
  } catch (err) {
    console.error('Error completing recording:', err);
    return null;
  }
};

/**
 * Send a heartbeat to keep the recording session alive
 * @param recordingId The ID of the recording to send a heartbeat for
 */
export const sendHeartbeat = async (recordingId: string): Promise<void> => {
  if (!recordingId) return;
  
  try {
    const response = await fetch(`/api/recordings/${recordingId}/heartbeat`, {
      method: 'POST'
    });
    
    if (!response.ok) {
      console.error('Failed to send heartbeat');
    }
  } catch (err) {
    console.error('Heartbeat error:', err);
  }
};

/**
 * Abort a recording session
 * @param recordingId The ID of the recording to abort
 * @returns True if successful, false otherwise
 */
export const abortRecording = async (recordingId: string): Promise<boolean> => {
  if (!recordingId) return false;
  
  try {
    const response = await fetch(`/api/recordings/${recordingId}/abort`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('Failed to abort recording:', errorData.error);
      return false;
    }
    
    return true;
  } catch (err) {
    const t = getI18n().t;
    console.error(t('mypraxis:recordingApi.errors.abortFailed'), err);
    return false;
  }
};

/**
 * Get the current active recording (if any)
 * @returns The recording data if an active recording exists, null otherwise
 */
export interface ActiveRecordingResponse {
  id: string;
  last_heartbeat_at: string;
  status: string;
  client_id: string;
  session_id?: string;
  created_at: string;
  updated_at: string;
  chunks?: Array<{ id: string; created_at: string; [key: string]: unknown }>;
}

export const getActiveRecording = async (): Promise<ActiveRecordingResponse | null> => {
  try {
    const response = await fetch('/api/recordings', {
      method: 'GET'
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      const t = getI18n().t;
      throw new Error(errorData.error || t('mypraxis:recordingApi.errors.fetchFailed'));
    }
    
    const data = await response.json();
    return data.recording;
  } catch (err) {
    console.error('Error fetching active recording:', err);
    return null;
  }
};

// End of file
