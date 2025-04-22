'use server';

import { z } from 'zod';
import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { SessionSchema } from '../schemas/session';
import { getLogger } from '@kit/shared/logger';
import { generateContent } from '@/lib/utils/artifacts';
import type { User, SupabaseClient } from '@supabase/supabase-js';

// Schema for updating a session
const UpdateSessionSchema = SessionSchema.extend({
  id: z.string(),
  clientId: z.string()
});

type UpdateSessionData = z.infer<typeof UpdateSessionSchema>;

/**
 * Generate a title for a session if it hasn't been initialized yet
 * @param client Supabase client
 * @param sessionId Session ID
 * @param transcript Session transcript
 * @param note Session note
 * @returns Success status
 */
async function generateSessionTitle(
  client: SupabaseClient,
  sessionId: string,
  transcript: string | null,
  note: string | null
): Promise<boolean> {
  try {
    // Get the current session metadata and title
    const { data: sessionWithMetadata, error: metadataError } = await client
      .from('sessions')
      .select('metadata, title')
      .eq('id', sessionId)
      .single();

    if (metadataError) {
      console.error('Failed to fetch session metadata', metadataError);
      return false;
    }

    // Check if title has been initialized using the metadata flag
    const titleInitialized = sessionWithMetadata.metadata?.title_initialized === true;
    
    // Early return if title is already initialized
    if (titleInitialized || !transcript && !note) {
      return false;
    }
    
    console.log('Generating title for session');
    
    // Generate title using the session_title prompt
    const generatedTitle = await generateContent(
      { type: 'name', value: 'session_title' },
      {
        session_transcript: transcript || '',
        session_note: note || ''
      }
    );
    
    // Clean up the title by removing surrounding quotes and trimming whitespace
    const cleanedTitle = generatedTitle.trim().replace(/^"(.*)"$/, '$1');
    
    // First update the session title
    const { error: titleUpdateError } = await client
      .from('sessions')
      .update({
        title: cleanedTitle
      })
      .eq('id', sessionId);
      
    if (titleUpdateError) {
      console.error('Failed to update session title', titleUpdateError);
      return false;
    }
    
    // Then update the session metadata using the function
    const { error: metadataUpdateError } = await client
      .rpc('update_session_metadata', {
        p_session_id: sessionId,
        p_metadata: JSON.stringify({
          title_initialized: true
        })
      });
    
    if (metadataUpdateError) {
      console.error('Failed to update session metadata', metadataUpdateError);
      // Don't return false here as the title was successfully updated
      // Just log the error and continue
    }
    
    console.log('Successfully generated and updated session title', { generatedTitle });
    return true;
    
    // This code is unreachable but kept for completeness
    // return false;
  } catch (error) {
    console.error('Error generating session title', error);
    return false;
  }
}

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

      // 4. If content changed, handle artifacts and potentially generate title
      if (contentChanged) {
        console.log('Content changed, deleting artifacts', {
          transcriptChanged,
          noteChanged
        });

        // 4a. Try to generate a title if needed
        await generateSessionTitle(client, data.id, data.transcript || null, data.note || null);
        // Note: We don't need to handle errors here as the function handles them internally

        // 4b. Delete session artifacts
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

      // Fetch the latest session data to return to the client
      const { data: updatedSession, error: fetchUpdatedError } = await client
        .from('sessions')
        .select('id, title, transcript, note, metadata')
        .eq('id', data.id)
        .single();

      if (fetchUpdatedError) {
        console.error('Failed to fetch updated session data', fetchUpdatedError);
        return { success: true };
      }

      return { 
        success: true,
        session: updatedSession
      };
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
