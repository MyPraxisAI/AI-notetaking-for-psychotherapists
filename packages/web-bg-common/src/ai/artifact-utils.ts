/**
 * Utility functions for artifact generation and processing
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { getLogger } from '@kit/shared-common';

/**
 * Interface for transcript segment
 */
interface TranscriptSegment {
  start_ms: number;
  end_ms: number;
  speaker: string;
  content: string;
}

/**
 * Interface for transcript content
 */
interface TranscriptContent {
  segments: TranscriptSegment[];
  classified?: boolean;
}

/**
 * Cleans up markdown code block markers from LLM responses
 * @param content The content to clean up
 * @returns The cleaned content without markdown code block markers
 */
export function cleanupMarkdownCodeBlocks(content: string): string {
  const trimmedContent = content.trim();
  
  // Check if content starts with ```markdown (or other language specifier) and ends with ```
  if (trimmedContent.startsWith('```') && trimmedContent.endsWith('```')) {
    // Find the first newline to skip the opening marker line
    const firstNewline = trimmedContent.indexOf('\n');
    if (firstNewline !== -1) {
      // Find the last ``` marker
      const lastMarkerPos = trimmedContent.lastIndexOf('```');
      
      // Extract the content between the markers
      const innerContent = trimmedContent.substring(firstNewline + 1, lastMarkerPos).trim();
      return innerContent;
    }
  }
  
  // If not wrapped in code blocks or format doesn't match, return original
  return content;
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
  sessionIds: string[]
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
    .select('session_id, content, content_json')
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
          result[sessionId] = 'Transcript has no content.';
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
        result[sessionId] = transcript.content || 'Error parsing transcript content.';
      }
    } else {
      // If no content_json, use the plain content
      result[sessionId] = transcript.content || 'Transcript has no content.';
    }
  }
  
  return result;
}

/**
 * Get transcript content as formatted text for a single session. No localization, useful for LLM prompts. 
 * @param client Supabase client
 * @param sessionId Session ID
 * @returns Formatted transcript text or error message
 */
export async function getTranscriptAsText(
  client: SupabaseClient,
  sessionId: string
): Promise<string> {
  const logger = await getLogger();
  const ctx = {
    name: 'getTranscriptAsText',
    sessionId
  };
  
  const results = await getTranscriptsAsText(client, [sessionId]);
  
  if (!results[sessionId]) {
    logger.warn(ctx, `No transcript found for session ${sessionId}`);
    return 'No transcript available for this session.';
  }
  
  return results[sessionId];
}
