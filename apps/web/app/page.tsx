import { redirect } from 'next/navigation';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import pathsConfig from '~/config/paths.config';
import { withI18n } from '~/lib/i18n/with-i18n';

async function RootPage() {
  // Get the user session on the server
  const client = getSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();

  // Redirect based on authentication status
  if (user) {
    // If user is logged in, redirect to the personal workspace
    redirect(pathsConfig.app.home);
  } else {
    // If user is not logged in, redirect to sign in page
    redirect(pathsConfig.auth.signIn);
  }

  // This won't be reached due to the redirects
  return null;
}

export default withI18n(RootPage);
