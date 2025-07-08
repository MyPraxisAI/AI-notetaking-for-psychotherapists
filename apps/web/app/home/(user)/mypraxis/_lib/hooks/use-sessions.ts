'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSupabase } from '@kit/supabase/hooks/use-supabase';
import { useUserWorkspace } from '@kit/accounts/hooks/use-user-workspace';
import { SessionData, SessionWithId } from '../schemas/session';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

/**
 * Hook to fetch all sessions for a specific client
 */
export function useSessions(clientId: string | null) {
  const { workspace } = useUserWorkspace();
  const accountId = workspace?.id;
  const queryKey = ['sessions', clientId, accountId];

  return useQuery({
    queryKey,
    queryFn: async (): Promise<SessionWithId[]> => {
      if (!accountId || !clientId) return [];
      try {
        const res = await fetch(`/api/sessions?clientId=${encodeURIComponent(clientId)}`);
        if (!res.ok) {
          throw new Error('Failed to fetch sessions');
        }
        const data = await res.json();
        return data;
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
  const queryKey = ['session', sessionId, accountId];

  return useQuery({
    queryKey,
    queryFn: async (): Promise<SessionWithId | null> => {
      if (!accountId || !sessionId) return null;
      try {
        const res = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}`);
        if (!res.ok) {
          if (res.status === 404) return null;
          throw new Error('Failed to fetch session');
        }
        const data = await res.json();
        return data;
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
