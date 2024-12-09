import { AuthLayoutShell } from '@kit/auth/shared';

import { AppLogo } from '~/components/app-logo';
import { BackgroundHue } from '~/components/background-hue';

function AuthLayout({ children }: React.PropsWithChildren) {
  return (
    <AuthLayoutShell Logo={AppLogo}>
      {children}

      <BackgroundHue />
    </AuthLayoutShell>
  );
}

export default AuthLayout;
