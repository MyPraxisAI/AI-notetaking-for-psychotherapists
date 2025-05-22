import { useMutation } from '@tanstack/react-query';
import { z } from 'zod';
import { toast } from 'sonner';
import { useSupabase } from '@kit/supabase/hooks/use-supabase';
import { useTranslation } from 'react-i18next';

// Password validation schema
export const PasswordSchema = z
  .object({
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\da-zA-Z]).{8,}$/,
        'Password must include uppercase, lowercase, number and special character',
      ),
    passwordConfirmation: z.string(),
  })
  .refine((data) => data.password === data.passwordConfirmation, {
    message: 'Passwords do not match',
    path: ['passwordConfirmation'],
  });

// Create a function to get a schema with translations
export const getPasswordSchema = (t: (key: string) => string) => z
  .object({
    password: z
      .string()
      .min(8, t('hooks.userProfile.passwordMinLength'))
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\da-zA-Z]).{8,}$/,
        t('hooks.userProfile.passwordRequirements'),
      ),
    passwordConfirmation: z.string(),
  })
  .refine((data) => data.password === data.passwordConfirmation, {
    message: t('hooks.userProfile.passwordsDoNotMatch'),
    path: ['passwordConfirmation'],
  });

export type PasswordFormValues = z.infer<typeof PasswordSchema>;

/**
 * Hook for updating user password
 */
export function useUpdatePassword() {
  const client = useSupabase();
  const { t } = useTranslation('mypraxis');

  return useMutation({
    mutationFn: async (password: string) => {
      const { error } = await client.auth.updateUser({
        password,
      });

      if (error) {
        throw error;
      }

      return { success: true };
    },
    onSuccess: () => {
      toast.success(t('hooks.userProfile.passwordUpdatedSuccess'));
    },
    onError: (error) => {
      console.error('Error updating password:', error);
      toast.error(t('hooks.userProfile.passwordUpdatedError'));
    },
  });
}
