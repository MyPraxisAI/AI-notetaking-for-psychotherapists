import { use } from 'react';

import { If } from '@kit/ui/if';
import { Page, PageMobileNavigation, PageNavigation } from '@kit/ui/page';

import { AppLogo } from '~/components/app-logo';
import { personalAccountNavigationConfig } from '~/config/personal-account-navigation.config';
import { withI18n } from '~/lib/i18n/with-i18n';

// home imports
import { HomeMenuNavigation } from './_components/home-menu-navigation';
import { HomeMobileNavigation } from './_components/home-mobile-navigation';
import { HomeSidebar } from './_components/home-sidebar';
import { loadUserWorkspace } from './_lib/server/load-user-workspace';

const style = personalAccountNavigationConfig.style;

function UserHomeLayout({ children }: React.PropsWithChildren) {
  const workspace = use(loadUserWorkspace());

  return (
    <Page style={style}>
      <PageNavigation>
        <If condition={style === 'header'}>
          <HomeMenuNavigation workspace={workspace} />
        </If>

        <If condition={style === 'sidebar'}>
          <HomeSidebar workspace={workspace} />
        </If>
      </PageNavigation>

      <PageMobileNavigation className={'flex items-center justify-between'}>
        <AppLogo />
        <HomeMobileNavigation workspace={workspace} />
      </PageMobileNavigation>

      {children}
    </Page>
  );
}

export default withI18n(UserHomeLayout);
