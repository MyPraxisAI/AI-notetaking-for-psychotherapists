'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSupabase } from '@kit/supabase/hooks/use-supabase';
import { useUserWorkspace } from '@kit/accounts/hooks/use-user-workspace';
import { SessionData, SessionWithId } from '../schemas/session';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { getTranscriptContent } from '../actions';

/**
 * Hook to fetch all sessions for a specific client
 */
export function useSessions(clientId: string | null) {
  const { workspace } = useUserWorkspace();
  const accountId = workspace?.id;
  const client = useSupabase();

  const queryKey = ['sessions', clientId, accountId];

  return useQuery({
    queryKey,
    queryFn: async (): Promise<SessionWithId[]> => {
      if (!accountId || !clientId) return [];

      try {
        const { data: sessionsData, error: sessionsError } = await client
          .from('sessions')
          .select('*')
          .eq('client_id', clientId)
          .eq('account_id', accountId)
          .order('created_at', { ascending: false });

        if (sessionsError) {
          throw sessionsError;
        }

        // Transform the data from database format to our schema format
        return (sessionsData || []).map((record: {
          id: string;
          client_id: string;
          title: string | null;
          note: string | null;
          created_at: string;
        }) => ({
          id: record.id,
          clientId: record.client_id,
          title: record.title || '',
          note: record.note || undefined,
          transcript: undefined, // Keep for backward compatibility with UI
          createdAt: record.created_at
        }));
      } catch (error) {
        console.error('Error fetching sessions:', error);
        throw error;
      }
    },
    enabled: !!accountId && !!clientId,
    refetchOnWindowFocus: false,
  });
}

/**
 * Hook to fetch a single session by ID
 */
export function useSession(sessionId: string | null) {
  const { workspace } = useUserWorkspace();
  const accountId = workspace?.id;
  const client = useSupabase();
  const { i18n } = useTranslation('mypraxis'); // t removed - not used in this function

  const queryKey = ['session', sessionId, accountId];

  return useQuery({
    queryKey,
    queryFn: async (): Promise<SessionWithId | null> => {
      if (!accountId || !sessionId) return null;

      try {
        // Fetch session data
        const { data: sessionData, error: sessionError } = await client
          .from('sessions')
          .select('*')
          .eq('id', sessionId)
          .eq('account_id', accountId)
          .single();

        if (sessionError) {
          throw sessionError;
        }

        if (!sessionData) {
          return null;
        }
        
        // Fetch transcript content using the server action
        let transcript = null;
        try {
          const { success, content } = await getTranscriptContent(sessionId);
          if (success && content) {
            transcript = content;
          }
        } catch (error) {
          console.error('Error fetching transcript content:', error);
          // Don't throw here, as we can still return the session without transcript
        }

        // Transform the data using the same interface we defined earlier
        return {
          id: sessionData.id,
          clientId: sessionData.client_id,
          title: sessionData.title || '',
          note: sessionData.note || undefined,
          transcript: transcript || undefined, // Use transcript from the transcripts table
          createdAt: sessionData.created_at
        };
      } catch (error) {
        console.error('Error fetching session:', error);
        throw error;
      }
    },
    enabled: !!accountId && !!sessionId,
    refetchOnWindowFocus: false,
  });
}

/**
 * Hook to create a new session
 */
