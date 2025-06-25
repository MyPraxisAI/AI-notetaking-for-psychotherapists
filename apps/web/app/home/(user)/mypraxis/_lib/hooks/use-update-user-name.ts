'use client';

import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useSupabase } from '@kit/supabase/hooks/use-supabase';
import { z } from 'zod';
import { NAME_UPDATED_EVENT } from './use-user-data';
import { useTranslation } from 'react-i18next';

// Name validation schema
export const UserNameSchema = z.object({
  displayName: z.string().min(1, 'Name is required'),
});

export type UserNameFormValues = z.infer<typeof UserNameSchema>;

// Create a function to get a schema with translations
export const getUserNameSchema = (t: (key: string) => string) => z.object({
  displayName: z.string().min(1, t('hooks.userProfile.nameRequired')),
});

/**
 * Hook for updating user's display name
 */
export function useUpdateUserName() {
  const client = useSupabase();
  const { t } = useTranslation('mypraxis');

  return useMutation({
    mutationFn: async (displayName: string) => {
      const { data, error } = await client.auth.updateUser({
        data: { 
          name: displayName,
          full_name: displayName // Also update full_name to ensure it's available in the sidebar
        },
      });

      if (error) {
        throw error;
      }

      return data;
    },
    onSuccess: (_, displayName) => {
      // Dispatch custom event to update the name in the UI immediately
      window.dispatchEvent(new CustomEvent(NAME_UPDATED_EVENT, {
        detail: { fullName: displayName }
      }));
    },
    onError: (error) => {
      console.error('Error updating name:', error);
      toast.error(t('hooks.userProfile.nameUpdatedError'));
    },
  });
}
