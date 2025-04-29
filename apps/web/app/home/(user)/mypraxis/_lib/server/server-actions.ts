'use server';

import { z } from 'zod';
import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { SessionSchema } from '../schemas/session';
import { getLogger } from '@kit/shared/logger';
import type { User } from '@supabase/supabase-js';

// Schema for updating a session
const UpdateSessionSchema = SessionSchema.extend({
  id: z.string(),
  clientId: z.string()
});

type UpdateSessionData = z.infer<typeof UpdateSessionSchema>;

/**
 * Server action to update a session and delete related artifacts if content changed
 */
export const updateSessionAction = enhanceAction(
  async function updateSessionAction(data: UpdateSessionData, user: User) {
    const client = getSupabaseServerClient();
    const _logger = await getLogger();
    const _ctx = {
      name: 'update-session',
      sessionId: data.id,
      userId: user?.id
    };

    try {
      // 1. Get the current session data to compare
      const { data: currentSession, error: fetchError } = await client
        .from('sessions')
        .select('note, account_id')
        .eq('id', data.id)
        .single();

      if (fetchError) {
        _logger.error({ ..._ctx, error: fetchError }, 'Failed to fetch current session data');
        throw new Error('Failed to fetch current session data');
      }
      
      // Get the current transcript data from the transcripts table
      const { data: currentTranscript, error: fetchTranscriptError } = await client
        .from('transcripts')
        .select('id, content')
        .eq('session_id', data.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
        
      if (fetchTranscriptError && fetchTranscriptError.code !== 'PGRST116') { // PGRST116 is 'no rows returned' which is fine
        console.error('Failed to fetch transcript data', fetchTranscriptError);
        // Don't throw here, as there might not be a transcript yet
      }

      // 2. Check if content has actually changed
      // Normalize transcript content for comparison (trim and handle empty strings)
      const normalizeContent = (content: string | null | undefined): string | null => {
        if (content === null || content === undefined) return null;
        const trimmed = content.trim();
        return trimmed === '' ? null : trimmed;
      };
      
      const currentTranscriptContent = normalizeContent(currentTranscript?.content);
      const newTranscriptContent = normalizeContent(data.transcript);
      const transcriptChanged = currentTranscriptContent !== newTranscriptContent;
      
      const noteChanged = data.note !== currentSession.note;
      const contentChanged = transcriptChanged || noteChanged;

      // 3. Update the session data (without transcript)
      const { error: updateError } = await client
        .from('sessions')
        .update({
          title: data.title,
          note: data.note
        })
        .eq('id', data.id);

      if (updateError) {
        console.error('Failed to update session', updateError);
        throw new Error('Failed to update session');
      }
      
      // 4. Update or insert transcript if it has changed
      if (transcriptChanged && newTranscriptContent) {
        // Check if a transcript already exists
        if (currentTranscript) {
          // Update existing transcript
          const { error: updateTranscriptError } = await client
            .from('transcripts')
            .update({
              content: newTranscriptContent
            })
            .eq('id', currentTranscript.id);
            
          if (updateTranscriptError) {
            _logger.error({ ..._ctx, error: updateTranscriptError }, 'Failed to update transcript');
            throw new Error('Failed to update transcript');
          }
        } else {
          // Insert new transcript
          const { error: insertTranscriptError } = await client
            .from('transcripts')
            .insert({
              session_id: data.id,
              account_id: currentSession.account_id,
              transcription_model: 'manual',
              content: newTranscriptContent
            });
            
          if (insertTranscriptError) {
            _logger.error({ ..._ctx, error: insertTranscriptError }, 'Failed to insert transcript');
            throw new Error('Failed to insert transcript');
          }
        }
      }

      // 5. If content changed, delete related artifacts
      if (contentChanged) {
        console.log('Content changed, deleting artifacts', {
          transcriptChanged,
          noteChanged
        });

        // Delete session artifacts
        const { error: deleteSessionArtifactsError } = await client
          .from('artifacts')
          .delete()
          .eq('reference_id', data.id)
          .eq('reference_type', 'session');

        if (deleteSessionArtifactsError) {
          console.error('Failed to delete session artifacts', deleteSessionArtifactsError);
          // Don't throw here, as the session update was successful
          // Just log the error and continue
        } else {
          console.log('Successfully deleted session artifacts');
        }
        
        // Also delete client artifacts
        // First get the client ID for this session
        const { data: sessionData, error: sessionError } = await client
          .from('sessions')
          .select('client_id')
          .eq('id', data.id)
          .single();
        
        if (sessionError) {
          console.error('Failed to fetch client ID for session', sessionError);
        } else if (sessionData?.client_id) {
          // Delete all client artifacts
          const { error: deleteClientArtifactsError } = await client
            .from('artifacts')
            .delete()
            .eq('reference_id', sessionData.client_id)
            .eq('reference_type', 'client');
          
          if (deleteClientArtifactsError) {
            console.error('Failed to delete client artifacts', deleteClientArtifactsError);
          } else {
            console.log('Successfully deleted client artifacts');
          }
        }
      } else {
        console.log('Content unchanged, skipping artifact deletion');
      }

      return { success: true };
    } catch (error) {
      console.error('Error in updateSessionAction', error);
      throw error;
    }
  },
  {
    auth: true,
    schema: UpdateSessionSchema
  }
);
