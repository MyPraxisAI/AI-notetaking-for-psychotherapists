import Link from 'next/link';
import { redirect } from 'next/navigation';

import { Button } from '@kit/ui/button';
import { Heading } from '@kit/ui/heading';
import { Trans } from '@kit/ui/trans';
import { Alert, AlertDescription, AlertTitle } from '@kit/ui/alert';

import authConfig from '~/config/auth.config';
import featuresFlagConfig from '~/config/feature-flags.config';
import pathsConfig from '~/config/paths.config';
import { createI18nServerInstance } from '~/lib/i18n/i18n.server';
import { withI18n } from '~/lib/i18n/with-i18n';
import { isPersonalInviteTokenValidAction } from '@kit/personal-invitations';

// Import the client wrapper component
import { SignUpClientWrapper } from './sign-up-client-wrapper';



export const generateMetadata = async () => {
  const i18n = await createI18nServerInstance();

  return {
    title: i18n.t('auth:signUp'),
  };
};

interface Props {
  searchParams: Promise<{
    invite_token?: string;
    personal_invite_token?: string;
  }>;
}

const paths = {
  callback: pathsConfig.auth.callback,
  appHome: pathsConfig.app.home,
};

async function SignUpPage({ searchParams }: Props) {
  const i18n = await createI18nServerInstance();
  const resolvedParams = await searchParams;
  const inviteToken = resolvedParams.invite_token;
  const personalInviteToken = resolvedParams.personal_invite_token;
  const isInvitationOnlyMode = featuresFlagConfig.enableInvitationOnlySignup;
  
  // Check if we have any type of invitation token
  const hasToken = !!inviteToken || !!personalInviteToken;
  
  // In invitation-only mode, redirect to sign-in if no token is provided
  if (isInvitationOnlyMode && !hasToken) {
    return (
      <>
        <div className={'flex flex-col items-center gap-1'}>
          <Heading level={4} className={'tracking-tight'}>
            <Trans i18nKey={'auth:signUpHeading'} />
          </Heading>
        </div>

        <Alert variant="destructive" className="my-4">
          <AlertTitle>{i18n.t('auth:invitationRequired')}</AlertTitle>
          <AlertDescription>
            {i18n.t('auth:invitationRequiredDescription')}
          </AlertDescription>
        </Alert>
        
        <div className={'flex justify-center mt-4'}>
          <Button asChild variant={'default'}>
            <Link href={pathsConfig.auth.signIn}>
              <Trans i18nKey={'auth:backToSignIn'} />
            </Link>
          </Button>
        </div>
      </>
    );
  }
  
  // If we have a personal invitation token, validate it
  let personalInviteValid = false;
  let personalInviteEmail = '';
  let personalInviteLanguage: string | null = null;
  
  if (personalInviteToken) {
    const result = await isPersonalInviteTokenValidAction({ token: personalInviteToken });
    personalInviteValid = result.valid;
    personalInviteEmail = result.email || '';
    personalInviteLanguage = result.language;
    
    // Show error for invalid personal invitation token
    if (!personalInviteValid) {
      return (
        <>
          <div className={'flex flex-col items-center gap-1'}>
            <Heading level={4} className={'tracking-tight'}>
              <Trans i18nKey={'auth:invalidInvitation'} />
            </Heading>
          </div>

          <Alert variant="destructive" className="my-4">
            <AlertTitle>{i18n.t('auth:invalidInvitationToken')}</AlertTitle>
            <AlertDescription>
              {i18n.t('auth:invalidInvitationTokenDescription')}
            </AlertDescription>
          </Alert>
          
          <div className={'flex justify-center mt-4'}>
            <Button asChild variant={'default'}>
              <Link href={pathsConfig.auth.signIn}>
                <Trans i18nKey={'auth:backToSignIn'} />
              </Link>
            </Button>
          </div>
        </>
      );
    }
  }

  // Determine which token to pass to the sign-up component
  // Priority: Personal invite token > Team invite token
  const tokenToUse = personalInviteToken || inviteToken;
  const signInPath =
    pathsConfig.auth.signIn +
    (tokenToUse ? `?invite_token=${tokenToUse}` : '');

  return (
    <>
      <div className={'flex flex-col items-center gap-1'}>
        <Heading level={4} className={'tracking-tight'}>
          <Trans i18nKey={'auth:signUpHeading'} />
        </Heading>

        <p className={'text-muted-foreground text-sm'}>
          <Trans i18nKey={'auth:signUpSubheading'} />
        </p>
        
        {personalInviteValid && personalInviteEmail && (
          <Alert variant="default" className="mt-4 bg-primary/5 border-primary/10">
            <AlertDescription>
              {i18n.t('auth:signingUpWithInvitation', { email: personalInviteEmail })}
            </AlertDescription>
          </Alert>
        )}
      </div>

      <SignUpClientWrapper
        providers={authConfig.providers}
        displayTermsCheckbox={authConfig.displayTermsCheckbox}
        inviteToken={tokenToUse}
        isPersonalInvite={!!personalInviteValid}
        preferredLanguage={personalInviteLanguage}
        defaultEmail={personalInviteValid ? personalInviteEmail : undefined}
        paths={paths}
      />

      {/* Only show the sign-in link if not using a personal invitation */}
      {!personalInviteValid && (
        <div className={'flex justify-center'}>
          <Button asChild variant={'link'} size={'sm'}>
            <Link href={signInPath}>
              <Trans i18nKey={'auth:alreadyHaveAnAccount'} />
            </Link>
          </Button>
        </div>
      )}
    </>
  );
}

export default withI18n(SignUpPage);
