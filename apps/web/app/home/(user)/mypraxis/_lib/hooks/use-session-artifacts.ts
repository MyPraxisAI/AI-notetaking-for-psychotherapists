'use client';

import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';

interface SessionArtifactResponse {
  content: string;
  language: string;
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
        
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || 'Failed to fetch artifact');
        }
        
        return response.json();
      } catch (error) {
        toast.error(`Error loading ${type.replace('session_', '').replace('_', ' ')}`);
        throw error;
      }
    },
    enabled: !!sessionId && enabled,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}
