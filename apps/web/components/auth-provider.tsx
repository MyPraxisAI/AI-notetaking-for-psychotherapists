'use client';

import { useCallback } from 'react';

import { useMonitoring } from '@kit/monitoring/hooks';
import { useAppEvents } from '@kit/shared/events';
import { useAuthChangeListener } from '@kit/supabase/hooks/use-auth-change-listener';

import pathsConfig from '~/config/paths.config';
import { AppEvents } from '~/lib/app-events';

export function AuthProvider(props: React.PropsWithChildren) {
  const dispatchEvent = useDispatchAppEventFromAuthEvent();

  useAuthChangeListener({
    appHomePath: pathsConfig.app.home,
    onEvent: (event, session) => {
      if (!session) {
        return dispatchEvent(event, undefined);
      }

      const user = session.user;
      const accountId = user.app_metadata.account_id as string;

      dispatchEvent(event, user.id, {
        email: user.email ?? '',
        account_id: accountId,
      });
    },
  });

  return props.children;
}

function useDispatchAppEventFromAuthEvent() {
  const { emit } = useAppEvents<AppEvents>();
  const monitoring = useMonitoring();

  return useCallback(
    (
      type: string,
      userId: string | undefined,
      traits: Record<string, string> = {},
    ) => {
      switch (type) {
        case 'SIGNED_IN':
          if (userId) {
            emit({
              type: 'user.signedIn',
              payload: { userId, ...traits },
            });

            // Only emit UserSignedIn event if this is a new user sign-in
            // Use sessionStorage to persist across component re-renders
            const lastSignedInUserId = sessionStorage.getItem('lastSignedInUserId');
            
            if (lastSignedInUserId !== userId) {
              emit({
                type: 'UserSignedIn',
                payload: { method: 'email' }, // Default to email method
              });
              
              sessionStorage.setItem('lastSignedInUserId', userId);
            }

            monitoring.identifyUser({ id: userId, ...traits });
          }

          break;

        case 'SIGNED_OUT':
          // Reset the tracking when user signs out
          sessionStorage.removeItem('lastSignedInUserId');
          break;

        case 'USER_UPDATED':
          emit({
            type: 'user.updated',
            payload: { userId: userId!, ...traits },
          });

          break;
      }
    },
    [emit, monitoring],
  );
}
