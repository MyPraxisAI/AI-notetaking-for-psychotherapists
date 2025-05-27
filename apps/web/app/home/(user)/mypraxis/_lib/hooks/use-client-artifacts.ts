'use client';

import { useQuery, useQueryClient, QueryClient } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

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
 * Non-hook version for prefetching client artifacts
 * This is for use in non-React contexts or where hooks can't be used
 */
export function prefetchClientArtifactsNonHook(queryClient: QueryClient, clientId: string) {
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

/**
 * React hook for prefetching client artifacts
 * Call this function when you know a client will be viewed soon
 */
export function usePrefetchClientArtifacts() {
  const queryClient = useQueryClient();
  
  return (clientId: string) => {
    prefetchClientArtifactsNonHook(queryClient, clientId);
  };
}

export function useClientArtifact(
  clientId: string, 
  type: 'client_prep_note' | 'client_conceptualization' | 'client_bio', 
  enabled = true
) {
  const queryClient = useQueryClient();
  
  // Use useMemo to memoize the queryKey array to avoid unnecessary re-renders
  const queryKey = useMemo(() => ['client', clientId, 'artifact', type], [clientId, type]);
  
  // Check if we have cached data and if it's stale
  const cachedData = queryClient.getQueryData<ClientArtifactResponse>(queryKey);
  const isStale = cachedData?.stale === true;
    
  // Set up a polling effect if the artifact is stale
  useEffect(() => {
    if (isStale && enabled) {
      console.log(`[useClientArtifact] Setting up polling for stale artifact: ${type}`);
      
      // Create polling interval
      const intervalId = setInterval(() => {
        console.log(`[useClientArtifact] Polling stale artifact: ${type}`);
        queryClient.invalidateQueries({ queryKey });
      }, 3000); // Poll every 3 seconds
      
      // Clean up interval on unmount
      return () => {
        console.log(`[useClientArtifact] Cleaning up polling for: ${type}`);
        clearInterval(intervalId);
      };
    }
  }, [isStale, queryClient, queryKey, type, enabled]);
  
  const { t } = useTranslation('mypraxis');
  
  return useQuery<ClientArtifactResponse>({
    queryKey,
    queryFn: async () => {
      try {
        const response = await fetch(`/api/clients/${clientId}/artifacts/${type}`);
        
        if (response.status === 404) {
          console.log(`[useClientArtifact] 404 NOT FOUND for ${type}`);
          return null;
        }
        
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to fetch artifact');
        }
        
        return response.json();
      } catch (error) {
        console.error(`[useClientArtifact] ERROR fetching ${type}:`, error);
        toast.error(t('hooks.clientArtifacts.failedToLoad', { type: type.replace('_', ' ') }));
        throw error;
      }
    },
    enabled: enabled,
    // Standard stale time for normal operation
    staleTime: isStale ? 0 : 1000 * 60 * 5, // 0 if stale (always refetch), otherwise 5 minutes
    // We're handling polling manually with useEffect for stale artifacts
    placeholderData: (previousData) => previousData,
    refetchOnWindowFocus: true
  });
}
