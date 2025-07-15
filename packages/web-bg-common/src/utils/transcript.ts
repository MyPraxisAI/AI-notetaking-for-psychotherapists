import type { Transcript } from '../types/types';

/**
 * Returns true if the transcript exists and has at least one segment.
 */
export function transcriptExists(transcript: Transcript | null): boolean {
  return !!(transcript && Array.isArray(transcript.segments) && transcript.segments.length > 0);
} 