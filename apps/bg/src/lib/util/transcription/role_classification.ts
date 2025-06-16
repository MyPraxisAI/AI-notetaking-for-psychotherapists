/**
 * Speaker role classification for therapy session transcripts
 */
import { SupabaseClient } from '@supabase/supabase-js';
import { generateArtifact, formatTimestampWithMs } from '@kit/web-bg-common';
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
      const startTimeFormatted = formatTimestampWithMs(segment.start_ms / 1000);
      const endTimeFormatted = formatTimestampWithMs(segment.end_ms / 1000);
      return `[${startTimeFormatted}-${endTimeFormatted}] ${segment.speaker}: ${segment.content}`;
    })
    .join('\n');

  // Generate the classification using the session_speaker_roles_classification artifact
  // TODO: save the artifact to db too
  const classificationResultRaw = await generateArtifact(
    client,
    'session_speaker_roles_classification',
    { session_transcript: transcript }
  );

  // Parse the classification result
  const classificationResult = JSON.parse(classificationResultRaw);
  console.log('Speaker roles classification result:', JSON.stringify(classificationResult));
  // Validate the result against expected schema
  if (!validateClassificationResult(classificationResult)) {
    // TODO: retry, or use something similar to pyannotate
    throw new Error('Invalid classification result format');
  }

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
function validateClassificationResult(result: unknown): boolean {
  if (!result || typeof result !== 'object') {
    return false;
  }
  const r = result as Record<string, unknown>;
  if (!r.speaker_1 || !r.speaker_2) {
    return false;
  }
  const speakerKeys = Object.keys(r).filter(key => key.startsWith('speaker_'));
  for (const key of speakerKeys) {
    const value = r[key];
    if (typeof value !== 'string' || !(value.toLowerCase() === 'therapist' || value.toLowerCase() === 'client')) {
      return false;
    }
  }
  if ('confidence' in r) {
    const confidence = r.confidence;
    if (typeof confidence !== 'number' || confidence < 0 || confidence > 1) {
      return false;
    }
  }
  if ('reasoning' in r) {
    const reasoning = r.reasoning;
    if (typeof reasoning !== 'string') {
      return false;
    }
  }
  return true;
}

