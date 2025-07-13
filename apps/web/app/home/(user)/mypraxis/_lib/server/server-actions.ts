'use server';

import { z } from 'zod';
import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { SessionSchema, SessionMetadata } from '../schemas/session';
import { getLogger } from '@kit/shared-common/logger';
import { createSessionApi, regenerateArtifactsForSession } from '@kit/web-bg-common';
import { generateSessionTitle } from '@kit/web-bg-common';
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
      let transcriptData: { content_json?: any } | null = null;
      let transcriptError = null;
      try {
        const result = await client
          .from('transcripts')
          .select('content_json')
          .eq('session_id', data.id)
          .maybeSingle();
        transcriptData = result.data;
        transcriptError = result.error;
        if (transcriptError) {
          logger.warn({ ...ctx, error: transcriptError }, 'Failed to fetch transcript data');
        }
      } catch (e) {
        logger.warn({ ...ctx, error: e }, 'Failed to fetch transcript data');
      }
      
      // 2. Call the helper function to generate the title
      const success = await generateSessionTitle(client, data.id);
      
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
        // Fetch the latest transcript data
        const { data: tData, error: tError } = await client
          .from('transcripts')
          .select('content_json')
          .eq('session_id', data.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (tError) {
          logger.warn({ ...ctx, error: tError }, 'Failed to fetch transcript data');
        } else {
          transcriptData = tData;
        }

        return { 
          success: true,
          session: {
            ...updatedSession,
            transcript: tData?.content_json
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
  async (data: UpdateSessionData, user: User) => {
    const client = getSupabaseServerClient();
    const logger = await getLogger();
    const ctx = {
      name: 'update-session',
      sessionId: data.id,
      userId: user.id
    };

    try {
      // 1. Get the current session data to compare
      const { data: currentSession, error: fetchError } = await client
        .from('sessions')
        .select('note, account_id, title, metadata')
        .eq('id', data.id)
        .single();
        
      if (fetchError) {
        logger.error({ ...ctx, error: fetchError }, 'Failed to fetch current session data');
        throw new Error('Failed to fetch current session data');
      }

      // 2. Check if content has actually changed
      const noteChanged = data.note !== currentSession.note;
      const titleChanged = data.title !== currentSession.title;
      const contentChanged = noteChanged;

      // 3. Update the session data
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

      // 4. If content changed, handle artifacts and potentially generate title
      if (contentChanged) {
        console.log('Content changed, marking artifacts as stale', {
          noteChanged
        });

        // 4a. Try to generate a title if needed
        await generateSessionTitle(client, data.id);
        // Note: We don't need to handle errors here as the function handles them internally

        // 4b. Mark session and client artifacts as stale and queue regeneration
        try {
          await regenerateArtifactsForSession(
            client, 
            data.id, 
            currentSession.account_id
          );
          logger.info({ ...ctx }, 'Invalidated artifacts and queued regeneration');
        } catch (invalidateError) {
          logger.error({ ...ctx, error: invalidateError }, 'Failed to invalidate artifacts and queue regeneration');
        }
        
      } else {
        console.log('Content unchanged, skipping artifact deletion');
      }

      // Fetch the latest session data to return to the client
      const { data: updatedSession, error: fetchUpdatedError } = await client
        .from('sessions')
        .select('id, title, note, metadata')
        .eq('id', data.id)
        .single();
        
      // Also fetch the latest transcript data if needed
      let transcriptData: { content_json?: any } | null = null;
      if (!fetchUpdatedError) {
        const { data: transcriptRow, error } = await client
          .from('transcripts')
          .select('content_json')
          .eq('session_id', data.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (error) {
          console.error('Failed to fetch transcript data', error);
        } else if (transcriptRow && transcriptRow.content_json) {
          transcriptData = transcriptRow;
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
          transcript: transcriptData?.content_json
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
