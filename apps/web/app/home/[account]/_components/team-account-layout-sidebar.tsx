'use client';

import { useContext } from 'react';

import type { User } from '@supabase/supabase-js';

import { Sidebar, SidebarContent, SidebarContext } from '@kit/ui/sidebar';
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
  const collapsed = getTeamAccountSidebarConfig(props.account).sidebarCollapsed;

  return (
    <Sidebar collapsed={collapsed}>
      <SidebarContainer
        account={props.account}
        accountId={props.accountId}
        accounts={props.accounts}
        user={props.user}
      />
    </Sidebar>
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
  const { collapsed } = useContext(SidebarContext);

  const className = cn(
    'flex max-w-full items-center justify-between space-x-4',
    {
      'w-full justify-start space-x-0': collapsed,
    },
  );

  return (
    <>
      <SidebarContent className={'h-16 justify-center'}>
        <div className={className}>
          <TeamAccountAccountsSelector
            userId={userId}
            selectedAccount={account}
            accounts={accounts}
            collapsed={collapsed}
          />

          <div
            className={cn({
              hidden: collapsed,
            })}
          >
            <TeamAccountNotifications
              userId={userId}
              accountId={props.accountId}
            />
          </div>
        </div>
      </SidebarContent>

      <SidebarContent className={`mt-5 h-[calc(100%-160px)] overflow-y-auto`}>
        <TeamAccountLayoutSidebarNavigation account={account} />
      </SidebarContent>

      <div className={'absolute bottom-4 left-0 w-full'}>
        <SidebarContent>
          <ProfileAccountDropdownContainer
            user={props.user}
          />
        </SidebarContent>
      </div>
    </>
  );
}
