import { use, Suspense } from 'react';

import { UserWorkspaceContextProvider } from '@kit/accounts/components';
import { Page } from '@kit/ui/page';
import { LoadingOverlay } from '@kit/ui/loading-overlay';
import { withI18n } from '~/lib/i18n/with-i18n';

// Import only what we need
import { loadUserWorkspace } from './_lib/server/load-user-workspace';

export const metadata = {
  title: 'MyPraxis',
};

function UserHomeLayout({ children }: React.PropsWithChildren) {
  // We'll use a single layout with style='custom' for all routes
  return <CustomLayout>{children}</CustomLayout>;
}

export default withI18n(UserHomeLayout);

function CustomLayout({ children }: React.PropsWithChildren) {
  const workspace = use(loadUserWorkspace());
  
  return (
    <UserWorkspaceContextProvider value={workspace}>
      {/* Using style='custom' to completely remove the MakerKit sidebar UI */}
      <Page style={'custom'}>
        <div className="w-full h-full">
          <Suspense fallback={<LoadingOverlay />}>
            {children}
          </Suspense>
        </div>
      </Page>
    </UserWorkspaceContextProvider>
  );
}


