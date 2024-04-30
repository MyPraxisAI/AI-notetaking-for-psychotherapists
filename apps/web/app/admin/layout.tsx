import {
  Page,
  PageBody,
  PageHeader,
  PageMobileNavigation,
  PageNavigation,
} from '@kit/ui/page';

import { AdminSidebar } from '~/admin/_components/admin-sidebar';
import { AdminMobileNavigation } from '~/admin/_components/mobile-navigation';

export const metadata = {
  title: `Super Admin`,
};

export default function AdminLayout(props: React.PropsWithChildren) {
  return (
    <Page style={'sidebar'}>
      <PageHeader
        title={'Super Admin'}
        description={`Your SaaS stats at a glance`}
      />

      <PageNavigation>
        <AdminSidebar />
      </PageNavigation>

      <PageMobileNavigation>
        <AdminMobileNavigation />
      </PageMobileNavigation>

      <PageBody>{props.children}</PageBody>
    </Page>
  );
}
