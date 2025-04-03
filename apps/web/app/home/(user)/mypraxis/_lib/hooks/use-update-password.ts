import { useMutation } from '@tanstack/react-query';
import { z } from 'zod';
import { toast } from 'sonner';
import { useSupabase } from '@kit/supabase/hooks/use-supabase';

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

export type PasswordFormValues = z.infer<typeof PasswordSchema>;

/**
 * Hook for updating user password
 */
export function useUpdatePassword() {
  const client = useSupabase();

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
      toast.success('Password updated successfully');
    },
    onError: (error) => {
      console.error('Error updating password:', error);
      toast.error('Failed to update password. Please try again.');
    },
  });
}
