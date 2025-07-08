import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getLogger } from '@kit/shared-common/logger';
import { logAuditLogRead, extractClientIp } from '@kit/audit-log';
import { SessionWithId } from '../../../home/(user)/mypraxis/_lib/schemas/session';
import { enhanceRouteHandler } from '@kit/next/routes';
import { createI18nServerInstance } from '~/lib/i18n/i18n.server';

async function fetchFormattedTranscript(client: any, sessionId: string, user: any, request: any, logger: any) {
  const { t } = await createI18nServerInstance();
  function formatTimestamp(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  }
  function formatTimestampMs(ms: number): string {
    return formatTimestamp(ms / 1000);
  }
  const { data: transcript, error: transcriptError } = await client
    .from('transcripts')
    .select('id, content, content_json')
    .eq('session_id', sessionId)
    .maybeSingle();
  let transcriptContent: string | null = null;
  if (transcriptError) {
    logger.error({ userId: user.id, error: transcriptError }, 'Error fetching transcript');
    transcriptContent = t('mypraxis:sessionView.transcript.errors.fetchError');
  } else if (!transcript) {
    transcriptContent = null;
  } else {
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
    if (transcript.content_json) {
      try {
        const contentJson = transcript.content_json as { segments: any[] };
        // Define speaker labels using i18n
        const speakerLabels = {
          therapist: `**${t('mypraxis:sessionView.transcript.speakerLabels.therapist')}**`,
          client: `**${t('mypraxis:sessionView.transcript.speakerLabels.client')}**`
        };
        if (!contentJson.segments || contentJson.segments.length === 0) {
          transcriptContent = t('mypraxis:sessionView.transcript.errors.noContent');
        } else {
          transcriptContent = contentJson.segments
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
        logger.error({ userId: user.id, error: e }, 'Error parsing content_json for transcript');
        transcriptContent = transcript.content || t('mypraxis:sessionView.transcript.errors.parsingError');
      }
    } else {
      transcriptContent = transcript.content || t('mypraxis:sessionView.transcript.errors.noContent');
    }
  }
  return transcriptContent;
}

export const GET = enhanceRouteHandler(
    async ({ params, request, user }) => {
  const logger = await getLogger();
  const { sessionId } = params;

  try {
    if (!sessionId) {
      return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });
    }
    const client = getSupabaseServerClient();
    // Fetch session data
    const { data: sessionData, error: sessionError } = await client
      .from('sessions')
      .select('*')
      .eq('id', sessionId)
      .maybeSingle();
    if (sessionError) {
      logger.error({ userId: user.id, error: sessionError }, 'Error fetching session');
      return NextResponse.json({ error: 'Error fetching session' }, { status: 500 });
    }
    if (!sessionData) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }
    // Log the read for this session (sessions table)
    await logAuditLogRead({
      actingUserId: user.id,
      tableName: 'sessions',
      recordId: sessionData.id,
      ipAddress: extractClientIp(request)
    });
    // Fetch transcript content using the helper
    const transcriptContent = await fetchFormattedTranscript(client, sessionId, user, request, logger);
    // Transform to SessionWithId format
    const result: SessionWithId = {
      id: sessionData.id,
      clientId: sessionData.client_id,
      title: sessionData.title || '',
      note: sessionData.note || undefined,
      transcript: transcriptContent || undefined,
      createdAt: sessionData.created_at,
    };
    return NextResponse.json(result);
  } catch (error) {
    logger.error({ userId: user?.id, error }, 'Unhandled error in GET /api/sessions/[sessionId]');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}, { auth: true }); 