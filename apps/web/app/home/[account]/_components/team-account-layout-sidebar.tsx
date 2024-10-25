'use client';

import type { User } from '@supabase/supabase-js';

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarProvider,
  useSidebar,
} from '@kit/ui/shadcn-sidebar';
import { cn } from '@kit/ui/utils';

import { ProfileAccountDropdownContainer } from '~/components//personal-account-dropdown-container';
import { getTeamAccountSidebarConfig } from '~/config/team-account-navigation.config';
import { TeamAccountNotifications } from '~/home/[account]/_components/team-account-notifications';

import { TeamAccountAccountsSelector } from '../_components/team-account-accounts-selector';
import { TeamAccountLayoutSidebarNavigation } from './team-account-layout-sidebar-navigation';

type AccountModel = {
  label: string | null;
  value: string | null;
  image: string | null;
};

export function TeamAccountLayoutSidebar(props: {
  account: string;
  accountId: string;
  accounts: AccountModel[];
  user: User;
}) {
  const minimized = getTeamAccountSidebarConfig(props.account).sidebarCollapsed;

  return (
    <SidebarProvider minimized={minimized}>
      <SidebarContainer
        account={props.account}
        accountId={props.accountId}
        accounts={props.accounts}
        user={props.user}
      />
    </SidebarProvider>
  );
}

function SidebarContainer(props: {
  account: string;
  accountId: string;
  accounts: AccountModel[];
  user: User;
}) {
  const { account, accounts, user } = props;
  const userId = user.id;
  const { minimized } = useSidebar();

  const className = cn(
    'flex max-w-full items-center justify-between space-x-4',
    {
      'w-full justify-start space-x-0': minimized,
    },
  );

  return (
    <Sidebar>
      <SidebarHeader className={'h-16 justify-center'}>
        <div className={className}>
          <TeamAccountAccountsSelector
            userId={userId}
            selectedAccount={account}
            accounts={accounts}
            collapsed={minimized}
          />

          <div className="group-data-[minimized=true]:hidden">
            <TeamAccountNotifications
              userId={userId}
              accountId={props.accountId}
            />
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className={`mt-5 h-[calc(100%-160px)] overflow-y-auto`}>
        <TeamAccountLayoutSidebarNavigation account={account} />
      </SidebarContent>

      <SidebarFooter>
        <SidebarContent>
          <ProfileAccountDropdownContainer user={props.user} />
        </SidebarContent>
      </SidebarFooter>
    </Sidebar>
  );
}
