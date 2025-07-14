'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

interface SessionArtifactResponse {
  content: string;
  language: string;
  stale: boolean;
}

/**
 * Custom hook to get a prefetch function for session artifacts
 * This ensures the hook is only used within React components
 */
export function usePrefetchSessionArtifacts() {
  const queryClient = useQueryClient();
  
  // Return a function that can be called anywhere
  return (sessionId: string) => {
    if (!sessionId) return;
    
    // Define artifact types to prefetch
    const artifactTypes = ['session_therapist_summary', 'session_client_summary'] as const;
    
    // Prefetch each artifact type
    artifactTypes.forEach(type => {
      const queryKey = ['session', sessionId, 'artifact', type];
      
      // Only prefetch if not already in cache
      if (!queryClient.getQueryData(queryKey)) {
        queryClient.prefetchQuery({
          queryKey,
          queryFn: async () => {
            try {
              const response = await fetch(`/api/sessions/${sessionId}/artifacts/${type}`);
              
              if (response.status === 404) {
                return null;
              }
              
              if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to fetch artifact');
              }
              
              return response.json();
            } catch (error) {
              // Silent fail for prefetching
              console.error(`Error prefetching ${type}:`, error);
              return null;
            }
          },
          staleTime: 1000 * 60 * 5 // 5 minutes
        });
      }
    });
  };
}

/**
 * Non-hook version for server components or non-React contexts
 * This doesn't use hooks and can be called anywhere
 */
export async function prefetchSessionArtifactsNonHook(sessionId: string) {
  if (!sessionId) return;
  
  // Define artifact types to prefetch
  const artifactTypes = ['session_therapist_summary', 'session_client_summary'] as const;
  
  // Prefetch each artifact type
  for (const type of artifactTypes) {
    try {
      // Just fetch the data, don't worry about caching
      await fetch(`/api/sessions/${sessionId}/artifacts/${type}`);
    } catch (error) {
      // Silent fail for prefetching
      console.error(`Error prefetching ${type}:`, error);
    }
  }
}

/**
 * Hook to fetch session artifacts (therapist summary, client summary, etc.)
 * Follows the client-side data fetching pattern with React Query
 */
export function useSessionArtifact(
  sessionId: string, 
  type: 'session_therapist_summary' | 'session_client_summary', 
  enabled = true
) {
  const queryClient = useQueryClient();
  const { t } = useTranslation('mypraxis');
  
  // Check if we have this data in the cache already
  const cachedData = queryClient.getQueryData<SessionArtifactResponse>(['session', sessionId, 'artifact', type]);
  
  return useQuery<SessionArtifactResponse>({
    queryKey: ['session', sessionId, 'artifact', type],
    queryFn: async () => {
      try {
        const response = await fetch(`/api/sessions/${sessionId}/artifacts/${type}`);
        
        if (response.status === 404) {
          // If the artifact doesn't exist yet, return null
          // This will trigger the loading state in the UI
          return null;
        }
        
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to fetch artifact');
        }
        
        return response.json();
      } catch (error) {
        toast.error(t('hooks.sessionArtifacts.failedToLoad', { type: type.replace('session_', '').replace('_', ' ') }));
        throw error;
      }
    },
    enabled: !!sessionId && enabled,
    staleTime: 1000 * 60 * 5, // 5 minutes
    // Use cached data as placeholder to avoid loading flash
    placeholderData: cachedData || undefined,
    // Poll every 3 seconds if the artifact is stale or doesn't exist
    refetchInterval: (query) => {
      // If data is null (404) or has stale=true, poll every 3 seconds
      if (query.state.data === null || (query.state.data && query.state.data.stale)) {
        return 3000; // 3 seconds
      }
      return false; // Don't poll if the artifact exists and is not stale
    },
    refetchIntervalInBackground: true
  });
}
