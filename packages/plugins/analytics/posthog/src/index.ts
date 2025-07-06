import type { PostHog as ClientPostHog } from 'posthog-js';
import type { PostHog as ServerPostHog } from 'posthog-node';

const isOnServer = typeof document === 'undefined';

/**
 * Create a Posthog analytics service.
 */
export function createPostHogAnalyticsService() {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY!;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST!;
  const url = process.env.NEXT_PUBLIC_POSTHOG_INGESTION_URL;

  if (!key) {
    throw new Error(
      'NEXT_PUBLIC_POSTHOG_KEY is not set. Please set the environment variable.',
    );
  }

  if (!host) {
    throw new Error(
      'NEXT_PUBLIC_POSTHOG_HOST is not set. Please set the environment variable.',
    );
  }

  return new PostHogAnalyticsService(key, host, url);
}

/**
 * PostHog analytics service that sends events to PostHog.
 */
class PostHogAnalyticsService {
  private client: ClientPostHogImpl | ServerPostHogImpl;
  private userId?: string;

  constructor(
    private posthogKey: string,
    private posthogHost: string,
    posthogIngestUrl?: string,
  ) {
    this.client = isOnServer
      ? new ServerPostHogImpl(posthogKey, posthogHost)
      : new ClientPostHogImpl(posthogKey, posthogHost, posthogIngestUrl);
  }

  async initialize() {
    this.log('Initializing PostHog analytics service');

    if (!this.posthogKey || !this.posthogHost) {
      this.log('PostHog key or host not provided, skipping initialization');
      return;
    }

    return this.client.initialize();
  }

  async identify(userId: string, traits?: Record<string, string>) {
    this.log(`Identifying user ${userId} with traits:`, traits);

    this.userId = userId;

    return this.client.identify(userId, traits);
  }

  async trackPageView(url: string) {
    this.log(`Tracking page view for URL: ${url}`);

    return this.client.trackPageView(url);
  }

  async trackEvent(
    eventName: string,
    eventProperties?: Record<string, string | string[]>,
  ) {
    this.log(`Tracking event ${eventName} with properties:`, eventProperties);

    return this.client.trackEvent(eventName, eventProperties);
  }

  private log(...args: unknown[]) {
    this.client.log(...args);
  }
}

/**
 * PostHog analytics service that sends events to PostHog on the server.
 */
class ServerPostHogImpl {
  private ph: ServerPostHog | undefined;
  private userId?: string;

  constructor(
    private key: string,
    private host: string,
  ) {}

  async initialize() {
    const { PostHog } = await import('posthog-node');

    this.ph = new PostHog(this.key, {
      host: this.host,
      flushAt: 1,
      flushInterval: 0,
    });
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async identify(userId: string, traits?: Record<string, string>) {
    this.userId = userId;

    this.getClient().capture({
      event: '$identify',
      distinctId: userId,
      properties: traits,
    });
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async trackPageView(url: string) {
    this.getClient().capture({
      event: '$pageview',
      distinctId: this.userId!,
      properties: { $current_url: url },
    });
  }

  async trackEvent(
    eventName: string,
    eventProperties?: Record<string, string | string[]>,
  ) {
    const client = this.getClient();

    if (!this.userId) {
      throw new Error(
        `Please identify the user using the identify method before tracking events`,
      );
    }

    client.capture({
      event: eventName,
      distinctId: this.userId,
      properties: eventProperties,
    });

    await client.shutdown();
  }

  log(...args: unknown[]) {
    if (process.env.NODE_ENV === 'development') {
      console.log('[ServerPostHog]', ...args);
    }
  }

  private getClient() {
    if (!this.ph) {
      throw new Error('PostHog client not initialized');
    }

    return this.ph;
  }
}

/**
 * PostHog analytics service that sends events to PostHog in the browser.
 */
class ClientPostHogImpl {
  private ph: ClientPostHog | undefined;
  private userId?: string;

  constructor(
    private key: string,
    private host: string,
    private ingestUrl?: string,
  ) {}

  async initialize() {
    const { posthog } = await import('posthog-js');

    posthog.init(this.key, {
      api_host: this.ingestUrl ?? this.host,
      ui_host: this.host,
      persistence: 'localStorage+cookie',
      person_profiles: 'always',
      capture_pageview: false,
      capture_pageleave: true,
    });

    this.ph = posthog;
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async identify(userId: string, traits?: Record<string, string>) {
    const client = this.getClient();

    this.userId = userId;
    client.identify(userId, traits);
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async trackPageView(url: string) {
    const client = this.getClient();

    client.capture('$pageview', { $current_url: url });
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async trackEvent(
    eventName: string,
    eventProperties?: Record<string, string | string[]>,
  ) {
    const client = this.getClient();

    return client.capture(eventName, eventProperties);
  }

  log(...args: unknown[]) {
    if (process.env.NODE_ENV === 'development') {
      console.log('[ClientPostHog]', ...args);
    }
  }

  private getClient() {
    if (!this.ph) {
      throw new Error('PostHog client not initialized');
    }

    return this.ph;
  }
}
