/**
 * Client-side wrappers for server actions
 */
import { getTranscriptContentAction } from './server/transcript-actions';

/**
 * Get transcript content for a session
 * 
 * @param sessionId The session ID to get transcript content for
 * @param language Optional language code (en or ru)
 * @returns The formatted transcript content
 */
export async function getTranscriptContent(sessionId: string, language?: 'en' | 'ru') {
  return getTranscriptContentAction({
    sessionId,
    language
  });
}
