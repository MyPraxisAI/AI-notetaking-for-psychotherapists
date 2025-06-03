import { MutableRefObject } from 'react';
import * as RecordingAPI from './recording-api';

// Define interface for file import options
export interface FileImportOptions {
  recordingId: string;
  onProgress?: (progress: number, totalChunks: number) => void;
  onError?: (error: Error) => void;
}

// Define the interface for audio chunks
export interface AudioChunk {
  blob: Blob;
  number: number;
  startTime: number;
  endTime: number;
}

/**
 * Helper function to upload all pending audio chunks
 * @param explicitRecordingId The recording ID to associate with the chunks
 * @param audioChunks Reference to the array of audio chunks to upload
 * @param isUploading Reference to a boolean lock to prevent concurrent uploads
 * @returns Promise<boolean> indicating if all chunks were uploaded successfully
 */
export const uploadAudioChunks = async (
  explicitRecordingId: string,
  audioChunks: MutableRefObject<AudioChunk[]>,
  isUploading: MutableRefObject<boolean>
): Promise<boolean> => {
  // Check if another upload process is already running
  if (isUploading.current) {
    console.log('Upload already in progress, skipping this request');
    return false;
  }
  
  try {
    // Set the lock to prevent concurrent executions
    isUploading.current = true;
    
    let successCount = 0;
    let failCount = 0;
    
    // Process chunks in a loop until the array is empty or we hit a maximum number of attempts
    // This ensures we catch new chunks added during the upload process
    const MAX_ITERATIONS = 100; // Safety limit to prevent infinite loops
    let iterations = 0;
    
    console.log(`Starting upload loop for recording: ${explicitRecordingId}`);
    
    while (audioChunks.current.length > 0 && iterations < MAX_ITERATIONS) {
      iterations++;
      
      // Get the first chunk in the array
      const chunk = audioChunks.current[0];
      
      // Safety check - this shouldn't happen but TypeScript needs it
      if (!chunk) {
        console.warn('Found undefined chunk at index 0, skipping');
        audioChunks.current.shift(); // Remove the invalid entry
        continue;
      }
      
      console.log(`Processing chunk ${chunk.number} (iteration ${iterations})`);
      
      try {
        // Attempt to upload the chunk
        const result = await uploadAudioChunkWithId(
          chunk.blob,
          chunk.number,
          chunk.startTime,
          chunk.endTime,
          explicitRecordingId
        );
        
        // If successful, remove the chunk from the array
        if (result) {
          successCount++;
          audioChunks.current.shift(); // Remove the first element
          console.log(`Chunk ${chunk.number} uploaded successfully and removed from queue`);
        } else {
          failCount++;
          console.log(`Chunk ${chunk.number} upload failed, waiting before retry...`);
          // Wait a bit before retrying the same chunk
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (error) {
        failCount++;
        console.error(`Error uploading chunk ${chunk.number}:`, error);
        // Wait a bit before retrying the same chunk
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    if (iterations >= MAX_ITERATIONS) {
      console.warn(`Reached maximum iterations (${MAX_ITERATIONS}) while uploading chunks`);
    }
    
    console.log(`Upload results: ${successCount} succeeded, ${failCount} failed. Remaining chunks: ${audioChunks.current.length}`);
    return failCount === 0 && audioChunks.current.length === 0;
  } finally {
    // Release the lock when done, regardless of success or failure
    isUploading.current = false;
  }
};

/**
 * Helper function to upload a single chunk with explicit recordingId
 * @param blob The audio blob to upload
 * @param chunkNumber The sequence number of the chunk
 * @param startTime The start time of the chunk in seconds
 * @param endTime The end time of the chunk in seconds
 * @param explicitRecordingId The recording ID to associate with the chunk
 * @returns Promise<boolean> indicating if the upload was successful
 */
export const uploadAudioChunkWithId = async (
  blob: Blob, 
  chunkNumber: number, 
  startTime: number, // A floating-point value in seconds
  endTime: number,   // A floating-point value in seconds
  explicitRecordingId: string
): Promise<boolean> => {
  console.log(`Uploading chunk ${chunkNumber} with explicit recordingId: ${explicitRecordingId}`, {
    startTime: startTime.toFixed(3),
    endTime: endTime.toFixed(3),
    duration: (endTime - startTime).toFixed(3)
  });
  
  try {
    // Create a FormData object to send the audio chunk
    const formData = new FormData();
    
    // Determine file extension based on MIME type
    const fileExtension = blob.type.includes('webm') ? 'webm' : 
                         blob.type.includes('ogg') ? 'ogg' : 
                         'webm'; // Default to webm if unknown
    
    // Add the audio blob with a properly formatted filename and correct extension
    formData.append('audio', blob, `chunk-${chunkNumber.toString().padStart(3, '0')}.${fileExtension}`);
    
    // Add metadata - ensure these are properly set
    formData.append('chunkNumber', chunkNumber.toString());
    formData.append('startTime', startTime.toString());
    formData.append('endTime', endTime.toString());
    formData.append('mimeType', blob.type);
    formData.append('size', blob.size.toString());
    
    // Double-check the FormData values
    console.log('FormData values:', {
      chunkNumber: formData.get('chunkNumber'),
      startTime: formData.get('startTime'),
      endTime: formData.get('endTime'),
      mimeType: formData.get('mimeType'),
      size: formData.get('size')
    });
    
    // Log the request details
    const url = `/api/recordings/${explicitRecordingId}/chunk`;
    console.log(`Sending chunk to ${url}`, {
      chunkNumber,
      size: blob.size,
      startTime,
      endTime,
      mimeType: blob.type
    });
    
    // Send the chunk to the server
    const response = await fetch(url, {
      method: 'POST',
      body: formData
    });
    
    console.log(`Server response for chunk ${chunkNumber}:`, {
      status: response.status,
      statusText: response.statusText
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to upload audio chunk');
    }
    
    console.log(`Chunk ${chunkNumber} uploaded successfully`);
    return true;
  } catch (err) {
    console.error(`Chunk ${chunkNumber} upload error:`, err);
    return false;
  }
};

/**
 * Process and upload an audio file in chunks
 * @param file The audio file to process
 * @param options Options for the file import process
 * @returns Promise with the session ID if successful
 */
export const processAudioFile = async (
  file: File,
  options: FileImportOptions
): Promise<{ sessionId?: string }> => {
  try {
    const { recordingId, onProgress, onError } = options;
    
    // Calculate chunks needed without creating them all at once
    const MAX_CHUNK_SIZE = 4.2 * 1024 * 1024; // 4.5mb is the Vercel upload limit
    const totalChunks = Math.ceil(file.size / MAX_CHUNK_SIZE);
    console.log(`Will process file in ${totalChunks} chunks`);
    
    // Estimate total duration based on file size (rough estimate)
    // For MP3, ~1MB ≈ 1 minute of audio at 128kbps
    const estimatedTotalDuration = (file.size / (128 * 1024)) * 8;
    const durationPerChunk = estimatedTotalDuration / totalChunks;
    
    // Process and upload one chunk at a time to reduce memory usage
    for (let i = 0; i < totalChunks; i++) {
      const start = i * MAX_CHUNK_SIZE;
      const end = Math.min(start + MAX_CHUNK_SIZE, file.size);
      const chunk = file.slice(start, end, file.type);
      
      const chunkNumber = i + 1;
      const startTime = i * durationPerChunk;
      const endTime = (i + 1) * durationPerChunk;
      
      const formData = new FormData();
      formData.append('audio', chunk, `chunk-${chunkNumber}.${file.name.split('.').pop()}`);
      formData.append('chunkNumber', chunkNumber.toString());
      formData.append('startTime', startTime.toString());
      formData.append('endTime', endTime.toString());
      formData.append('mimeType', file.type);
      
      console.log(`Uploading chunk ${chunkNumber}/${totalChunks}, size: ${(chunk.size / (1024 * 1024)).toFixed(2)}MB`);
      
      try {
        await RecordingAPI.uploadAudioChunk(recordingId, formData);
      } catch (err) {
        const error = err instanceof Error ? err : new Error(`Failed to upload chunk ${chunkNumber}`);
        if (onError) onError(error);
        throw error;
      }
      
      // Report progress if callback provided
      if (onProgress) {
        onProgress(chunkNumber, totalChunks);
      }
    }
    
    // Complete the recording
    const result = await RecordingAPI.completeRecording(recordingId);
    
    if (!result) {
      const error = new Error('Failed to complete recording');
      if (onError) onError(error);
      throw error;
    }
    return {
      sessionId: result.sessionId
    };
  } catch (err) {
    console.error('Error processing audio file:', err);
    throw err;
  }
};
