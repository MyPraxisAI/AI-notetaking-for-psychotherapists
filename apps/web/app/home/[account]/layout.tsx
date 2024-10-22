import { use } from 'react';

import { cookies } from 'next/headers';

import { TeamAccountWorkspaceContextProvider } from '@kit/team-accounts/components';
import { If } from '@kit/ui/if';
import {
  Page,
  PageLayoutStyle,
  PageMobileNavigation,
  PageNavigation,
} from '@kit/ui/page';

import { AppLogo } from '~/components/app-logo';
import { getTeamAccountSidebarConfig } from '~/config/team-account-navigation.config';
import { withI18n } from '~/lib/i18n/with-i18n';

// local imports
import { TeamAccountLayoutMobileNavigation } from './_components/team-account-layout-mobile-navigation';
import { TeamAccountLayoutSidebar } from './_components/team-account-layout-sidebar';
import { TeamAccountNavigationMenu } from './_components/team-account-navigation-menu';
import { loadTeamWorkspace } from './_lib/server/team-account-workspace.loader';

type TeamWorkspaceLayoutProps = React.PropsWithChildren<{
  params: Promise<{ account: string }>;
}>;

function TeamWorkspaceLayout({ children, params }: TeamWorkspaceLayoutProps) {
  const account = use(params).account;
  const data = use(loadTeamWorkspace(account));
  const style = use(getLayoutStyle(account));

  const accounts = data.accounts.map(({ name, slug, picture_url }) => ({
    label: name,
    value: slug,
    image: picture_url,
  }));

  return (
    <Page style={style}>
      <PageNavigation>
        <If condition={style === 'sidebar'}>
          <TeamAccountLayoutSidebar
            account={account}
            accountId={data.account.id}
            accounts={accounts}
            user={data.user}
          />
        </If>

        <If condition={style === 'header'}>
          <TeamAccountNavigationMenu workspace={data} />
        </If>
      </PageNavigation>

      <PageMobileNavigation className={'flex items-center justify-between'}>
        <AppLogo />

        <div className={'flex space-x-4'}>
          <TeamAccountLayoutMobileNavigation
            userId={data.user.id}
            accounts={accounts}
            account={account}
          />
        </div>
      </PageMobileNavigation>

      <TeamAccountWorkspaceContextProvider value={data}>
        {children}
      </TeamAccountWorkspaceContextProvider>
    </Page>
  );
}

async function getLayoutStyle(account: string) {
  const cookieStore = await cookies();

  return (
    (cookieStore.get('layout-style')?.value as PageLayoutStyle) ??
    getTeamAccountSidebarConfig(account).style
  );
}

export default withI18n(TeamWorkspaceLayout);
