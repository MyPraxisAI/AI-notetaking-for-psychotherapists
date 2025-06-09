import Link from 'next/link';

import { SignInMethodsContainer } from '@kit/auth/sign-in';
import { Button } from '@kit/ui/button';
import { Heading } from '@kit/ui/heading';
import { Trans } from '@kit/ui/trans';

import authConfig from '~/config/auth.config';
import featuresFlagConfig from '~/config/feature-flags.config';
import pathsConfig from '~/config/paths.config';
import { createI18nServerInstance } from '~/lib/i18n/i18n.server';
import { withI18n } from '~/lib/i18n/with-i18n';

interface SignInPageProps {
  searchParams: Promise<{
    invite_token?: string;
    personal_invite_token?: string;
    next?: string;
  }>;
}

export const generateMetadata = async () => {
  const i18n = await createI18nServerInstance();

  return {
    title: i18n.t('auth:signIn'),
  };
};

async function SignInPage({ searchParams }: SignInPageProps) {
  // Get both team and personal invitation tokens
  const resolvedParams = await searchParams;
  const { invite_token: inviteToken, personal_invite_token: personalInviteToken, next = '' } = resolvedParams;
  
  // Check if invitation-only mode is enabled
  const isInvitationOnlyMode = featuresFlagConfig.enableInvitationOnlySignup;
  
  // Create the sign-up URL with the appropriate token
  const signUpParams = new URLSearchParams();
  
  if (personalInviteToken) {
    signUpParams.append('personal_invite_token', personalInviteToken);
  } else if (inviteToken) {
    signUpParams.append('invite_token', inviteToken);
  }
  
  const signUpPath = `${pathsConfig.auth.signUp}${signUpParams.toString() ? `?${signUpParams.toString()}` : ''}`;

  const paths = {
    callback: pathsConfig.auth.callback,
    returnPath: next ?? pathsConfig.app.home,
    joinTeam: pathsConfig.app.joinTeam,
  };

  return (
    <>
      <div className={'flex flex-col items-center gap-1'}>
        <Heading level={4} className={'tracking-tight'}>
          <Trans i18nKey={'auth:signInHeading'} />
        </Heading>

        <p className={'text-muted-foreground text-sm'}>
          <Trans i18nKey={'auth:signInSubheading'} />
        </p>
      </div>

      <SignInMethodsContainer
        personalInviteToken={personalInviteToken}
        teamInviteToken={inviteToken}
        paths={paths}
        providers={authConfig.providers}
      />

      {/* Only show sign-up link if not in invitation-only mode or if the user has an invitation token */}
      {(!isInvitationOnlyMode) && (
        <div className={'flex justify-center'}>
          <Button asChild variant={'link'} size={'sm'}>
            <Link href={signUpPath}>
              <Trans i18nKey={'auth:doNotHaveAccountYet'} />
            </Link>
          </Button>
        </div>
      )}
    </>
  );
}

export default withI18n(SignInPage);
