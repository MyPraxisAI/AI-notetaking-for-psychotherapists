import { cache } from 'react';

import { redirect } from 'next/navigation';

import { createAccountsApi } from '@kit/accounts/api';
import { requireUser } from '@kit/supabase/require-user';
import { getSupabaseServerComponentClient } from '@kit/supabase/server-component-client';

import featureFlagsConfig from '~/config/feature-flags.config';

const shouldLoadAccounts = featureFlagsConfig.enableTeamAccounts;

export type UserWorkspace = Awaited<ReturnType<typeof loadUserWorkspace>>;

/**
 * @name loadUserWorkspace
 * @description
 * Load the user workspace data. It's a cached per-request function that fetches the user workspace data.
 * It can be used across the server components to load the user workspace data.
 */
export const loadUserWorkspace = cache(async () => {
  const client = getSupabaseServerComponentClient();
  const api = createAccountsApi(client);

  const accountsPromise = shouldLoadAccounts
    ? () => api.loadUserAccounts()
    : () => Promise.resolve([]);

  const workspacePromise = api.getAccountWorkspace();

  const [accounts, workspace, auth] = await Promise.all([
    accountsPromise(),
    workspacePromise,
    requireUser(client),
  ]);

  if (!auth.data) {
    return redirect(auth.redirectTo);
  }

  const user = auth.data;

  return {
    accounts,
    workspace,
    user,
  };
});
