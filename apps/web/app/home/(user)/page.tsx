import { redirect } from 'next/navigation';

import { createI18nServerInstance } from '~/lib/i18n/i18n.server';
import { withI18n } from '~/lib/i18n/with-i18n';

export const generateMetadata = async () => {
  const i18n = await createI18nServerInstance();
  const title = i18n.t('account:homePage');

  return {
    title,
  };
};

// This server component redirects to /home/mypraxis
function UserHomePage() {
  // Use Next.js's redirect function to redirect to /home/mypraxis
  redirect('/home/mypraxis');

  // This won't be reached due to the redirect
  return null;
}

export default withI18n(UserHomePage);
