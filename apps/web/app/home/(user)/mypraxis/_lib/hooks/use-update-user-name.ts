'use client';

import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useSupabase } from '@kit/supabase/hooks/use-supabase';
import { z } from 'zod';

// Name validation schema
export const UserNameSchema = z.object({
  displayName: z.string().min(1, 'Name is required'),
});

export type UserNameFormValues = z.infer<typeof UserNameSchema>;

/**
 * Hook for updating user's display name
 */
export function useUpdateUserName() {
  const client = useSupabase();

  return useMutation({
    mutationFn: async (displayName: string) => {
      const { data, error } = await client.auth.updateUser({
        data: { name: displayName },
      });

      if (error) {
        throw error;
      }

      return data;
    },
    onSuccess: () => {
      toast.success('Name updated successfully');
    },
    onError: (error) => {
      console.error('Error updating name:', error);
      toast.error('Failed to update name. Please try again.');
    },
  });
}
