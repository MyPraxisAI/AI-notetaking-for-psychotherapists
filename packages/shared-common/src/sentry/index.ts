import type { Scope } from '@sentry/types';

let sentryModule: any = null;
let withScope: ((cb: (scope: Scope) => void) => void) | null = null;
let captureExceptionFn: ((error: unknown) => void) | null = null;
let captureMessageFn: ((message: string, level?: SentryLevel) => void) | null = null;
let initFn: ((options: unknown) => void) | null = null;

type SentryLevel = 'fatal' | 'error' | 'warning' | 'log' | 'info' | 'debug';

/**
 * Initialize the Sentry adapter with the appropriate package
 */
export async function initSentryAdapter() {
  if (sentryModule) {
    return sentryModule;
  }

  // In a Next.js environment, use @sentry/nextjs
  // In a Node.js environment, use @sentry/node
  const isNextJs = process.env.NEXT_PUBLIC_SENTRY_DSN !== undefined;
  
  try {
    if (isNextJs) {
      sentryModule = await import('@sentry/nextjs');
    } else {
      sentryModule = await import('@sentry/node');
    }
    withScope = sentryModule.withScope;
    captureExceptionFn = sentryModule.captureException;
    captureMessageFn = sentryModule.captureMessage;
    initFn = sentryModule.init;
    return sentryModule;
  } catch (error) {
    console.error('Failed to initialize Sentry adapter:', error);
    throw error;
  }
}

/**
 * Get the current Sentry instance
 */
export async function getSentry() {
  if (!sentryModule) {
    await initSentryAdapter();
  }
  return sentryModule;
}

/**
 * Capture an exception in Sentry
 */
export async function captureException(error: Error, context?: Record<string, any>) {
  if (!captureExceptionFn || !withScope) await initSentryAdapter();
  try {
    if (context) {
      if (withScope) withScope((scope: Scope) => {
        Object.entries(context).forEach(([key, value]) => {
          scope.setExtra(key, value);
        });
        if (captureExceptionFn) captureExceptionFn(error);
      });
    } else {
      if (captureExceptionFn) captureExceptionFn(error);
    }
  } catch (sentryError) {
    console.error('Failed to capture exception in Sentry:', {
      sentryError,
      originalError: {
        name: error.name,
        message: error.message,
        stack: error.stack
      }
    });
  }
}

/**
 * Capture a message in Sentry
 */
export async function captureMessage(
  message: string,
  level: 'fatal' | 'error' | 'warning' | 'log' | 'info' | 'debug' = 'info',
  context?: Record<string, any>
) {
  if (!captureMessageFn || !withScope) await initSentryAdapter();
  try {
    if (context) {
      if (withScope) withScope((scope: Scope) => {
        Object.entries(context).forEach(([key, value]) => {
          scope.setExtra(key, value);
        });
        if (captureMessageFn) captureMessageFn(message, level);
      });
    } else {
      if (captureMessageFn) captureMessageFn(message, level);
    }
  } catch (sentryError) {
    console.error('Failed to capture message in Sentry:', {
      sentryError,
      message,
      level,
      context
    });
  }
}

/**
 * Initialize Sentry with the given configuration
 */
export async function initSentry(config: {
  dsn: string;
  environment?: string;
  tracesSampleRate?: number;
  debug?: boolean;
}) {
  if (!initFn) await initSentryAdapter();
  try {
    if (initFn) initFn({
      dsn: config.dsn,
      environment: config.environment || process.env.NODE_ENV,
      tracesSampleRate: config.tracesSampleRate ?? 1.0,
      debug: config.debug ?? process.env.NODE_ENV === 'development',
    });
  } catch (error) {
    console.error('Failed to initialize Sentry:', error);
    throw error;
  }
}

export function withScopeAndContext(context: Record<string, any>, cb: () => void) {
  // Debug: log context being forwarded
  // eslint-disable-next-line no-console
  console.debug('[Sentry] withScope called with context:', context);
  if (withScope) withScope((scope: Scope) => {
    if (context.module) {
      // eslint-disable-next-line no-console
      console.debug('[Sentry] setTag module:', context.module);
      scope.setTag('module', context.module);
    }
    if (context.submodule) {
      // eslint-disable-next-line no-console
      console.debug('[Sentry] setTag submodule:', context.submodule);
      scope.setTag('submodule', context.submodule);
    }
    Object.entries(context).forEach(([key, value]) => {
      if (key !== 'module' && key !== 'submodule') {
        // eslint-disable-next-line no-console
        console.debug('[Sentry] setExtra', key, value);
        scope.setExtra(key, value);
      }
    });
    cb();
  });
}

export function captureExceptionWithContext(error: Error, context: Record<string, any> = {}) {
  withScopeAndContext(context, () => {
    // eslint-disable-next-line no-console
    console.debug('[Sentry] captureException called:', error);
    captureException(error);
  });
}

export function captureMessageWithContext(
  message: string,
  level: SentryLevel = 'error',
  context: Record<string, any> = {}
) {
  withScopeAndContext(context, () => {
    // eslint-disable-next-line no-console
    console.debug('[Sentry] captureMessage called:', message, level);
    captureMessage(message, level);
  });
} 