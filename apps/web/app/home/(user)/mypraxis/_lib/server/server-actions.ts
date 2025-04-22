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
    const _logger = getLogger();
    const _ctx = {
      name: 'update-session',
      sessionId: data.id,
      userId: user?.id
    };

    try {
      // 1. Get the current session data to compare
      const { data: currentSession, error: fetchError } = await client
        .from('sessions')
        .select('transcript, note')
        .eq('id', data.id)
        .single();

      if (fetchError) {
        console.error('Failed to fetch current session data', fetchError);
        throw new Error('Failed to fetch current session data');
      }

      // 2. Check if content has actually changed
      const transcriptChanged = data.transcript !== currentSession.transcript;
      const noteChanged = data.note !== currentSession.note;
      const contentChanged = transcriptChanged || noteChanged;

      // 3. Update the session data
      const { error: updateError } = await client
        .from('sessions')
        .update({
          title: data.title,
          transcript: data.transcript,
          note: data.note
        })
        .eq('id', data.id);

      if (updateError) {
        console.error('Failed to update session', updateError);
        throw new Error('Failed to update session');
      }

      // 4. If content changed, delete related artifacts
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
