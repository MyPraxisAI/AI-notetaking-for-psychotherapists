import type { User } from '@supabase/supabase-js';

import { AppLogo } from '~/components/app-logo';

import { SiteHeaderAccountSection } from './site-header-account-section';
import { SiteNavigation } from './site-navigation';

export function SiteHeader(props: { user?: User | null }) {
  return (
    <div
      className={
        'sticky top-0 z-10 w-full bg-background/80 backdrop-blur-md dark:bg-background/50 py-2 site-header'
      }
    >
      <div className={'container'}>
        <div className="grid h-14 grid-cols-3 items-center">
          <div>
            <AppLogo />
          </div>

          <div className={'order-first md:order-none'}>
            <SiteNavigation />
          </div>

          <div className={'flex items-center justify-end space-x-1'}>
            <SiteHeaderAccountSection user={props.user ?? null} />
          </div>
        </div>
      </div>
    </div>
  );
}
