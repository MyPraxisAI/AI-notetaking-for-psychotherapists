import { SupabaseClient } from '@supabase/supabase-js';
import { LanguageType } from '../types';
import { formatTimestampMs } from '../utils/time';

/**
 * Interface for session metadata
 */
interface SessionMetadata {
  title_initialized?: boolean;
  [key: string]: unknown;
}

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
 * Interface for session with content
 */
export interface SessionWithContent {
  note: string | null;
  transcript: { id: string } | null;
}

/**
 * Get session content including transcript and note
 * @param client Supabase client
 * @param sessionId Session ID
 * @returns Session content or null if not found
 */
export async function getSessionContent(
  client: SupabaseClient,
  sessionId: string
): Promise<SessionWithContent | null> {
  const { data } = await client
    .from('sessions')
    .select(`
      note,
      transcript:transcripts!left (id)
    `)
    .eq('id', sessionId)
    .maybeSingle<SessionWithContent>();

  return data;
}

/**
 * Create a session API instance
 * @param client Supabase client
 * @returns Session API methods
 */
// Using formatTimestampMs from utils/time.ts

/**
 * Render transcript content as formatted text
 * @param client Supabase client
 * @param sessionId Session ID
 * @param language Optional language code (default: 'en')
 * @returns Formatted transcript text or error message
 */
export async function renderTranscriptContent(
  client: SupabaseClient,
  sessionId: string,
  language: LanguageType = 'en'
): Promise<string> {
  // Fetch the transcript for the session
  const { data: transcript, error } = await client
    .from('transcripts')
    .select('content, content_json')
    .eq('session_id', sessionId)
    .maybeSingle();
  
  if (error) {
    console.error(`Error fetching transcript for session ${sessionId}:`, error);
    return 'Error fetching transcript data.';
  }
  
  if (!transcript) {
    return 'No transcript available for this session.';
  }
  
  // If content_json exists, render it to text
  if (transcript.content_json) {
    try {
      const contentJson = transcript.content_json as TranscriptContent;
      
      // Define speaker labels based on language
      const speakerLabels = {
        therapist: language === 'ru' ? 'Терапевт' : 'Therapist',
        client: language === 'ru' ? 'Клиент' : 'Client'
      };
      
      // If no segments or empty segments array, return appropriate message
      if (!contentJson.segments || contentJson.segments.length === 0) {
        return 'Transcript has no content.';
      }
      
      // Format each segment with timestamp and proper speaker label
      return contentJson.segments
        .filter(segment => segment.content.trim().length > 0)
        .map(segment => {
          const startTimeFormatted = formatTimestampMs(segment.start_ms);
          const endTimeFormatted = formatTimestampMs(segment.end_ms);
          const speakerLabel = speakerLabels[segment.speaker as keyof typeof speakerLabels] || segment.speaker;
          
          return `[${startTimeFormatted}-${endTimeFormatted}] ${speakerLabel}: ${segment.content}`;
        })
        .join('\n');
    } catch (e) {
      console.error(`Error parsing content_json for transcript of session ${sessionId}:`, e);
      // Fall back to plain content if JSON parsing fails
      return transcript.content || 'Error parsing transcript content.';
    }
  }
  
  // If no content_json, return the plain content
  return transcript.content || 'Transcript has no content.';
}

export function createSessionApi(client: SupabaseClient) {
  /**
   * Update session metadata
   * @param sessionId The ID of the session to update
   * @param metadata The metadata to update or add
   * @returns Success status
   */
  async function updateMetadata(sessionId: string, metadata: SessionMetadata): Promise<boolean> {
    try {
      const { error } = await client
        .rpc('update_session_metadata', {
          p_session_id: sessionId,
          p_metadata: metadata
        });
      
      if (error) {
        console.error('Failed to update session metadata', error);
        return false;
      }
      
      return true;
    } catch (error) {
      console.error(`Error updating metadata for session ${sessionId}:`, error);
      return false;
    }
  }

  /**
   * Set the title_initialized flag in session metadata
   * @param sessionId The ID of the session to update
   * @returns Success status
   */
  async function markTitleAsInitialized(sessionId: string): Promise<boolean> {
    return updateMetadata(sessionId, { title_initialized: true });
  }

  // Return the API methods
  return {
    updateMetadata,
    markTitleAsInitialized,
    renderTranscriptContent: (sessionId: string, language?: LanguageType) => 
      renderTranscriptContent(client, sessionId, language)
  };
}
