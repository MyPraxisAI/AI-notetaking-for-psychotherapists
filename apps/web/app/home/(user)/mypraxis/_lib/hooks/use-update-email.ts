'use client';

import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useSupabase } from '@kit/supabase/hooks/use-supabase';
import { z } from 'zod';

// Email validation schema
export const EmailSchema = z.object({
  email: z.string().email('Please enter a valid email'),
});

export type EmailFormValues = z.infer<typeof EmailSchema>;

/**
 * Hook for updating user's email with verification
 */
export function useUpdateEmail() {
  const client = useSupabase();

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
      toast.success('Verification email sent. Please check your inbox.');
    },
    onError: (error) => {
      console.error('Error updating email:', error);
      toast.error('Failed to update email. Please try again.');
    },
  });
}
