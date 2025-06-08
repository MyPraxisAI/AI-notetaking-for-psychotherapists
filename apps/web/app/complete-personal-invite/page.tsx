import { redirect } from 'next/navigation';
import { withI18n } from '~/lib/i18n/with-i18n';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { createAccountsApi } from '@kit/web-bg-common';
import { Trans } from '@kit/ui/trans';
import { Alert, AlertDescription, AlertTitle } from '@kit/ui/alert';
import { Spinner } from '@kit/ui/spinner';
import type { Metadata } from 'next';

import { completePersonalInviteAction } from './_lib/server/server-actions';

export const metadata: Metadata = {
  title: 'Completing Personal Invitation',
};

/**
 * Server component that processes personal invitations after authentication
 */
async function CompletePersonalInvitePage({
  searchParams,
}: {
  searchParams: { personal_invite_token?: string };
}) {
  // In Next.js 15, we need to await searchParams
  const params = await searchParams;
  const personalInviteToken = params.personal_invite_token;

  // Handle invalid request
  if (!personalInviteToken) {
    return redirect('/home');
  }

  // Check authentication and get user's personal account ID
  const client = getSupabaseServerClient();
  const accountsApi = createAccountsApi(client);
  
  try {
    const accountId = await accountsApi.getCurrentAccountId();
    
    // If no account ID found, redirect to sign-in
    if (!accountId) {
      return redirect(`/auth/sign-in?personal_invite_token=${personalInviteToken}`);
    }
    
    // Process the invitation
    const result = await completePersonalInviteAction({
      token: personalInviteToken,
      invitedAccountId: accountId,
    });
    
    // After successful processing, redirect to the dashboard
    return redirect('/home');
  } catch (error) {
    // Rethrow NEXT_REDIRECT errors so they're handled by Next.js
    if ((error as any)?.digest?.startsWith('NEXT_REDIRECT')) {
      throw error;
    }
    
    // If error is due to authentication, redirect to sign-in
    if ((error as any)?.status === 401) {
      return redirect(`/auth/sign-in?personal_invite_token=${personalInviteToken}`);
    }
    
    // Log the error for debugging
    console.error('Error completing personal invite:', error);
    
    // For errors, we render an error UI and provide a link to continue
    return (
      <div className="flex h-full w-full flex-col items-center justify-center p-4">
        <Alert variant="destructive" className="mb-4 max-w-md">
          <AlertTitle>
            <Trans i18nKey="common:errorAlertTitle" />
          </AlertTitle>
          <AlertDescription>
            <Trans i18nKey="common:errorProcessingInvitation" />
          </AlertDescription>
        </Alert>

        <a
          href="/home"
          className="text-primary underline underline-offset-4 hover:text-primary/90"
        >
          <Trans i18nKey="common:continueToApp" />
        </a>
      </div>
    );
  }

  // Show loading UI while processing
  return (
    <div className="flex h-full w-full flex-col items-center justify-center p-4">
      <div className="mb-4">
        <Spinner className="h-8 w-8" />
      </div>
      <p>
        <Trans i18nKey="auth:processingInvitation" />
      </p>
    </div>
  );
}

export default withI18n(CompletePersonalInvitePage);
