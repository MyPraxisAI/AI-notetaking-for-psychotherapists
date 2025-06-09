'use client';

import { useEffect } from 'react';
import { Provider } from '@supabase/supabase-js';
import { SignUpMethodsContainer } from '@kit/auth/sign-up';
import { useTranslation } from 'react-i18next';

/**
 * Client component wrapper for the sign-up page
 * This creates a proper server/client boundary for passing data
 * from the server component to the client component
 */
export function SignUpClientWrapper({
  teamInviteToken,
  personalInviteToken,
  preferredLanguage,
  defaultEmail,
  providers,
  displayTermsCheckbox,
  paths,
}: {
  teamInviteToken?: string;
  personalInviteToken?: string;
  preferredLanguage?: string | null;
  defaultEmail?: string;
  providers: {
    password: boolean;
    magicLink: boolean;
    oAuth: Provider[];
  };
  displayTermsCheckbox?: boolean;
  paths: {
    callback: string;
    appHome: string;
  };
}) {
  const { i18n } = useTranslation();

  // Set the language from the personal invitation if available and different from current
  useEffect(() => {
    if (preferredLanguage && i18n.language !== preferredLanguage) {
      i18n.changeLanguage(preferredLanguage);
    }
  }, [preferredLanguage, i18n]);
  
  return (
    <SignUpMethodsContainer
      providers={providers}
      displayTermsCheckbox={displayTermsCheckbox}
      teamInviteToken={teamInviteToken}
      personalInviteToken={personalInviteToken}
      defaultEmail={defaultEmail}
      paths={paths}
    />
  );
}
