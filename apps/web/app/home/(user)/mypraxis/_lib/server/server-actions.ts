'use server';

import { z } from 'zod';
import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { SessionSchema, SessionMetadata } from '../schemas/session';
import { getLogger } from '@kit/web-bg-common/logger';
import { generateContent, createSessionApi } from '@kit/web-bg-common';
import type { User, SupabaseClient } from '@supabase/supabase-js';

// Schema for updating a session
const UpdateSessionSchema = SessionSchema.extend({
  id: z.string(),
  clientId: z.string()
});

type UpdateSessionData = z.infer<typeof UpdateSessionSchema>;

// Schema for generating a session title
const GenerateTitleSchema = z.object({
  id: z.string(),
  clientId: z.string()
});

type GenerateTitleData = z.infer<typeof GenerateTitleSchema>;

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
      client,
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
    
    // Then update the session metadata using the session API
    const sessionApi = createSessionApi(client);
    const metadataUpdateSuccess = await sessionApi.markTitleAsInitialized(sessionId);
    
    if (!metadataUpdateSuccess) {
      // Don't return false here as the title was successfully updated
      // Just log the error and continue
      console.error('Failed to update session metadata');
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
 * Server action to generate a title for a session
 */
export const generateSessionTitleAction = enhanceAction(
  async function (data: GenerateTitleData, user: User) {
    const client = getSupabaseServerClient();
    const logger = await getLogger();
    const ctx = { name: 'generateSessionTitleAction', sessionId: data.id, userId: user.id };
    
    try {
      logger.info(ctx, 'Generating session title');
      
      // 1. Get the current session data
      const { data: currentSession, error: fetchError } = await client
        .from('sessions')
        .select('note, title, metadata')
        .eq('id', data.id)
        .single();
      
      if (fetchError) {
        logger.error({ ...ctx, error: fetchError }, 'Failed to fetch session data');
        throw new Error('Failed to fetch session data');
      }
      
      // 1b. Get the transcript from the transcripts table
      let transcriptContent = null;
      const { data: transcriptData, error: transcriptError } = await client
        .from('transcripts')
        .select('content')
        .eq('session_id', data.id)
        .maybeSingle();
      
      if (transcriptError) {
        logger.warn({ ...ctx, error: transcriptError }, 'Failed to fetch transcript data');
        // Don't throw here, we'll just proceed with a null transcript
      } else if (transcriptData) {
        transcriptContent = transcriptData.content;
      }
      
      // 2. Call the helper function to generate the title
      const success = await generateSessionTitle(
        client,
        data.id,
        transcriptContent,
        currentSession.note
      );
      
      // 3. If successful, fetch the updated session to return
      if (success) {
        const { data: updatedSession, error: fetchUpdatedError } = await client
          .from('sessions')
          .select('id, title, note, metadata')
          .eq('id', data.id)
          .single();
        
        if (fetchUpdatedError) {
          logger.error({ ...ctx, error: fetchUpdatedError }, 'Failed to fetch updated session');
          return { success: true };
        }
        
        // Return the session with transcript data if available
        return { 
          success: true,
          session: {
            ...updatedSession,
            transcript: transcriptContent
          }
        };
      }
      
      return { success };
    } catch (error) {
      logger.error({ ...ctx, error }, 'Error generating session title');
      throw error;
    }
  },
  {
    auth: true,
    schema: GenerateTitleSchema,
  }
);

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
        .select('note, account_id, title, metadata')
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
      const titleChanged = data.title !== currentSession.title;
      const contentChanged = transcriptChanged || noteChanged;

      // 3. Update the session data (without transcript)
      const { error: updateError } = await client
        .from('sessions')
        .update({
          title: data.title,
          note: data.note
        })
        .eq('id', data.id);
        
      // 3a. If title was manually changed, update metadata to mark title as initialized
      if (titleChanged && !updateError) {
        // Handle metadata safely, checking if it exists and has the title_initialized property
        const metadata = currentSession.metadata as SessionMetadata | null;
        const titleInitialized = metadata?.title_initialized === true;
        
        // Only update if title_initialized is not already set
        if (!titleInitialized) {
          // Use the session API to update metadata
          const sessionApi = createSessionApi(client);
          const metadataUpdateSuccess = await sessionApi.markTitleAsInitialized(data.id);
          
          if (!metadataUpdateSuccess) {
            console.error('Failed to update title_initialized metadata');
            // Don't throw here as the session update was successful
            // Just log the error and continue
          } else {
            console.log('Successfully marked title as initialized after manual edit');
          }
        }
      }

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

      // 5. If content changed, handle artifacts and potentially generate title
      if (contentChanged) {
        console.log('Content changed, deleting artifacts', {
          transcriptChanged,
          noteChanged
        });

        // 5a. Try to generate a title if needed
        await generateSessionTitle(client, data.id, data.transcript || null, data.note || null);
        // Note: We don't need to handle errors here as the function handles them internally

        // 5b. Delete session artifacts
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
      // Fetch the latest session data
      const { data: updatedSession, error: fetchUpdatedError } = await client
        .from('sessions')
        .select('id, title, note, metadata')
        .eq('id', data.id)
        .single();
        
      // Also fetch the latest transcript data if needed
      let transcriptContent = null;
      if (!fetchUpdatedError) {
        const { data: transcriptData, error: transcriptError } = await client
          .from('transcripts')
          .select('content')
          .eq('session_id', data.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
          
        if (transcriptError && transcriptError.code !== 'PGRST116') {
          console.error('Failed to fetch transcript data', transcriptError);
        } else if (transcriptData) {
          transcriptContent = transcriptData.content;
        }
      }

      if (fetchUpdatedError) {
        console.error('Failed to fetch updated session data', fetchUpdatedError);
        return { success: true };
      }

      // Return the session with transcript data if available
      return { 
        success: true,
        session: {
          ...updatedSession,
          transcript: transcriptContent
        }
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
