'use client';

import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';

interface ClientArtifactResponse {
  content: string;
  language: string;
}

/**
 * Hook to fetch client artifacts (prep note, conceptualization, bio)
 * Follows the client-side data fetching pattern with React Query
 */
export function useClientArtifact(
  clientId: string, 
  type: 'client_prep_note' | 'client_conceptualization' | 'client_bio', 
  enabled = true
) {
  return useQuery<ClientArtifactResponse>({
    queryKey: ['client', clientId, 'artifact', type],
    queryFn: async () => {
      try {
        const response = await fetch(`/api/clients/${clientId}/artifacts/${type}`);
        
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || 'Failed to fetch artifact');
        }
        
        return response.json();
      } catch (error) {
        toast.error(`Error loading ${type.replace('client_', '').replace('_', ' ')}`);
        throw error;
      }
    },
    enabled: !!clientId && enabled,
    staleTime: 0, // Force refetch when invalidated
  });
}
