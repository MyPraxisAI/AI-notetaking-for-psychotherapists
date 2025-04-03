'use client';

import { useQuery } from '@tanstack/react-query';
import { useSupabase } from '@kit/supabase/hooks/use-supabase';

// Based on the migration file, geo_localities has id and name columns
export interface GeoLocality {
  id: string;
  name: string;
}

/**
 * Hook to fetch geo localities
 */
export function useGeoLocalities() {
  const client = useSupabase();
  
  return useQuery({
    queryKey: ['geo-localities'],
    queryFn: async (): Promise<GeoLocality[]> => {
      try {
        const { data, error } = await client
          .from('geo_localities')
          .select('id, name')
          .order('name', { ascending: true });
          
        if (error) {
          throw error;
        }
        
        // Safely transform the data to match our interface
        if (!data) return [];
        
        // Use type assertion with any as an intermediate step
        const localities = (data as any[]).map(item => ({
          id: item.id,
          name: item.name
        }));
        
        return localities;
      } catch (error) {
        console.error('Error fetching geo localities:', error);
        throw error;
      }
    },
    refetchOnWindowFocus: false,
    staleTime: 1000 * 60 * 60, // 1 hour
  });
}
