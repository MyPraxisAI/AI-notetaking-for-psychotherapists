import { Suspense } from 'react';
import { withI18n } from '~/lib/i18n/with-i18n';
import { LoadingOverlay } from '@kit/ui/loading-overlay';

export const metadata = {
  title: 'MyPraxis',
};

function MyPraxisLayout({ children }: React.PropsWithChildren) {
  return (
    <div className="w-full h-full">
      <Suspense fallback={<LoadingOverlay />}>
        {children}
      </Suspense>
    </div>
  );
}

export default withI18n(MyPraxisLayout);
