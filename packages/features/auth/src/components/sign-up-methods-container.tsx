'use client';

import type { Provider } from '@supabase/supabase-js';

import { isBrowser } from '@kit/shared/utils';
import { Alert, AlertDescription, AlertTitle } from '@kit/ui/alert';
import { If } from '@kit/ui/if';
import { Separator } from '@kit/ui/separator';
import { Trans } from '@kit/ui/trans';

import { MagicLinkAuthContainer } from './magic-link-auth-container';
import { OauthProviders } from './oauth-providers';
import { EmailPasswordSignUpContainer } from './password-sign-up-container';

export function SignUpMethodsContainer(props: {
  paths: {
    callback: string;
    appHome: string;
  };

  providers: {
    password: boolean;
    magicLink: boolean;
    oAuth: Provider[];
  };

  displayTermsCheckbox?: boolean;
  teamInviteToken?: string;
  personalInviteToken?: string;
  defaultEmail?: string;
}) {
  const redirectUrl = getCallbackUrl(props);
  // Use provided defaultEmail or fall back to URL params
  const defaultValues = props.defaultEmail 
    ? { email: props.defaultEmail } 
    : getDefaultValues();

  // Determine if we have a team invite to show the team invite alert
  const hasTeamInvite = !!props.teamInviteToken;
  
  return (
    <>
      <If condition={hasTeamInvite}>
        <InviteAlert />
      </If>

      <If condition={props.providers.password}>
        <EmailPasswordSignUpContainer
          emailRedirectTo={redirectUrl}
          defaultValues={defaultValues}
          displayTermsCheckbox={props.displayTermsCheckbox}
        />
      </If>

      <If condition={props.providers.magicLink}>
        <MagicLinkAuthContainer
          teamInviteToken={props.teamInviteToken}
          personalInviteToken={props.personalInviteToken}
          redirectUrl={redirectUrl}
          shouldCreateUser={true}
          defaultValues={defaultValues}
          displayTermsCheckbox={props.displayTermsCheckbox}
        />
      </If>

      <If condition={props.providers.oAuth.length}>
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <Separator />
          </div>

          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background text-muted-foreground px-2">
              <Trans i18nKey="auth:orContinueWith" />
            </span>
          </div>
        </div>

        <OauthProviders
          enabledProviders={props.providers.oAuth}
          teamInviteToken={props.teamInviteToken}
          personalInviteToken={props.personalInviteToken}
          shouldCreateUser={true}
          paths={{
            callback: props.paths.callback,
            returnPath: props.paths.appHome,
          }}
        />
      </If>
    </>
  );
}

function getCallbackUrl(props: {
  paths: {
    callback: string;
    appHome: string;
  };

  teamInviteToken?: string;
  personalInviteToken?: string;
}) {
  if (!isBrowser()) {
    return '';
  }

  const redirectPath = props.paths.callback;
  const origin = window.location.origin;
  const url = new URL(redirectPath, origin);

  // Only pass team invite token as invite_token parameter
  if (props.teamInviteToken) {
    url.searchParams.set('invite_token', props.teamInviteToken);
  }
  
  // For personal invites, we use a different parameter to avoid confusion
  if (props.personalInviteToken) {
    url.searchParams.set('personal_invite_token', props.personalInviteToken);
  }

  const searchParams = new URLSearchParams(window.location.search);
  const next = searchParams.get('next');

  if (next) {
    url.searchParams.set('next', next);
  }

  return url.href;
}

function getDefaultValues() {
  if (!isBrowser()) {
    return { email: '' };
  }

  // Just get the email from the search params if it exists
  const searchParams = new URLSearchParams(window.location.search);
  const email = searchParams.get('email') || '';
  
  return { email };
}

function InviteAlert() {
  return (
    <Alert variant={'info'}>
      <AlertTitle>
        <Trans i18nKey={'auth:inviteAlertHeading'} />
      </AlertTitle>

      <AlertDescription>
        <Trans i18nKey={'auth:inviteAlertBody'} />
      </AlertDescription>
    </Alert>
  );
}
