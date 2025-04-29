'use client';

import { useQuery } from '@tanstack/react-query';
import { useSupabase } from '@kit/supabase/hooks/use-supabase';
import { useUserWorkspace } from '@kit/accounts/hooks/use-user-workspace';

interface RecordingStatus {
  isProcessing: boolean;
}

/**
 * Hook to check if a recording exists for a session and if it's being processed
 */
export function useRecordingStatus(sessionId: string | null) {
  const { workspace } = useUserWorkspace();
  const accountId = workspace?.id;
  const client = useSupabase();

  console.log(`[useRecordingStatus] Initializing hook for sessionId: ${sessionId}`);

  return useQuery({
    queryKey: ['recording-status', sessionId, accountId],
    queryFn: async (): Promise<RecordingStatus> => {
      console.log(`[useRecordingStatus] Fetching recording status for sessionId: ${sessionId}`);
      if (!accountId || !sessionId) {
        return { isProcessing: false };
      }

      try {
        // Check if a recording exists for this session
        const { data: recordingData, error: recordingError } = await client
          .from('recordings')
          .select('id')
          .eq('session_id', sessionId)
          .single();

        if (recordingError) {
          // If no recording is found, this is not an error for our use case
          if (recordingError.code === 'PGRST116') {
            return { isProcessing: false };
          }
          throw recordingError;
        }

        // If recording exists, check if it's being processed
        if (recordingData) {
          console.log(`[useRecordingStatus] Recording found for sessionId: ${sessionId}, setting isProcessing: true`);
          return { isProcessing: true };
        }

        return { isProcessing: false };
      } catch (error) {
        console.error('Error checking recording status:', error);
        return { isProcessing: false };
      }
    },
    // Force refetch on mount and window focus
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    
    // Set a short stale time to ensure the data is considered fresh for a short time
    staleTime: 500,
    
    // Only enable the query if we have the required parameters
    enabled: !!sessionId && !!accountId,
  });
}
