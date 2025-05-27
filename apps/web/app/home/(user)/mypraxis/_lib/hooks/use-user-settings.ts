'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSupabase } from '@kit/supabase/hooks/use-supabase';
import { toast } from 'sonner';
import { useUserWorkspace } from '@kit/accounts/hooks/use-user-workspace';

export interface UserSettings {
  id: string;
  account_id: string;
  onboarding_completed: boolean;
  created_at: string;
  updated_at: string;
}

export function useUserSettings() {
  const { workspace } = useUserWorkspace();
  const accountId = workspace?.id;
  const supabase = useSupabase();
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['user-settings', accountId],
    queryFn: async () => {
      if (!accountId) {
        return null;
      }

      const { data, error } = await supabase
        .from('user_settings')
        .select('*')
        .eq('account_id', accountId)
        .single();

      if (error) {
        throw error;
      }

      return data as UserSettings;
    },
    enabled: !!accountId,
  });


  const { mutateAsync: updateSettings, isPending: isUpdating } = useMutation({
    mutationFn: async (settings: Partial<UserSettings>) => {
      if (!accountId) {
        throw new Error('No account ID found');
      }

      const { error } = await supabase
        .from('user_settings')
        .update(settings)
        .eq('account_id', accountId);

      if (error) {
        throw error;
      }

      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-settings', accountId] });
    },
    onError: (error) => {
      toast.error('Failed to update settings', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    },
  });

  const completeOnboarding = async () => {
    try {
      await updateSettings({ onboarding_completed: true });
      return true;
    } catch {
      // Silent failure, just return false
      return false;
    }
  };

  return {
    settings: data,
    isLoading,
    error,
    updateSettings,
    isUpdating,
    completeOnboarding,
  };
}
