'use client';

import { useEffect } from 'react';

import { usePathname, useSearchParams } from 'next/navigation';

import { analytics } from '@kit/analytics';
import {
  AppEvent,
  AppEventType,
  ConsumerProvidedEventTypes,
  useAppEvents,
} from '@kit/shared/events';
import { isBrowser } from '@kit/shared/utils';

import { AppEvents } from '~/lib/app-events';

type AnalyticsMapping<
  T extends ConsumerProvidedEventTypes = NonNullable<unknown>,
> = {
  [K in AppEventType<T>]?: (event: AppEvent<T, K>) => unknown;
};

/**
 * Hook to subscribe to app events and map them to analytics actions
 * @param mapping
 */
function useAnalyticsMapping<T extends ConsumerProvidedEventTypes>(
  mapping: AnalyticsMapping<T>,
) {
  const appEvents = useAppEvents<T>();

  useEffect(() => {
    const subscriptions = Object.entries(mapping).map(
      ([eventType, handler]) => {
        appEvents.on(eventType as AppEventType<T>, handler);

        return () => appEvents.off(eventType as AppEventType<T>, handler);
      },
    );

    return () => {
      subscriptions.forEach((unsubscribe) => unsubscribe());
    };
  }, [appEvents, mapping]);
}

/**
 * Define a mapping of app events to analytics actions
 * Add new mappings here to track new events in the analytics service from app events
 */
const analyticsMapping: AnalyticsMapping<AppEvents> = {
  // Auth
  UserSignedIn: (event) => {
    const { userId, ...traits } = event.payload as { userId: string };

    if (userId) {
      return analytics.identify(userId, traits);
    }
  },
  UserSignedUp: (event) => analytics.trackEvent(event.type, event.payload),
  UserSignedOut: (event) => analytics.trackEvent(event.type),
  UserPasswordResetRequested: (event) => analytics.trackEvent(event.type),
  UserPasswordResetCompleted: (event) => analytics.trackEvent(event.type),
  UserSessionExpired: (event) =>
    analytics.trackEvent(event.type, event.payload),

  // Navigation
  ScreenViewed: (event) => analytics.trackEvent(event.type, event.payload),
  ClientListViewed: (event) => analytics.trackEvent(event.type),
  ClientProfileViewed: (event) =>
    analytics.trackEvent(event.type, event.payload),
  SessionListViewed: (event) =>
    analytics.trackEvent(event.type, event.payload),
  SessionDetailViewed: (event) =>
    analytics.trackEvent(event.type, event.payload),

  // Client Management
  ClientCreated: (event) => analytics.trackEvent(event.type, event.payload),
  ClientUpdated: (event) => analytics.trackEvent(event.type, event.payload),

  // Session Management
  SessionDeleted: (event) => analytics.trackEvent(event.type, event.payload),
  SessionNoteAdded: (event) => analytics.trackEvent(event.type, event.payload),
  SessionNoteUpdated: (event) =>
    analytics.trackEvent(event.type, event.payload),

  // Recording
  RecordingStarted: (event) =>
    analytics.trackEvent(event.type, event.payload),
  RecordingPaused: (event) =>
    analytics.trackEvent(event.type, event.payload),
  RecordingResumed: (event) =>
    analytics.trackEvent(event.type, event.payload),
  RecordingCompleted: (event) =>
    analytics.trackEvent(event.type, event.payload),
  RecordingAborted: (event) =>
    analytics.trackEvent(event.type, event.payload),
  RecordingFileImported: (event) =>
    analytics.trackEvent(event.type, event.payload),

  // Artifact
  ArtifactViewed: (event) => analytics.trackEvent(event.type, event.payload),
  ArtifactCopied: (event) => analytics.trackEvent(event.type, event.payload),
  ArtifactGenerationRequested: (event) =>
    analytics.trackEvent(event.type, event.payload),
  ArtifactGenerationCompleted: (event) =>
    analytics.trackEvent(event.type, event.payload),
  ArtifactGenerationFailed: (event) =>
    analytics.trackEvent(event.type, event.payload),

  // Performance
  PerformanceMetric: (event) =>
    analytics.trackEvent(event.type, event.payload),

  // Settings
  SettingsViewed: (event) => analytics.trackEvent(event.type),
  SettingsUpdated: (event) => analytics.trackEvent(event.type, event.payload),

  // Default Makerkit events
  'user.signedIn': (event) => {
    const { userId, ...traits } = event.payload;

    if (userId) {
      return analytics.identify(userId, traits);
    }
  },
  'user.signedUp': (event) => {
    return analytics.trackEvent(event.type, event.payload);
  },
  'checkout.started': (event) => {
    return analytics.trackEvent(event.type, event.payload);
  },
  'user.updated': (event) => {
    return analytics.trackEvent(event.type, event.payload);
  },
};

function AnalyticsProviderBrowser(props: React.PropsWithChildren) {
  const { emit } = useAppEvents<AppEvents>();

  // Subscribe to app events and map them to analytics actions
  useAnalyticsMapping(analyticsMapping);

  // Report page views to the analytics service
  useReportPageView((params) => {
    emit({
      type: 'ScreenViewed',
      payload: params,
    });
  });

  // Render children
  return props.children;
}

/**
 * Provider for the analytics service
 */
export function AnalyticsProvider(props: React.PropsWithChildren) {
  if (!isBrowser()) {
    return props.children;
  }

  return <AnalyticsProviderBrowser>{props.children}</AnalyticsProviderBrowser>;
}

/**
 * Hook to report page views to the analytics service
 * @param reportAnalyticsFn
 */
function useReportPageView(
  reportAnalyticsFn: (params: {
    screen_name: string;
    referrer_screen?: string;
  }) => unknown,
) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const screen_name = [pathname, searchParams.toString()]
      .filter(Boolean)
      .join('?');

    const referrer_screen = document.referrer || undefined;

    reportAnalyticsFn({
      screen_name,
      referrer_screen,
    });
  }, [pathname, reportAnalyticsFn, searchParams]);
}
