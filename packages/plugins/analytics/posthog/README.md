## PostHog Plugin

Install the Posthog plugin with the following command:

```bash
npx @makerkit/cli plugins install
```

Then choose the Posthog Plugin from the list of available plugins.

### Install Plugin in the Analytics package

To install the plugin in the Analytics package, run the following command:

```bash
pnpm add "@kit/posthog@workspace:*" --filter analytics -D
```

You can now use the Posthog plugin in the Analytics package. Update the `packages/analytics/src/index.ts` file as follows:

```tsx
import { createPostHogAnalyticsService } from '@kit/posthog';

import { createAnalyticsManager } from './analytics-manager';
import type { AnalyticsManager } from './types';

export const analytics: AnalyticsManager = createAnalyticsManager({
  providers: {
    posthog: createPostHogAnalyticsService,
  },
});
```

### Configuration

Please add the following environment variables to your `.env` file:

```bash
NEXT_PUBLIC_POSTHOG_KEY=phc_your_key_here
NEXT_PUBLIC_POSTHOG_HOST=https://eu.posthog.com
NEXT_PUBLIC_POSTHOG_INGESTION_URL=http://localhost:3000/ingest
```

#### Reverse proxy to get around adblockers

In your apps/web/next.config.mjs file, add the following config:

```js
/** @type {import('next').NextConfig} */
const config = {
  // ...other config
  // This is required to support PostHog trailing slash API requests
  skipTrailingSlashRedirect: true,
  async rewrites() {
    // NOTE: change `eu` to `us` if applicable
    return [
      {
        source: '/ingest/static/:path*',
        destination: 'https://eu-assets.i.posthog.com/static/:path*',
      },
      {
        source: '/ingest/:path*',
        destination: 'https://eu.i.posthog.com/:path*',
      },
    ];
  }
}
```

Make sure to disallow the middleware from running against the `ingest` path.

```tsx title="apps/web/middleware.ts"
export const config = {
    matcher: ['/((?!_next/static|_next/image|images|locales|assets|ingest/*|api/*).*)'],
};
```

We added the `ingest` path to the matcher to prevent the middleware from running against the `ingest` path.

## Server Side Usage

Before tracking events server side, you need to identify the user. You can do this by calling the `identify` method:

```tsx
import { AnalyticsManager } from '@kit/analytics';

const analytics: AnalyticsManager = createAnalyticsManager({
  providers: {
    posthog: createPostHogAnalyticsService,
  },
});
```

Then, you can track events:

```tsx
await analytics.identify(userId);

await analytics.trackEvent('buttonClicked', {
    button: 'login',
});
```

If it's an anonymous user, you can call the `identify` method with any ID.

Normally, you'd get the ID from the Supabase clients:

```tsx
import { getSupabaseServerClient } from "@kit/supabase/server-client";

const client = getSupabaseServerClient();
const { data: { user } } = await client.auth.getUser();

if (user) {
    await analytics.identify(user.id);
} else {
    await analytics.identify('anonymous');
}

await analytics.trackEvent('buttonClicked', {
    button: 'login',
});
```