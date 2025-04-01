'use client';

import { useQuery } from '@tanstack/react-query';

/**
 * Interface for therapeutic approach data
 */
export interface TherapeuticApproach {
  id: string;
  name: string;
  title: string;
}

/**
 * Interface for geographic locality data
 */
export interface GeoLocality {
  id: string;
  name: string;
}

/**
 * Hook to fetch therapeutic approaches
 */
export function useTherapeuticApproaches() {
  return useQuery({
    queryKey: ['therapeutic-approaches'],
    queryFn: async (): Promise<TherapeuticApproach[]> => {
      const response = await fetch('/api/reference/therapeutic-approaches');
      if (!response.ok) {
        throw new Error('Failed to fetch therapeutic approaches');
      }
      return response.json();
    },
  });
}

/**
 * Hook to fetch geographic localities
 */
export function useGeoLocalities() {
  return useQuery({
    queryKey: ['geo-localities'],
    queryFn: async (): Promise<GeoLocality[]> => {
      const response = await fetch('/api/reference/geo-localities');
      if (!response.ok) {
        throw new Error('Failed to fetch geographic localities');
      }
      return response.json();
    },
  });
}
