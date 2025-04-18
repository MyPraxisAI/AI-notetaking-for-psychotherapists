'use server';

import { z } from 'zod';
import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { SessionSchema } from '../schemas/session';
import { getLogger } from '@kit/shared/logger';

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
  async function updateSessionAction(data: UpdateSessionData, user: any) {
    const client = getSupabaseServerClient();
    const logger = getLogger();
    const ctx = {
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

        const { error: deleteError } = await client
          .from('artifacts')
          .delete()
          .eq('reference_id', data.id)
          .eq('reference_type', 'session');

        if (deleteError) {
          console.error('Failed to delete artifacts', deleteError);
          // Don't throw here, as the session update was successful
          // Just log the error and continue
        } else {
          console.log('Successfully deleted artifacts');
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
