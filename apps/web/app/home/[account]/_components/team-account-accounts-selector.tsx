'use client';

import { useRouter } from 'next/navigation';

import { AccountSelector } from '@kit/accounts/account-selector';

import featureFlagsConfig from '~/config/feature-flags.config';
import pathsConfig from '~/config/paths.config';

const features = {
  enableTeamCreation: featureFlagsConfig.enableTeamCreation,
};

export function TeamAccountAccountsSelector(params: {
  selectedAccount: string;
  accounts: Array<{
    label: string | null;
    value: string | null;
    image: string | null;
  }>;
}) {
  const router = useRouter();

  return (
    <AccountSelector
      selectedAccount={params.selectedAccount}
      accounts={params.accounts}
      collapsed={false}
      features={features}
      onAccountChange={(value) => {
        const path = value
          ? pathsConfig.app.accountHome.replace('[account]', value)
          : pathsConfig.app.home;

        router.replace(path);
      }}
    />
  );
}
