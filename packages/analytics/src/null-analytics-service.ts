import { AnalyticsService } from './types';

const noop = () => {
  // do nothing - this is to prevent errors when the analytics service is not initialized
};

/**
 * Null analytics service that does nothing. It is initialized with a noop function. This is useful for testing or when
 * the user is calling analytics methods before the analytics service is initialized.
 */
export const NullAnalyticsService: AnalyticsService = {
  initialize: noop,
  trackPageView: noop,
  trackEvent: noop,
  identify: noop,
};
