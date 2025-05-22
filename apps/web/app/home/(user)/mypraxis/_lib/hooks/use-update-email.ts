'use client';

import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useSupabase } from '@kit/supabase/hooks/use-supabase';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';

// Email validation schema
export const EmailSchema = z.object({
  email: z.string().email('Please enter a valid email'),
});

// Create a function to get a schema with translations
export const getEmailSchema = (t: (key: string) => string) => z.object({
  email: z.string().email(t('hooks.userProfile.emailInvalid')),
});

export type EmailFormValues = z.infer<typeof EmailSchema>;

/**
 * Hook for updating user's email with verification
 */
export function useUpdateEmail() {
  const client = useSupabase();
  const { t } = useTranslation('mypraxis');

  return useMutation({
    mutationFn: async ({ email, redirectTo }: { email: string; redirectTo?: string }) => {
      const { data, error } = await client.auth.updateUser({
        email,
      }, redirectTo ? { emailRedirectTo: redirectTo } : undefined);

      if (error) {
        throw error;
      }

      return data;
    },
    onSuccess: () => {
      toast.success(t('hooks.userProfile.emailVerificationSent'));
    },
    onError: (error) => {
      console.error('Error updating email:', error);
      toast.error(t('hooks.userProfile.emailUpdatedError'));
    },
  });
}
