'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useSupabase } from '@kit/supabase/hooks/use-supabase';
import { useUserWorkspace } from '@kit/accounts/hooks/use-user-workspace';
import { ClientData, ClientWithId, ClientRecord } from '../schemas/client';
import { useTranslation } from 'react-i18next';
import { useAppEvents } from '@kit/shared/events';
import type { AppEvents } from '~/lib/app-events';

/**
 * Hook to fetch all clients for the current user
 */
export function useClients() {
  const { workspace } = useUserWorkspace();
  const accountId = workspace?.id;
  const client = useSupabase();

  const queryKey = ['clients', accountId];

  return useQuery({
    queryKey,
    queryFn: async (): Promise<ClientWithId[]> => {
      if (!accountId) return [];

      try {
        // First get the therapist ID for the current account
        const { data: therapistData, error: therapistError } = await client
          .from('therapists')
          .select('id')
          .eq('account_id', accountId)
          .single();

        if (therapistError) {
          throw therapistError;
        }

        if (!therapistData) {
          return [];
        }

        const therapistId = therapistData.id;

        // Now fetch clients for this therapist
        const { data: clientsData, error: clientsError } = await client
          .from('clients')
          .select('*')
          .eq('therapist_id', therapistId)
          .order('created_at', { ascending: false });

        if (clientsError) {
          throw clientsError;
        }

        // Transform the data from database format to our schema format
        return (clientsData || []).map((record: ClientRecord) => ({
          id: record.id,
          fullName: record.full_name,
          email: record.email || '',
          phone: record.phone || '',
          createdAt: record.created_at,
          demo: record.demo || false
        }));
      } catch (error) {
        console.error('Error fetching clients:', error);
        throw error;
      }
    },
    enabled: !!accountId,
    refetchOnWindowFocus: false,
  });
}

/**
 * Hook to fetch a single client by ID
 */
export function useClient(clientId: string | null) {
  const { workspace } = useUserWorkspace();
  const accountId = workspace?.id;
  const client = useSupabase();

  const queryKey = ['client', clientId, accountId];

  return useQuery({
    queryKey,
    queryFn: async (): Promise<ClientWithId | null> => {
      if (!accountId || !clientId) return null;

      try {
        const { data: clientData, error: clientError } = await client
          .from('clients')
          .select('*')
          .eq('id', clientId)
          .eq('account_id', accountId)
          .single();

        if (clientError) {
          throw clientError;
        }

        if (!clientData) {
          return null;
        }

        // Transform the data
        const record = clientData as ClientRecord;
        return {
          id: record.id,
          fullName: record.full_name,
          email: record.email || '',
          phone: record.phone || '',
          createdAt: record.created_at,
          demo: record.demo || false
        };
      } catch (error) {
        console.error('Error fetching client:', error);
        throw error;
      }
    },
    enabled: !!accountId && !!clientId,
    refetchOnWindowFocus: false,
  });
}

/**
 * Hook to create a new client
 */
export function useCreateClient() {
  const queryClient = useQueryClient();
  const { workspace } = useUserWorkspace();
  const accountId = workspace?.id;
  const client = useSupabase();
  const { t } = useTranslation('mypraxis');
  const { emit } = useAppEvents<AppEvents>();

  return useMutation({
    mutationFn: async (data: ClientData): Promise<ClientWithId> => {
      if (!accountId) {
        throw new Error('Account not found');
      }

      try {
        // First get the therapist ID for the current account
        const { data: therapistData, error: therapistError } = await client
          .from('therapists')
          .select('id')
          .eq('account_id', accountId)
          .single();

        if (therapistError) {
          throw therapistError;
        }

        if (!therapistData) {
          throw new Error('Therapist profile not found');
        }

        const therapistId = therapistData.id;

        // Create the client record
        const { data: newClient, error: createError } = await client
          .from('clients')
          .insert({
            account_id: accountId,
            therapist_id: therapistId,
            full_name: data.fullName,
            email: data.email || null,
            phone: data.phone || null
          })
          .select()
          .single();

        if (createError) {
          throw createError;
        }

        // Transform to our client model
        const record = newClient as ClientRecord;
        return {
          id: record.id,
          fullName: record.full_name,
          email: record.email || '',
          phone: record.phone || '',
          createdAt: record.created_at,
          demo: record.demo || false
        };
      } catch (error) {
        console.error('Error creating client:', error);
        throw error;
      }
    },
    onSuccess: (newClient) => {
      toast.success(t('hooks.clients.createdSuccess'));

      emit({
        type: 'ClientCreated',
        payload: {
          client_id: newClient.id,
        },
      });
      
      // Invalidate clients query to refetch the list
      if (accountId) {
        queryClient.invalidateQueries({
          queryKey: ['clients', accountId],
        });
      }
    },
    onError: (error) => {
      toast.error(t('hooks.clients.createdError'));
      console.error(error);
    }
  });
}

