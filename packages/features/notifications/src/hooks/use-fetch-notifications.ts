import { useEffect } from 'react';

import { useQuery } from '@tanstack/react-query';

import { useSupabase } from '@kit/supabase/hooks/use-supabase';

type Notification = {
  id: number;
  body: string;
  dismissed: boolean;
  type: 'info' | 'warning' | 'error';
  created_at: string;
  link: string | null;
};

export function useFetchNotifications({
  onNotifications,
  accountIds,
  realtime,
}: {
  onNotifications: (notifications: Notification[]) => unknown;
  accountIds: string[];
  realtime: boolean;
}) {
  const { data: notifications } = useFetchInitialNotifications({ accountIds });
  const client = useSupabase();

  useEffect(() => {
    let realtimeSubscription: { unsubscribe: () => void } | null = null;

    if (realtime) {
      const channel = client.channel('notifications-channel');

      realtimeSubscription = channel
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            filter: `account_id=in.(${accountIds.join(', ')})`,
            table: 'notifications',
          },
          (payload) => {
            onNotifications([payload.new as Notification]);
          },
        )
        .subscribe();
    }

    if (notifications) {
      onNotifications(notifications);
    }

    return () => {
      if (realtimeSubscription) {
        realtimeSubscription.unsubscribe();
      }
    };
  }, [client, onNotifications, accountIds, realtime, notifications]);
}

function useFetchInitialNotifications(props: { accountIds: string[] }) {
  const client = useSupabase();
  const now = new Date().toISOString();

  return useQuery({
    queryKey: ['notifications', ...props.accountIds],
    queryFn: async () => {
      const { data } = await client
        .from('notifications')
        .select(
          `id, 
           body, 
           dismissed, 
           type, 
           created_at, 
           link
           `,
        )
        .in('account_id', props.accountIds)
        .eq('dismissed', false)
        .gt('expires_at', now)
        .order('created_at', { ascending: false })
        .limit(10);

      return data;
    },
    refetchOnMount: false,
  });
}
