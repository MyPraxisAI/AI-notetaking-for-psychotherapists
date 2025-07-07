// This file should be moved to apps/web/app/api/transcript/[sessionId]/route.ts
// Update all import paths to be correct from the new location
import { NextResponse } from 'next/server';
import { enhanceRouteHandler } from '@kit/next/routes';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { extractClientIp, logAuditLogRead } from '../../../_lib/server/audit-log';
import { createI18nServerInstance } from '~/lib/i18n/i18n.server';

function formatTimestamp(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
}
function formatTimestampMs(ms: number): string {
  return formatTimestamp(ms / 1000);
}

export const GET = enhanceRouteHandler(
  async ({ params, request, user }) => {
    const { sessionId } = params as { sessionId: string };

    if (!sessionId) {
      return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });
    }

    const client = getSupabaseServerClient();
    const { t } = await createI18nServerInstance();

    // Fetch the transcript for the session
    const { data: transcript, error } = await client
      .from('transcripts')
      .select('id, content, content_json')
      .eq('session_id', sessionId)
      .maybeSingle();

    if (error) {
      console.error(`Error fetching transcript for session ${sessionId}:`, error);
      return NextResponse.json({
        success: false,
        content: t('mypraxis:sessionView.transcript.errors.fetchError')
      }, { status: 500 });
    }

    if (!transcript) {
      return NextResponse.json({
        success: true,
        content: null
      });
    }

    // Log the read to audit_log if transcript has an id and userId is provided
    if (transcript.id && user?.id) {
      await logAuditLogRead({
        actingUserId: user.id,
        tableName: 'transcripts',
        recordId: transcript.id,
        ipAddress: extractClientIp(request)
      });
    }

    // If content_json exists, render it to text
    let content: string | null = null;
    if (transcript.content_json) {
      try {
        const contentJson = transcript.content_json as { segments: any[] };
        // Define speaker labels using i18n
        const speakerLabels = {
          therapist: `**${t('mypraxis:sessionView.transcript.speakerLabels.therapist')}**`,
          client: `**${t('mypraxis:sessionView.transcript.speakerLabels.client')}**`
        };
        if (!contentJson.segments || contentJson.segments.length === 0) {
          content = t('mypraxis:sessionView.transcript.errors.noContent');
        } else {
          content = contentJson.segments
            .filter(segment => segment.content.trim().length > 0)
            .map(segment => {
              const startTimeFormatted = formatTimestampMs(segment.start_ms);
              const endTimeFormatted = formatTimestampMs(segment.end_ms);
              const speakerLabel = speakerLabels[segment.speaker as keyof typeof speakerLabels] || segment.speaker;
              return `[${startTimeFormatted}-${endTimeFormatted}] ${speakerLabel}: ${segment.content}  `;
            })
            .join('\n');
        }
      } catch (e) {
        console.error(`Error parsing content_json for transcript of session ${sessionId}:`, e);
        content = transcript.content || t('mypraxis:sessionView.transcript.errors.parsingError');
      }
    } else {
      content = transcript.content || t('mypraxis:sessionView.transcript.errors.noContent');
    }

    return NextResponse.json({
      success: true,
      content
    });
  },
  {
    auth: true,
  }
); 