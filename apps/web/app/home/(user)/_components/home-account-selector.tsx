'use client';

import { useContext } from 'react';

import { useRouter } from 'next/navigation';

import { AccountSelector } from '@kit/accounts/account-selector';
import { SidebarContext } from '@kit/ui/sidebar';

import featureFlagsConfig from '~/config/feature-flags.config';
import pathsConfig from '~/config/paths.config';

const features = {
  enableTeamCreation: featureFlagsConfig.enableTeamCreation,
};

export function HomeAccountSelector(props: {
  accounts: Array<{
    label: string | null;
    value: string | null;
    image: string | null;
  }>;

  userId: string;
}) {
  const router = useRouter();
  const { collapsed } = useContext(SidebarContext);

  return (
    <AccountSelector
      collapsed={collapsed}
      accounts={props.accounts}
      features={features}
      userId={props.userId}
      onAccountChange={(value) => {
        if (value) {
          const path = pathsConfig.app.accountHome.replace('[account]', value);
          router.replace(path);
        }
      }}
    />
  );
}
