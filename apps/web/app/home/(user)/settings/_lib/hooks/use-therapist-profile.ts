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

import { TherapistProfileSchema, updateTherapistProfileAction } from '../server/server-actions';

// Define the therapist profile data type
export type TherapistProfileData = z.infer<typeof TherapistProfileSchema> & {
  id?: string;
};

/**
 * Hook to fetch therapist profile data
 */
export function useTherapistProfile() {
  const { data: session } = useUserSession();
  const userId = session?.user?.id;

  return useQuery({
    queryKey: ['therapist-profile', userId],
    queryFn: async (): Promise<TherapistProfileData | null> => {
      if (!userId) return null;

      const response = await fetch('/api/therapist/profile');
      if (!response.ok) {
        throw new Error('Failed to fetch therapist profile');
      }

      return response.json();
    },
    enabled: !!userId,
  });
}

/**
 * Hook to update therapist profile
 */
export function useUpdateTherapistProfile() {
  const queryClient = useQueryClient();
  const { data: session } = useUserSession();
  const userId = session?.user?.id;

  return useMutation({
    mutationFn: async (data: TherapistProfileData) => {
      try {
        const result = await updateTherapistProfileAction(data);
        return result;
      } catch (error) {
        console.error('Error updating therapist profile:', error);
        throw error;
      }
    },
    onSuccess: () => {
      toast({
        title: 'Profile updated',
        description: 'Your therapist profile has been updated successfully.',
        variant: 'success',
      });

      // Invalidate the therapist profile query to refetch the data
      if (userId) {
        queryClient.invalidateQueries({
          queryKey: ['therapist-profile', userId],
        });
      }
    },
    onError: (error) => {
      toast({
        title: 'Update failed',
        description: `Failed to update profile: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: 'error',
      });
    },
  });
}
