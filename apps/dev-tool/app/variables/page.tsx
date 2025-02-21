import { use } from 'react';

import {
  processEnvDefinitions,
  scanMonorepoEnv,
} from '@/app/variables/lib/env-scanner';
import { EnvMode } from '@/app/variables/lib/types';

import { AppBreadcrumbs } from '@kit/ui/app-breadcrumbs';
import { Page, PageBody, PageHeader } from '@kit/ui/page';

import { AppEnvironmentVariablesManager } from './components/app-environment-variables-manager';

type VariablesPageProps = {
  searchParams: Promise<{ mode?: EnvMode }>;
};

export const metadata = {
  title: 'Environment Variables',
};

export default function VariablesPage({ searchParams }: VariablesPageProps) {
  const { mode = 'development' } = use(searchParams);
  const apps = use(scanMonorepoEnv({ mode }));

  return (
    <Page style={'custom'}>
      <PageHeader
        displaySidebarTrigger={false}
        description={
          <AppBreadcrumbs
            values={{
              variables: 'Environment Variables',
            }}
          />
        }
      />

      <PageBody>
        <div className={'flex flex-col space-y-4 pb-16'}>
          {apps.map((app) => {
            const appEnvState = processEnvDefinitions(app, mode);

            return (
              <AppEnvironmentVariablesManager
                key={app.appName}
                state={appEnvState}
              />
            );
          })}
        </div>
      </PageBody>
    </Page>
  );
}
