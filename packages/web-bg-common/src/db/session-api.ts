import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Interface for session metadata
 */
interface SessionMetadata {
  title_initialized?: boolean;
  [key: string]: unknown;
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
    markTitleAsInitialized
  };
}