export function useCreateSession() {
  const queryClient = useQueryClient();
  const { workspace } = useUserWorkspace();
  const accountId = workspace?.id;
  const client = useSupabase();
  const { t } = useTranslation('mypraxis');

  return useMutation({
    mutationFn: async ({ clientId, ...data }: SessionData & { clientId: string }): Promise<SessionWithId> => {
      if (!accountId) {
        throw new Error('Account not found');
      }

      try {
        // Create the session record
        const { data: newSession, error: createError } = await client
          .from('sessions')
          .insert({
            account_id: accountId,
            client_id: clientId,
            note: data.note || null,
            title: data.title || null
          })
          .select()
          .single();

        if (createError) {
          throw createError;
        }

        // Transform to our session model using the defined interface
        return {
          id: newSession.id,
          clientId: newSession.client_id,
          title: newSession.title || '',
          note: newSession.note || undefined,
          transcript: undefined, // Keep for backward compatibility with UI
          createdAt: newSession.created_at
        };
      } catch (error) {
        console.error('Error creating session:', error);
        throw error;
      }
    },
    onSuccess: (_, variables) => {
      toast.success(t('hooks.sessions.createdSuccess'));
      
      // Invalidate sessions query to refetch the list
      if (accountId) {
        queryClient.invalidateQueries({
          queryKey: ['sessions', variables.clientId, accountId],
        });
      }
    },
    onError: (error) => {
      toast.error(t('hooks.sessions.createdError'));
      console.error(error);
    }
  });
}

/**
 * Hook to update an existing session
 */
export function useUpdateSession() {
  const queryClient = useQueryClient();
  const { workspace } = useUserWorkspace();
  const accountId = workspace?.id;
  const client = useSupabase();
  const { t } = useTranslation('mypraxis');

  return useMutation({
    mutationFn: async ({ id, clientId: _clientId, ...data }: SessionWithId): Promise<SessionWithId> => {
      if (!accountId) {
        throw new Error('Account not found');
      }

      try {
        const { data: updatedSession, error: updateError } = await client
          .from('sessions')
          .update({
            note: data.note || null,
            title: data.title || null
          })
          .eq('id', id)
          .eq('account_id', accountId)
          .select()
          .single();

        if (updateError) {
          throw updateError;
        }

        // Transform to our session model using the defined interface
        return {
          id: updatedSession.id,
          clientId: updatedSession.client_id,
          title: updatedSession.title || '',
          note: updatedSession.note || undefined,
          transcript: undefined, // Keep for backward compatibility with UI
          createdAt: updatedSession.created_at
        };
      } catch (error) {
        console.error('Error updating session:', error);
        throw error;
      }
    },
    onSuccess: (_, variables) => {
      toast.success(t('hooks.sessions.updatedSuccess'));
      
      // Invalidate specific session query and sessions list
      if (accountId) {
        queryClient.invalidateQueries({
          queryKey: ['session', variables.id, accountId],
        });
        
        queryClient.invalidateQueries({
          queryKey: ['sessions', variables.clientId, accountId],
        });
      }
    },
    onError: (error) => {
      toast.error(t('hooks.sessions.updatedError'));
      console.error(error);
    }
  });
}

/**
 * Hook to delete a session
 */
export function useDeleteSession() {
  const queryClient = useQueryClient();
  const { workspace } = useUserWorkspace();
  const accountId = workspace?.id;
  const client = useSupabase();
  const { t } = useTranslation('mypraxis');

  return useMutation({
    mutationFn: async ({ sessionId, clientId: _clientId }: { sessionId: string, clientId: string }) => {
      if (!accountId) {
        throw new Error('Account not found');
      }

      try {
        const { error: deleteError } = await client
          .from('sessions')
          .delete()
          .eq('id', sessionId)
          .eq('account_id', accountId);

        if (deleteError) {
          throw deleteError;
        }

        return { success: true };
      } catch (error) {
        console.error('Error deleting session:', error);
        throw error;
      }
    },
    onSuccess: (_, variables) => {
      toast.success(t('hooks.sessions.deletedSuccess'));
      
      // Invalidate sessions query to refetch the list
      if (accountId) {
        // Remove the deleted session from the cache
        queryClient.removeQueries({
          queryKey: ['session', variables.sessionId, accountId],
        });
        
        // Invalidate the sessions list
        queryClient.invalidateQueries({
          queryKey: ['sessions', variables.clientId, accountId],
        });
      }
    },
    onError: (error) => {
      toast.error(t('hooks.sessions.deletedError'));
      console.error(error);
    }
  });
}
