/**
 * API functions for recording management
 * This file contains functions for interacting with the recording API endpoints
 */

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
export const startRecording = async (options: StartRecordingOptions): Promise<string | null> => {
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
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to start recording');
    }
    
    const data = await response.json();
    return data.recording.id;
  } catch (err) {
    console.error('Error starting recording:', err);
    return null;
  }
};

/**
 * Pause an active recording
 * @param recordingId The ID of the recording to pause
 * @returns The response data if successful, null otherwise
 */
export const pauseRecording = async (recordingId: string): Promise<any | null> => {
  if (!recordingId) return null;
  
  try {
    const response = await fetch(`/api/recordings/${recordingId}/pause`, {
      method: 'POST'
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to pause recording');
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
export const resumeRecording = async (recordingId: string): Promise<any | null> => {
  if (!recordingId) return null;
  
  try {
    const response = await fetch(`/api/recordings/${recordingId}/resume`, {
      method: 'POST'
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to resume recording');
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
export const uploadAudioChunk = async (recordingId: string, formData: FormData): Promise<any> => {
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

export const completeRecording = async (recordingId: string): Promise<{ recording: any; sessionId: string } | null> => {
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
      throw new Error(errorData.error || 'Failed to complete recording');
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

// End of file
