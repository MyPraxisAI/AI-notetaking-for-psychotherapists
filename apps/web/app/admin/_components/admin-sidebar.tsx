import { Home, Users } from 'lucide-react';

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarItem,
} from '@kit/ui/sidebar';

import { AppLogo } from '~/components/app-logo';
import { ProfileAccountDropdownContainer } from '~/components/personal-account-dropdown-container';

export function AdminSidebar() {
  return (
    <Sidebar>
      <SidebarContent className={'py-4'}>
        <AppLogo href={'/admin'} />
      </SidebarContent>

      <SidebarContent className={'mt-5'}>
        <SidebarGroup label={'Admin'}>
          <SidebarItem end path={'/admin'} Icon={<Home className={'h-4'} />}>
            Home
          </SidebarItem>

          <SidebarItem
            path={'/admin/accounts'}
            Icon={<Users className={'h-4'} />}
          >
            Accounts
          </SidebarItem>
        </SidebarGroup>
      </SidebarContent>

      <SidebarContent className={'absolute bottom-4'}>
        <ProfileAccountDropdownContainer />
      </SidebarContent>
    </Sidebar>
  );
}
