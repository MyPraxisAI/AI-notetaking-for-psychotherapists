import { use } from 'react';
import { Suspense } from 'react';

import { PageBody } from '@kit/ui/page';
import authConfig from '~/config/auth.config';
import featureFlagsConfig from '~/config/feature-flags.config';
import pathsConfig from '~/config/paths.config';
import { createI18nServerInstance } from '~/lib/i18n/i18n.server';
import { withI18n } from '~/lib/i18n/with-i18n';
import { requireUserInServerComponent } from '~/lib/server/require-user-in-server-component';

// Import the EnhancedSettingsContainer that combines Makerkit functionality with custom tabs
import { EnhancedSettingsContainer } from './_components/enhanced-settings-container';


const features = {
  enableAccountDeletion: featureFlagsConfig.enableAccountDeletion,
  enablePasswordUpdate: authConfig.providers.password,
};

const callbackPath = pathsConfig.auth.callback;
const accountHomePath = pathsConfig.app.accountHome;

const paths = {
  callback: callbackPath + `?next=${accountHomePath}`,
};

export const generateMetadata = async () => {
  const i18n = await createI18nServerInstance();
  const title = i18n.t('account:settingsTab');

  return {
    title,
  };
};

function PersonalAccountSettingsPage() {
  // Require user authentication
  const user = use(requireUserInServerComponent());

  return (
    <PageBody>
      <div className="flex w-full flex-1 flex-col space-y-8">
        <div className="lg:max-w-4xl mx-auto w-full">
          <Suspense fallback={<div className="p-8 text-center">Loading settings...</div>}>
            <EnhancedSettingsContainer 
              userId={user.id}
              features={features}
              paths={paths}
            />
          </Suspense>
        </div>
      </div>
    </PageBody>
  );
}

export default withI18n(PersonalAccountSettingsPage);
