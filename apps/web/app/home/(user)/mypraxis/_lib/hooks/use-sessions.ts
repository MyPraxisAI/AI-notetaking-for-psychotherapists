'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useSupabase } from '@kit/supabase/hooks/use-supabase';
import { useUserWorkspace } from '@kit/accounts/hooks/use-user-workspace';
import { SessionData, SessionWithId } from '../schemas/session';

// Define the database record structure
interface SessionDatabaseRecord {
  id: string;
  account_id: string;
  client_id: string;
  title?: string | null;
  note: string | null;
  transcript: string | null;
  created_at: string;
  updated_at: string;
}

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
        return (sessionsData || []).map((record: SessionDatabaseRecord) => ({
          id: record.id,
          clientId: record.client_id,
          title: record.title ?? record.note ?? 'Untitled Session',
          transcript: record.transcript || '',
          note: record.note || '',
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

  const queryKey = ['session', sessionId, accountId];

  return useQuery({
    queryKey,
    queryFn: async (): Promise<SessionWithId | null> => {
      if (!accountId || !sessionId) return null;

      try {
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

        // Transform the data using the same interface we defined earlier
        const record = sessionData as SessionDatabaseRecord;
        return {
          id: record.id,
          clientId: record.client_id,
          title: record.title ?? record.note ?? 'Untitled Session',
          transcript: record.transcript || '',
          note: record.note || '',
          createdAt: record.created_at
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
            transcript: data.transcript || null,
            note: data.note || null,
            title: data.title || null
          })
          .select()
          .single();

        if (createError) {
          throw createError;
        }

        // Transform to our session model using the defined interface
        const record = newSession as SessionDatabaseRecord;
        return {
          id: record.id,
          clientId: record.client_id,
          title: record.title ?? record.note ?? 'Untitled Session',
          transcript: record.transcript || '',
          note: record.note || '',
          createdAt: record.created_at
        };
      } catch (error) {
        console.error('Error creating session:', error);
        throw error;
      }
    },
    onSuccess: (_, variables) => {
      toast.success('Session created successfully');
      
      // Invalidate sessions query to refetch the list
      if (accountId) {
        queryClient.invalidateQueries({
          queryKey: ['sessions', variables.clientId, accountId],
        });
      }
    },
    onError: (error) => {
      toast.error('Failed to create session');
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

  return useMutation({
    mutationFn: async ({ id, clientId: _clientId, ...data }: SessionWithId): Promise<SessionWithId> => {
      if (!accountId) {
        throw new Error('Account not found');
      }

      try {
        const { data: updatedSession, error: updateError } = await client
          .from('sessions')
          .update({
            transcript: data.transcript || null,
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
        const record = updatedSession as SessionDatabaseRecord;
        return {
          id: record.id,
          clientId: record.client_id,
          title: record.title ?? record.note ?? 'Untitled Session',
          transcript: record.transcript || '',
          note: record.note || '',
          createdAt: record.created_at
        };
      } catch (error) {
        console.error('Error updating session:', error);
        throw error;
      }
    },
    onSuccess: (_, variables) => {
      toast.success('Session updated successfully');
      
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
      toast.error('Failed to update session');
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
      toast.success('Session deleted successfully');
      
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
      toast.error('Failed to delete session');
      console.error(error);
    }
  });
}
