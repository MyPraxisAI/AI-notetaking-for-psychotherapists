'use server';

import { z } from 'zod';
import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getLogger } from '@kit/web-bg-common/logger';
import type { User, SupabaseClient } from '@supabase/supabase-js';
import { createI18nServerInstance } from '~/lib/i18n/i18n.server';

// Schema for fetching transcript content
const GetTranscriptContentSchema = z.object({
  sessionId: z.string(),
  language: z.enum(['en', 'ru']).optional()
});

type GetTranscriptContentData = z.infer<typeof GetTranscriptContentSchema>;
type LanguageType = 'en' | 'ru';

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
 * Server action to fetch transcript content for a session
 */
export const getTranscriptContentAction = enhanceAction(
  async function (data: GetTranscriptContentData, user: User) {
    const client = getSupabaseServerClient();
    const logger = await getLogger();
    const ctx = { name: 'getTranscriptContentAction', sessionId: data.sessionId, userId: user.id };
    
    try {
      logger.info(ctx, 'Fetching transcript content');
      
      // Use the local renderTranscriptContent function
      const content = await renderTranscriptContent(
        client,
        data.sessionId,
        data.language
      );
      
      logger.info(ctx, 'Successfully fetched transcript content');
      
      return { 
        success: true,
        content
      };
    } catch (error) {
      logger.error({ ...ctx, error }, 'Error fetching transcript content');
      throw error;
    }
  },
  {
    auth: true,
    schema: GetTranscriptContentSchema,
  }
);

/**
 * Render transcript content as formatted text
 * @param client Supabase client
 * @param sessionId Session ID
 * @param language Optional language code (default: 'en')
 * @returns Formatted transcript text or error message
 */
async function renderTranscriptContent(
  client: SupabaseClient,
  sessionId: string,
  language: LanguageType = 'en'
): Promise<string | null> {
  // Get i18n instance for translations
  const { t } = await createI18nServerInstance();

  // Fetch the transcript for the session
  const { data: transcript, error } = await client
    .from('transcripts')
    .select('content, content_json')
    .eq('session_id', sessionId)
    .maybeSingle();
  
  if (error) {
    console.error(`Error fetching transcript for session ${sessionId}:`, error);
    return t('mypraxis:sessionView.transcript.errors.fetchError');
  }
  
  if (!transcript) {
    // Return null to indicate transcript doesn't exist
    // This allows the UI to properly handle loading states
    return null;
  }
  
  // If content_json exists, render it to text
  if (transcript.content_json) {
    try {
      const contentJson = transcript.content_json as TranscriptContent;
      
      
      // Define speaker labels using i18n
      const speakerLabels = {
        therapist: t('mypraxis:sessionView.transcript.speakerLabels.therapist'),
        client: t('mypraxis:sessionView.transcript.speakerLabels.client')
      };
      
      // If no segments or empty segments array, return appropriate message
      if (!contentJson.segments || contentJson.segments.length === 0) {
        return t('mypraxis:sessionView.transcript.errors.noContent');
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
      return transcript.content || t('mypraxis:sessionView.transcript.errors.parsingError');
    }
  }
  
  // If no content_json, return the plain content
  return transcript.content || t('mypraxis:sessionView.transcript.errors.noContent');
}
