'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';

// Local implementation of useUserSession hook
function useUserSession() {
  // Mock implementation that returns a user session
  return {
    data: {
      user: {
        id: 'user-id',
        email: 'user@example.com'
      }
    }
  };
}

// Local implementation of toast
interface ToastProps {
  title: string;
  description: string;
  variant?: 'default' | 'success' | 'error';
}

const toast = (props: ToastProps) => {
  console.log(`Toast: ${props.title} - ${props.description}`);
  // In a real implementation, this would show a toast notification
};

import { UserPreferencesSchema, updateUserPreferencesAction } from '../server/server-actions';

// Define the user preferences data type
export type UserPreferencesData = z.infer<typeof UserPreferencesSchema>;

/**
 * Hook to fetch user preferences
 */
export function useUserPreferences() {
  const { data: session } = useUserSession();
  const userId = session?.user?.id;

  return useQuery({
    queryKey: ['user-preferences', userId],
    queryFn: async (): Promise<UserPreferencesData | null> => {
      if (!userId) return null;

      const response = await fetch('/api/user/preferences');
      if (!response.ok) {
        throw new Error('Failed to fetch user preferences');
      }

      return response.json();
    },
    enabled: !!userId,
  });
}

/**
 * Hook to update user preferences
 */
export function useUpdateUserPreferences() {
  const queryClient = useQueryClient();
  const { data: session } = useUserSession();
  const userId = session?.user?.id;

  return useMutation({
    mutationFn: async (data: UserPreferencesData) => {
      try {
        const result = await updateUserPreferencesAction(data);
        return result;
      } catch (error) {
        console.error('Error updating user preferences:', error);
        throw error;
      }
    },
    onSuccess: () => {
      toast({
        title: 'Preferences updated',
        description: 'Your preferences have been updated successfully.',
        variant: 'success',
      });

      // Invalidate the user preferences query to refetch the data
      if (userId) {
        queryClient.invalidateQueries({
          queryKey: ['user-preferences', userId],
        });
      }
    },
    onError: (error) => {
      toast({
        title: 'Update failed',
        description: `Failed to update preferences: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: 'error',
      });
    },
  });
}
