import 'server-only';

import { cache } from 'react';

import { redirect } from 'next/navigation';

import { getSupabaseServerComponentClient } from '@kit/supabase/server-component-client';
import { createTeamAccountsApi } from '@kit/team-accounts/api';

import pathsConfig from '~/config/paths.config';

export type TeamAccountWorkspace = Awaited<
  ReturnType<typeof loadTeamWorkspace>
>;

/**
 * Load the account workspace data.
 * We place this function into a separate file so it can be reused in multiple places across the server components.
 *
 * This function is used in the layout component for the account workspace.
 * It is cached so that the data is only fetched once per request.
 *
 * @param accountSlug
 */
export const loadTeamWorkspace = cache(async (accountSlug: string) => {
  const client = getSupabaseServerComponentClient();
  const api = createTeamAccountsApi(client);

  const workspace = await api.getAccountWorkspace(accountSlug);

  if (workspace.error) {
    throw workspace.error;
  }

  const account = workspace.data.account;

  // we cannot find any record for the selected account
  // so we redirect the user to the home page
  if (!account) {
    return redirect(pathsConfig.app.home);
  }

  return workspace.data;
});
