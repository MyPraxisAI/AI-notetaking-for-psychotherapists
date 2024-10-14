import { If } from '@kit/ui/if';
import { Sidebar, SidebarContent, SidebarNavigation } from '@kit/ui/sidebar';

import { AppLogo } from '~/components/app-logo';
import { ProfileAccountDropdownContainer } from '~/components/personal-account-dropdown-container';
import featuresFlagConfig from '~/config/feature-flags.config';
import { personalAccountNavigationConfig } from '~/config/personal-account-navigation.config';
import { UserNotifications } from '~/home/(user)/_components/user-notifications';

// home imports
import type { UserWorkspace } from '../_lib/server/load-user-workspace';
import { HomeAccountSelector } from './home-account-selector';

interface HomeSidebarProps {
  workspace: UserWorkspace;
}

export function HomeSidebar(props: HomeSidebarProps) {
  const { workspace, user, accounts } = props.workspace;
  const collapsed = personalAccountNavigationConfig.sidebarCollapsed;

  return (
    <Sidebar collapsed={collapsed}>
      <SidebarContent className={'h-16 justify-center'}>
        <div className={'flex items-center justify-between space-x-2'}>
          <If
            condition={featuresFlagConfig.enableTeamAccounts}
            fallback={<AppLogo className={'py-2'} />}
          >
            <HomeAccountSelector userId={user.id} accounts={accounts} />
          </If>

          <div className={'hidden group-aria-[expanded=true]/sidebar:block'}>
            <UserNotifications userId={user.id} />
          </div>
        </div>
      </SidebarContent>

      <SidebarContent className={`mt-5 h-[calc(100%-160px)] overflow-y-auto`}>
        <SidebarNavigation config={personalAccountNavigationConfig} />
      </SidebarContent>

      <div className={'absolute bottom-4 left-0 w-full'}>
        <SidebarContent>
          <ProfileAccountDropdownContainer
            user={user}
            account={workspace}
          />
        </SidebarContent>
      </div>
    </Sidebar>
  );
}
