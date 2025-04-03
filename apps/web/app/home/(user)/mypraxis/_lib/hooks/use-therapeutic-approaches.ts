'use client';

import { useQuery } from '@tanstack/react-query';
import { useSupabase } from '@kit/supabase/hooks/use-supabase';

// Based on the migration file, therapeutic_approaches has id and name columns
export interface TherapeuticApproach {
  id: string;
  name: string;
}

/**
 * Hook to fetch therapeutic approaches
 */
export function useTherapeuticApproaches() {
  const client = useSupabase();
  
  return useQuery({
    queryKey: ['therapeutic-approaches'],
    queryFn: async (): Promise<TherapeuticApproach[]> => {
      try {
        const { data, error } = await client
          .from('therapeutic_approaches')
          .select('id, name')
          .order('name', { ascending: true });
          
        if (error) {
          throw error;
        }
        
        // Safely transform the data to match our interface
        if (!data) return [];
        
        // Use type assertion with any as an intermediate step
        const approaches = (data as any[]).map(item => ({
          id: item.id,
          name: item.name
        }));
        
        return approaches;
      } catch (error) {
        console.error('Error fetching therapeutic approaches:', error);
        throw error;
      }
    },
    refetchOnWindowFocus: false,
    staleTime: 1000 * 60 * 60, // 1 hour
  });
}