/**
 * Hook to update an existing client
 */
export function useUpdateClient() {
  const queryClient = useQueryClient();
  const { workspace } = useUserWorkspace();
  const accountId = workspace?.id;
  const client = useSupabase();
  const { t } = useTranslation('mypraxis');
  const { emit } = useAppEvents<AppEvents>();

  return useMutation({
    mutationFn: async ({ id, ...data }: ClientWithId): Promise<ClientWithId> => {
      if (!accountId) {
        throw new Error('Account not found');
      }

      try {
        const { data: updatedClient, error: updateError } = await client
          .from('clients')
          .update({
            full_name: data.fullName,
            email: data.email || null,
            phone: data.phone || null
          })
          .eq('id', id)
          .eq('account_id', accountId)
          .select()
          .single();

        if (updateError) {
          throw updateError;
        }

        // Transform to our client model
        const record = updatedClient as ClientRecord;
        return {
          id: record.id,
          fullName: record.full_name,
          email: record.email || '',
          phone: record.phone || '',
          createdAt: record.created_at,
          demo: record.demo || false
        };
      } catch (error) {
        console.error('Error updating client:', error);
        throw error;
      }
    },
    onMutate: async (variables) => {
      const previousClient = queryClient.getQueryData<ClientWithId>(['client', variables.id, accountId]);
      return { previousClient };
    },
    onSuccess: (updatedClient, variables, context) => {
      toast.success(t('hooks.clients.updatedSuccess'));

      // Determine which fields have changed
      const originalClient = context?.previousClient;
      const changedFields: (keyof ClientData)[] = [];

      if (originalClient) {
        if (originalClient.fullName !== updatedClient.fullName) {
          changedFields.push('fullName');
        }
        if (originalClient.email !== updatedClient.email) {
          changedFields.push('email');
        }
        if (originalClient.phone !== updatedClient.phone) {
          changedFields.push('phone');
        }
      }

      // Emit an event for each changed field
      changedFields.forEach((field) => {
        // Map the field name to the allowed values in the event
        let eventField: AppEvents['ClientUpdated']['field'];
        
        switch (field) {
          case 'fullName':
            eventField = 'name';
            break;
          case 'email':
            eventField = 'email';
            break;
          case 'phone':
            eventField = 'phone';
            break;
          default:
            return;
        }

        emit({
          type: 'ClientUpdated',
          payload: {
            field: eventField,
          },
        });
      });
      
      // Invalidate specific client query and clients list
      if (accountId) {
        queryClient.invalidateQueries({
          queryKey: ['client', variables.id, accountId],
        });
        
        queryClient.invalidateQueries({
          queryKey: ['clients', accountId],
        });
      }
    },
    onError: (error) => {
      toast.error(t('hooks.clients.updatedError'));
      console.error(error);
    }
  });
}

/**
 * Hook to delete a client
 */
export function useDeleteClient() {
  const queryClient = useQueryClient();
  const { workspace } = useUserWorkspace();
  const accountId = workspace?.id;
  const client = useSupabase();
  const { t } = useTranslation('mypraxis');

  return useMutation({
    mutationFn: async (clientId: string) => {
      if (!accountId) {
        throw new Error('Account not found');
      }

      try {
        const { error: deleteError } = await client
          .from('clients')
          .delete()
          .eq('id', clientId)
          .eq('account_id', accountId);

        if (deleteError) {
          throw deleteError;
        }

        return { success: true };
      } catch (error) {
        console.error('Error deleting client:', error);
        throw error;
      }
    },
    onSuccess: (_, clientId) => {
      toast.success(t('hooks.clients.deletedSuccess'));
      
      // Invalidate clients query to refetch the list
      if (accountId) {
        // Remove the deleted client from the cache
        queryClient.removeQueries({
          queryKey: ['client', clientId, accountId],
        });
        
        // Invalidate the clients list
        queryClient.invalidateQueries({
          queryKey: ['clients', accountId],
        });
      }
    },
    onError: (error) => {
      toast.error(t('hooks.clients.deletedError'));
      console.error(error);
    }
  });
}
