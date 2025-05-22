/**
 * Media recording utilities for handling audio recording
 * This file contains functions for initializing and managing MediaRecorder
 */

import { MutableRefObject } from "react";
import { AudioChunk } from "./audio-upload";

export interface MediaRecorderOptions {
  echoCancellation?: boolean;
  noiseSuppression?: boolean;
  autoGainControl?: boolean;
  sampleRate?: number;
  channelCount?: number;
  audioBitsPerSecond?: number;
}

export interface MediaRecorderHandlers {
  onError: (error: Error) => void;
  onDataAvailable: (event: BlobEvent, metadata: {
    chunkNumber: number;
    startTime: number;
    endTime: number;
    recordingStartTime: number;
    currentTimeMs: number;
  }) => void;
}

/**
 * Setup a MediaRecorder instance with optimal settings for audio recording
 * @param options Options for the MediaRecorder
 * @param handlers Event handlers for the MediaRecorder
 * @returns A promise that resolves to the MediaRecorder instance or null if setup fails
 */
export const setupMediaRecorder = async (
  options: MediaRecorderOptions = {},
  handlers: MediaRecorderHandlers
): Promise<MediaRecorder | null> => {
  try {
    // Request audio with specific constraints for better quality
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: options.echoCancellation ?? true,
        noiseSuppression: options.noiseSuppression ?? true,
        autoGainControl: options.autoGainControl ?? true,
        sampleRate: options.sampleRate ?? 48000,
        channelCount: options.channelCount ?? 1 // Mono for voice clarity
      }
    });
    
    // Find the best supported mime type
    const mimeTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/ogg'];
    const selectedMimeType = mimeTypes.find(type => MediaRecorder.isTypeSupported(type)) || 'audio/webm';
    
    console.log(`Using MIME type: ${selectedMimeType} for recording`);
    
    // Create the MediaRecorder with optimal settings
    const recorder = new MediaRecorder(stream, { 
      mimeType: selectedMimeType,
      audioBitsPerSecond: options.audioBitsPerSecond ?? 128000 // 128 kbps for good quality voice
    });
    
    // Add error handler
    recorder.onerror = (event) => {
      console.error('MediaRecorder error:', event);
      handlers.onError(new Error('Recording error occurred'));
    };
    
    console.log('MediaRecorder initialized successfully');
    return recorder;
  } catch (err) {
    console.error('Error accessing microphone:', err);
    handlers.onError(err instanceof Error ? err : new Error('Failed to access microphone'));
    return null;
  }
};

/**
 * Configure the MediaRecorder to handle audio chunks
 * @param recorder The MediaRecorder instance
 * @param recordingId The ID of the current recording
 * @param audioChunks Reference to the array of audio chunks
 * @param handlers Event handlers for the MediaRecorder
 * @returns The recording start time in milliseconds
 */
export const configureMediaRecorderForChunks = (
  recorder: MediaRecorder,
  recordingId: string,
  audioChunks: MutableRefObject<AudioChunk[]>,
  handlers: MediaRecorderHandlers
): number => {
  // Initialize chunk tracking variables
  let chunkNumber = 1;
  
  // Use performance.now() for precise timing
  const recordingStartTime = performance.now();
  let chunkStartTimeMs = recordingStartTime;
  
  // Update the ondataavailable handler
  recorder.ondataavailable = async (event) => {
    // Get precise current time using performance.now()
    const currentTimeMs = performance.now();
    
    // Calculate seconds since recording started (as floating point for precision)
    const chunkStartTimeSec = (chunkStartTimeMs - recordingStartTime) / 1000;
    const chunkEndTimeSec = (currentTimeMs - recordingStartTime) / 1000;
    
    console.log('ondataavailable event triggered', {
      dataSize: event.data.size,
      recordingId,
      chunkNumber,
      chunkStartTimeSec,
      chunkEndTimeSec
    });
    
    if (event.data.size > 0) {
      // Add to audio chunks array with metadata
      const chunkData = {
        blob: event.data,
        number: chunkNumber,
        startTime: chunkStartTimeSec,
        endTime: chunkEndTimeSec
      };
      audioChunks.current.push(chunkData);
      
      // Calculate duration in seconds (floating point)
      const durationSec = chunkEndTimeSec - chunkStartTimeSec;
      
      console.log(`Processing chunk ${chunkNumber}: ${chunkStartTimeSec.toFixed(3)}s to ${chunkEndTimeSec.toFixed(3)}s (duration: ${durationSec.toFixed(3)}s) with recordingId: ${recordingId}`);
      
      // Call the handler with the event and metadata
      handlers.onDataAvailable(event, {
        chunkNumber,
        startTime: chunkStartTimeSec,
        endTime: chunkEndTimeSec,
        recordingStartTime,
        currentTimeMs
      });
      
      // Prepare for next chunk
      chunkNumber++;
      chunkStartTimeMs = currentTimeMs;
      console.log(`Next chunk will start at ${(chunkStartTimeMs - recordingStartTime) / 1000}s`);
    }
  };
  
  return recordingStartTime;
};

/**
 * Start the MediaRecorder with the specified chunk duration
 * @param recorder The MediaRecorder instance
 * @param chunkDurationMs The duration of each chunk in milliseconds
 */
export const startMediaRecorder = (
  recorder: MediaRecorder,
  chunkDurationMs: number = 4 * 60 * 1000 // Default to 4 minutes
): void => {
  console.log(`Starting MediaRecorder with ${chunkDurationMs / 1000}s chunks`);
  
  // Start the MediaRecorder with the specified chunk duration
  recorder.start(chunkDurationMs);
  
  // Request data immediately to test the ondataavailable handler
  setTimeout(() => {
    if (recorder && recorder.state === 'recording') {
      console.log('Requesting initial data from MediaRecorder');
      recorder.requestData();
    }
  }, 1000);
};

/**
 * Stop the MediaRecorder and get the final data
 * @param recorder The MediaRecorder instance
 */
export const stopMediaRecorder = (recorder: MediaRecorder): void => {
  if (recorder && recorder.state !== 'inactive') {
    recorder.requestData(); // Get any remaining data
    recorder.stop();
  }
};

/**
 * Pause the MediaRecorder
 * @param recorder The MediaRecorder instance
 */
export const pauseMediaRecorder = (recorder: MediaRecorder): void => {
  if (recorder && recorder.state === 'recording') {
    recorder.requestData(); // Get any remaining data
    recorder.pause();
  }
};

/**
 * Resume the MediaRecorder
 * @param recorder The MediaRecorder instance
 */
export const resumeMediaRecorder = (recorder: MediaRecorder): void => {
  if (recorder && recorder.state === 'paused') {
    recorder.resume();
  }
};

/**
 * Clean up the MediaRecorder and its associated stream
 * @param recorder The MediaRecorder instance
 */
export const cleanupMediaRecorder = (recorder: MediaRecorder): void => {
  if (recorder) {
    if (recorder.state !== 'inactive') {
      recorder.stop();
    }
    
    // Stop all tracks in the stream
    const stream = recorder.stream;
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
  }
};
