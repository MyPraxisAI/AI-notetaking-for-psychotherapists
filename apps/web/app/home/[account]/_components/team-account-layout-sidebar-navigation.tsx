import { SidebarNavigation } from '@kit/ui/shadcn-sidebar';

import { getTeamAccountSidebarConfig } from '~/config/team-account-navigation.config';

export function TeamAccountLayoutSidebarNavigation({
  account,
}: React.PropsWithChildren<{
  account: string;
}>) {
  const routes = getTeamAccountSidebarConfig(account);

  return <SidebarNavigation config={routes} />;
}
