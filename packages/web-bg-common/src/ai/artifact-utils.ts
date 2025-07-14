/**
 * Utility functions for artifact generation and processing
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { getLogger } from '@kit/shared-common';
import type { TranscriptSegment } from '../types/types';

/**
 * Interface for transcript content
 */
interface TranscriptContent {
  segments: TranscriptSegment[];
  classified?: boolean;
}

/**
 * Cleans up LLM responses by removing matching markdown code blocks, bold/italic, and stray quotes from the start and end only if they match.
 * @param text The LLM response to clean
 * @returns The cleaned response
 */
export function cleanLLMResponse(text: string): string {
  if (!text) return text;
  let cleaned = text.trim();

  // Remove matching code block markers (```lang\n ... ``` or just ``` ... ```)
  if (/^```[a-z]*\n?/i.test(cleaned) && /```$/i.test(cleaned)) {
    cleaned = cleaned.replace(/^```[a-z]*\n?/i, '');
    cleaned = cleaned.replace(/```$/i, '');
    cleaned = cleaned.trim();
  }

  // Remove matching bold/italic markdown (**text**, *text*, __text__, _text_) only if they match at start and end
  const markdownPairs = [
    ['**', '**'],
    ['*', '*'],
    ['__', '__'],
    ['_', '_'],
  ];
  for (const [start, end] of markdownPairs) {
    if (cleaned.startsWith(start) && cleaned.endsWith(end) && cleaned.length > start.length + end.length) {
      cleaned = cleaned.slice(start.length, cleaned.length - end.length).trim();
      break;
    }
  }

  // Remove matching leading/trailing quotes/backticks only if they match
  const quotePairs = [
    ['"', '"'],
    ['"', ''],
    ['"', ''],
    ["'", "'"],
    ['`', '`'],
  ];
  for (const [start, end] of quotePairs) {
    if (cleaned.startsWith(start) && cleaned.endsWith(end) && cleaned.length > start.length + end.length) {
      cleaned = cleaned.slice(start.length, cleaned.length - end.length).trim();
      break;
    }
  }

  return cleaned.trim();
}

/**
 * Format a timestamp in seconds to a human-readable format (MM:SS)
 * 
 * @param seconds - Time in seconds
 * @returns Formatted timestamp
 */
function formatTimestamp(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
}

/**
 * Format a timestamp in milliseconds to a human-readable format (MM:SS)
 * 
 * @param ms - Time in milliseconds
 * @returns Formatted timestamp
 */
function formatTimestampMs(ms: number): string {
  return formatTimestamp(ms / 1000);
}

/**
 * Get transcript content as formatted text for multiple sessions. No localization, useful for LLM prompts. 
 * @param client Supabase client
 * @param sessionIds Array of session IDs
 * @returns Object mapping session IDs to their transcript text
 */
export async function getTranscriptsAsText(
  client: SupabaseClient,
  sessionIds: string[],
  messageForEmpty: boolean = true
): Promise<Record<string, string>> {
  if (sessionIds.length === 0) {
    return {};
  }
  
  const logger = await getLogger();
  const ctx = {
    name: 'getTranscriptsAsText',
    sessionIds: sessionIds.join(',')
  };
  
  // Fetch the transcripts for the sessions
  const { data: transcripts, error } = await client
    .from('transcripts')
    .select('session_id, content_json')
    .in('session_id', sessionIds);
  
  if (error) {
    logger.error(ctx, 'Error fetching transcripts:', error);
    return {};
  }
  
  if (!transcripts || transcripts.length === 0) {
    return {};
  }
  
  // Create a map of session IDs to their formatted transcript text
  const result: Record<string, string> = {};
  
  // Process each transcript
  for (const transcript of transcripts) {
    const sessionId = transcript.session_id;
  
    // If content_json exists, render it to text
    if (transcript.content_json) {
      try {
        const contentJson = transcript.content_json as TranscriptContent;
        
        // Define speaker labels
        const speakerLabels = {
          therapist: 'Therapist',
          client: 'Client'
        };
        
        // If no segments or empty segments array, use appropriate message
        if (!contentJson.segments || contentJson.segments.length === 0) {
          result[sessionId] = messageForEmpty ? 'Transcript has no content.' : '';
          continue;
        }
        
        // Format each segment with timestamp and proper speaker label
        result[sessionId] = contentJson.segments
          .filter(segment => segment.content.trim().length > 0)
          .map(segment => {
            const startTimeFormatted = formatTimestampMs(segment.start_ms);
            const endTimeFormatted = formatTimestampMs(segment.end_ms);
            const speakerLabel = speakerLabels[segment.speaker as keyof typeof speakerLabels] || segment.speaker;
            
            return `[${startTimeFormatted}-${endTimeFormatted}] ${speakerLabel}: ${segment.content}`;
          })
          .join('\n');
      } catch (e) {
        logger.error(ctx, `Error parsing content_json for transcript of session ${sessionId}:`, e);
        // Fall back to plain content if JSON parsing fails
        result[sessionId] = transcript.content || (messageForEmpty ? 'Error parsing transcript content.' : '');
      }
    } else {
      // If no content_json, use the plain content
      result[sessionId] = transcript.content || (messageForEmpty ? 'Transcript has no content.' : '');
    }
  }
  
  return result;
}

/**
 * Get transcript content as formatted text for a single session. No localization, useful for LLM prompts. 
 * @param client Supabase client
 * @param sessionId Session ID
 * @param messageForEmpty Boolean indicating whether to return a fallback message for empty transcript. Default: true.
 * @returns Formatted transcript text or error message
 */
export async function getTranscriptAsText(
  client: SupabaseClient,
  sessionId: string,
  messageForEmpty: boolean = true
): Promise<string> {
  const logger = await getLogger();
  const ctx = {
    name: 'getTranscriptAsText',
    sessionId
  };
  
  const results = await getTranscriptsAsText(client, [sessionId], messageForEmpty);
  
  if (!results[sessionId]) {
    logger.warn(ctx, `No transcript found for session ${sessionId}`);
    return messageForEmpty ? 'No transcript available for this session.' : '';
  }
  
  return results[sessionId];
}
