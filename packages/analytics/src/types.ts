interface TrackEvent {
  trackEvent(
    eventName: string,
    eventProperties?: Record<string, string | string[]>,
  ): void;
}

interface TrackPageView {
  trackPageView(url: string): void;
}

interface Identify {
  identify(userId: string, traits?: Record<string, string>): void;
}

export interface AnalyticsService extends TrackPageView, TrackEvent, Identify {
  initialize(): void;
}

export type AnalyticsProviderFactory<Config extends object> = (
  config: Config,
) => AnalyticsService;

export interface CreateAnalyticsManagerOptions<
  T extends string,
  Config extends object,
> {
  defaultProvider: T;
  providers: Record<T, AnalyticsProviderFactory<Config>>;
}

export interface AnalyticsManager extends TrackPageView, TrackEvent, Identify {}
