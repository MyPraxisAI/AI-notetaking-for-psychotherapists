import { createGoogleAnalyticsService } from '@kit/google-analytics';
import { createPostHogAnalyticsService } from '@kit/posthog';

import { createAnalyticsManager } from './analytics-manager';
import type { AnalyticsManager } from './types';

// analytics only enabled in production
const isProd = process.env.NODE_ENV === 'production';

export const analytics: AnalyticsManager = createAnalyticsManager({
  providers: {
    'google-analytics': isProd ? createGoogleAnalyticsService : undefined as any,
    posthog: isProd ? createPostHogAnalyticsService : undefined as any,
  },
});
