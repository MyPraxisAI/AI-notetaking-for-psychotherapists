import 'server-only';

import { cache } from 'react';

import { redirect } from 'next/navigation';

import { requireUser } from '@kit/supabase/require-user';
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
export const loadTeamWorkspace = cache(workspaceLoader);

async function workspaceLoader(accountSlug: string) {
  const client = getSupabaseServerComponentClient();
  const api = createTeamAccountsApi(client);

  const [workspace, auth] = await Promise.all([
    api.getAccountWorkspace(accountSlug),
    requireUser(client),
  ]);

  // we cannot find any record for the selected account
  // so we redirect the user to the home page
  if (!workspace.data?.account) {
    return redirect(pathsConfig.app.home);
  }

  if (!auth.data) {
    return redirect(auth.redirectTo);
  }

  const user = auth.data;

  return {
    ...workspace.data,
    user,
  };
}
