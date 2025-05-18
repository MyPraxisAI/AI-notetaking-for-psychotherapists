'use client';

import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';

interface SessionArtifactResponse {
  content: string;
  language: string;
  stale: boolean;
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
        toast.error(`Error loading ${type.replace('session_', '').replace('_', ' ')}`);
        throw error;
      }
    },
    enabled: !!sessionId && enabled,
    staleTime: 1000 * 60 * 5, // 5 minutes
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
