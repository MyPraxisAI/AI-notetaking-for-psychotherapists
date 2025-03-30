import { use } from 'react';
import { Suspense } from 'react';

import { PageBody } from '@kit/ui/page';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@kit/ui/tabs';
import { Trans } from '@kit/ui/trans';
import { PersonalAccountSettingsContainer } from '@kit/accounts/personal-account-settings';

import authConfig from '~/config/auth.config';
import featureFlagsConfig from '~/config/feature-flags.config';
import pathsConfig from '~/config/paths.config';
import { createI18nServerInstance } from '~/lib/i18n/i18n.server';
import { withI18n } from '~/lib/i18n/with-i18n';
import { requireUserInServerComponent } from '~/lib/server/require-user-in-server-component';

// Import the therapist settings form component
import { TherapistSettingsForm } from './_components/therapist-settings-form';

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
  const user = use(requireUserInServerComponent());

  return (
    <PageBody>
      <div className="flex w-full flex-1 flex-col space-y-8">
        <Tabs defaultValue="account" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-8">
            <TabsTrigger value="account">
              <Trans i18nKey="settings:tabs.account">Account Settings</Trans>
            </TabsTrigger>
            <TabsTrigger value="therapist">
              <Trans i18nKey="settings:tabs.therapist">Therapist Settings</Trans>
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="account" className="space-y-4">
            <div className="lg:max-w-2xl">
              <PersonalAccountSettingsContainer
                userId={user.id}
                features={features}
                paths={paths}
              />
            </div>
          </TabsContent>
          
          <TabsContent value="therapist" className="space-y-4">
            <Suspense fallback={<div className="p-8 text-center">Loading therapist settings...</div>}>
              <TherapistSettingsForm />
            </Suspense>
          </TabsContent>
        </Tabs>
      </div>
    </PageBody>
  );
}

export default withI18n(PersonalAccountSettingsPage);
