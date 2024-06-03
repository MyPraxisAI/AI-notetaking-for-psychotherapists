'use client';

import { useEffect } from 'react';

import { usePathname, useRouter } from 'next/navigation';

import { useQueryClient } from '@tanstack/react-query';

import { useSupabase } from './use-supabase';

/**
 * @name PRIVATE_PATH_PREFIXES
 * @description A list of private path prefixes
 */
const PRIVATE_PATH_PREFIXES = ['/home', '/admin', '/join', '/update-password'];

/**
 * @name useAuthChangeListener
 * @param privatePathPrefixes
 * @param appHomePath
 */
export function useAuthChangeListener({
  privatePathPrefixes = PRIVATE_PATH_PREFIXES,
  appHomePath,
}: {
  appHomePath: string;
  privatePathPrefixes?: string[];
}) {
  const client = useSupabase();
  const pathName = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();

  useEffect(() => {
    // keep this running for the whole session unless the component was unmounted
    const listener = client.auth.onAuthStateChange(async (event, user) => {
      // log user out if user is falsy
      // and if the current path is a private route
      const shouldRedirectUser =
        !user && isPrivateRoute(pathName, privatePathPrefixes);

      if (shouldRedirectUser) {
        // send user away when signed out
        window.location.assign('/');

        return;
      }

      // revalidate user session when user signs in or out
      if (event === 'SIGNED_OUT') {
        await queryClient.invalidateQueries();

        return router.refresh();
      }
    });

    // destroy listener on un-mounts
    return () => listener.data.subscription.unsubscribe();
  }, [
    client.auth,
    router,
    pathName,
    appHomePath,
    privatePathPrefixes,
    queryClient,
  ]);
}

/**
 * Determines if a given path is a private route.
 */
function isPrivateRoute(path: string, privatePathPrefixes: string[]) {
  return privatePathPrefixes.some((prefix) => path.startsWith(prefix));
}
