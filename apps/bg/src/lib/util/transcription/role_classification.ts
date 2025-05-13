/**
 * Speaker role classification for therapy session transcripts
 */
import { SupabaseClient } from '@supabase/supabase-js';
import { generateArtifact } from '@kit/web-bg-common';
import { TranscriptionResult } from '../transcription';

/**
 * Classifies speakers in a transcript as therapist or client
 * 
 * @param client - Supabase client for API access
 * @param transcription - The transcription result to classify
 * @returns The modified transcription with classified speaker roles
 */
export async function classifySpeakerRoles(
  client: SupabaseClient,
  transcription: TranscriptionResult
): Promise<TranscriptionResult> {
  // Check if we have content to classify
  if (!transcription.content_json?.segments || transcription.content_json.segments.length === 0) {
    console.warn('No segments to classify in the transcription');
    return transcription;
  }

  // Format the transcript for classification
  const transcript = transcription.content_json.segments
    .map(segment => {
      const startTimeFormatted = formatTimestamp(segment.start_ms / 1000);
      const endTimeFormatted = formatTimestamp(segment.end_ms / 1000);
      return `[${startTimeFormatted}-${endTimeFormatted}] ${segment.speaker}: ${segment.content}`;
    })
    .join('\n');

  // Generate the classification using the session_speaker_roles_classification artifact
  const classificationResultRaw = await generateArtifact(
    client,
    'session_speaker_roles_classification',
    { session_transcript: transcript }
  );

  // Parse the classification result
  const classificationResult = JSON.parse(classificationResultRaw);
  console.log('Speaker roles classification result:', classificationResult);
  
  // Validate the result against expected schema
  if (!validateClassificationResult(classificationResult)) {
    // TODO: retry, or use something similar to pyannotate
    throw new Error('Invalid classification result format');
  }

  // TODO: Save artifact!

  // Update segments with classified roles
  const updatedSegments = transcription.content_json.segments.map(segment => {
    const role = classificationResult[segment.speaker];
    if (!role) {
      throw new Error(`No role found for speaker ${segment.speaker}`);
    }
    
    return {
      ...segment,
      speaker: role
    };
  });

  transcription.content_json.segments = updatedSegments;
  transcription.content_json.classified = true;  

  return transcription;
}

/**
 * Validates that the classification result matches the expected schema
 * 
 * @param result - The parsed classification result to validate
 * @returns True if the result is valid, false otherwise
 */
function validateClassificationResult(result: any): boolean {
  // Check if result is an object
  if (!result || typeof result !== 'object') {
    return false;
  }
  
  // Check if it has both speaker_1 and speaker_2
  if (!result.speaker_1 || !result.speaker_2) {
    return false;
  }
  
  // Validate each speaker role
  const speakerKeys = Object.keys(result).filter(key => key.startsWith('speaker_'));
  for (const key of speakerKeys) {
    const value = result[key];
    if (typeof value !== 'string' || !(value.toLowerCase() === 'therapist' || value.toLowerCase() === 'client')) {
      return false;
    }
  }
  
  // Check for confidence (optional but should be a number between 0-1 if present)
  if ('confidence' in result) {
    const confidence = result.confidence;
    if (typeof confidence !== 'number' || confidence < 0 || confidence > 1) {
      return false;
    }
  }
  
  // Check for reasoning (optional but should be a string if present)
  if ('reasoning' in result) {
    const reasoning = result.reasoning;
    if (typeof reasoning !== 'string') {
      return false;
    }
  }
  
  return true;
}

/**
 * Format a timestamp in seconds to a human-readable format (MM:SS.mmm)
 * 
 * @param seconds - Timestamp in seconds
 * @returns Formatted timestamp string
 */
function formatTimestamp(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toFixed(3).padStart(6, '0')}`;
}