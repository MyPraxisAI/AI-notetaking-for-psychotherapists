'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

interface ClientArtifactResponse {
  content: string;
  language: string;
  stale: boolean;
}

/**
 * Hook to fetch client artifacts (prep note, conceptualization, bio)
 * Follows the client-side data fetching pattern with React Query
 */
/**
 * Prefetch client artifacts to avoid loading flashes
 * Call this function when you know a client will be viewed soon
 */
export function prefetchClientArtifacts(clientId: string) {
  const queryClient = useQueryClient();
  
  // Define artifact types to prefetch
  const artifactTypes = ['client_prep_note', 'client_conceptualization', 'client_bio'] as const;
  
  // Prefetch each artifact type
  artifactTypes.forEach(type => {
    const queryKey = ['client', clientId, 'artifact', type];
    
    // Only prefetch if not already in cache
    if (!queryClient.getQueryData(queryKey)) {
      queryClient.prefetchQuery({
        queryKey,
        queryFn: async () => {
          try {
            const response = await fetch(`/api/clients/${clientId}/artifacts/${type}`);
            
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
}

export function useClientArtifact(
  clientId: string, 
  type: 'client_prep_note' | 'client_conceptualization' | 'client_bio', 
  enabled = true
) {
  const queryClient = useQueryClient();
  
  // Check if we have this data in the cache already
  const cachedData = queryClient.getQueryData<ClientArtifactResponse>(['client', clientId, 'artifact', type]);
  
  return useQuery<ClientArtifactResponse>({
    queryKey: ['client', clientId, 'artifact', type],
    queryFn: async () => {
      try {
        const response = await fetch(`/api/clients/${clientId}/artifacts/${type}`);
        
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
        toast.error(`Error loading ${type.replace('client_', '').replace('_', ' ')}`);
        throw error;
      }
    },
    enabled: !!clientId && enabled,
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
