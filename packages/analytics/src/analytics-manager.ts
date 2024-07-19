import { NullAnalyticsService } from './null-analytics-service';
import {
  AnalyticsManager,
  AnalyticsService,
  CreateAnalyticsManagerOptions,
} from './types';

/**
 * Creates an analytics manager that can be used to track page views and events. The manager is initialized with a
 * default provider and can be switched to a different provider at any time. The manager will use a NullAnalyticsService
 * if the provider is not registered.
 * @param options
 */
export function createAnalyticsManager<T extends string, Config extends object>(
  options: CreateAnalyticsManagerOptions<T, Config>,
): AnalyticsManager {
  let activeService: AnalyticsService = NullAnalyticsService;

  const getActiveService = (): AnalyticsService => {
    if (activeService === NullAnalyticsService) {
      console.warn(
        'Analytics service not initialized. Using NullAnalyticsService.',
      );
    }

    return activeService;
  };

  const initialize = (provider: T, config: Config) => {
    const factory = options.providers[provider];

    if (!factory) {
      console.error(
        `Analytics provider '${provider}' not registered. Using NullAnalyticsService.`,
      );

      activeService = NullAnalyticsService;
      return;
    }

    activeService = factory(config);
    activeService.initialize();
  };

  // Initialize with the default provider
  initialize(options.defaultProvider, {} as Config);

  return {
    identify: (userId: string, traits?: Record<string, string>) => {
      return getActiveService().identify(userId, traits);
    },

    /**
     * Track a page view with the given URL.
     * @param url
     */
    trackPageView: (url: string) => {
      return getActiveService().trackPageView(url);
    },
    /**
     * Track an event with the given name and properties.
     * @param eventName
     * @param eventProperties
     */
    trackEvent: (
      eventName: string,
      eventProperties?: Record<string, string | string[]>,
    ) => {
      return getActiveService().trackEvent(eventName, eventProperties);
    },
  };
}
