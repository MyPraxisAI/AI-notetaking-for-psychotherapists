import { useQuery } from '@tanstack/react-query';
import { useSupabase } from '@kit/supabase/hooks/use-supabase';

/**
 * Hook to check if the current user is a super admin
 * Uses the Supabase RPC function 'is_super_admin' that's already set up in the database
 */
export function useIsSuperAdmin() {
  const client = useSupabase();

  return useQuery({
    queryKey: ['isSuperAdmin'],
    queryFn: async () => {
      try {
        const { data, error } = await client.rpc('is_super_admin');

        if (error) {
          throw error;
        }

        return !!data;
      } catch (error) {
        console.error('Error checking super admin status:', error);
        return false;
      }
    },
    // Cache this for a reasonable time since admin status doesn't change frequently
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
