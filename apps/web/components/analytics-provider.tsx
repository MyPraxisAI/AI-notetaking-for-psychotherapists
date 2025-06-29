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
    // Our custom UserSignedIn event only has method, not userId
    // User identification happens through the built-in 'user.signedIn' event
    return analytics.trackEvent(event.type, event.payload);
  },
  UserSignedUp: (event) => analytics.trackEvent(event.type, event.payload),
  UserSignedOut: (event) => analytics.trackEvent(event.type),
  UserPasswordChanged: (event) => analytics.trackEvent(event.type),
  UserSessionExpired: (event) =>
    analytics.trackEvent(event.type, {
      inactivityMinutes: event.payload.inactivityMinutes.toString(),
    }),

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
  SessionNoteUpdated: (event) =>
    analytics.trackEvent(event.type, {
      session_id: event.payload.session_id,
      change_size_chars: event.payload.change_size_chars.toString(),
    }),
  SessionTranscriptViewed: (event) =>
    analytics.trackEvent(event.type, event.payload),
  SessionTranscriptCopied: (event) =>
    analytics.trackEvent(event.type, event.payload),
  SessionSummaryViewed: (event) =>
    analytics.trackEvent(event.type, event.payload),
  SessionNoteCopied: (event) =>
    analytics.trackEvent(event.type, event.payload),

  // Recording
  RecordingStarted: (event) =>
    analytics.trackEvent(event.type, event.payload),
  RecordingPaused: (event) =>
    analytics.trackEvent(event.type, event.payload),
  RecordingResumed: (event) =>
    analytics.trackEvent(event.type, event.payload),
  RecordingCompleted: (event) =>
    analytics.trackEvent(event.type, {
      session_id: event.payload.session_id,
      client_id: event.payload.client_id,
      duration_minutes: event.payload.duration_minutes.toString(),
    }),
  RecordingAborted: (event) =>
    analytics.trackEvent(event.type, event.payload),
  RecordingFileImported: (event) =>
    analytics.trackEvent(event.type, event.payload),

  // Artifact
  ArtifactViewed: (event) => analytics.trackEvent(event.type, event.payload),
  ArtifactCopied: (event) => analytics.trackEvent(event.type, event.payload),

  // Settings
  SettingsViewed: (event) => analytics.trackEvent(event.type),
  SettingsUpdated: (event) => analytics.trackEvent(event.type, event.payload),

  // Help & Support
  HelpRequested: (event) => analytics.trackEvent(event.type),

  // Default Makerkit events
  'user.signedIn': (event) => {
    const { userId, ...rawTraits } = event.payload as { userId: string; [key: string]: string | undefined };

    if (userId) {
      // Filter out undefined values to comply with Google Analytics policies
      const traits = Object.fromEntries(
        Object.entries(rawTraits).filter(([_, value]) => value !== undefined)
      ) as Record<string, string>;
      
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
