import * as Sentry from '@sentry/node';
import type { Scope } from '@sentry/types';

const isSentryDisabled = process.env.SENTRY_DISABLED === 'true';

export function initMonitoring() {
  if (isSentryDisabled) {
    console.log('Sentry monitoring is disabled');
    return;
  }

  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    console.warn('SENTRY_DSN is not set, Sentry monitoring will not be initialized');
    return;
  }

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
    // Set tracesSampleRate to 1.0 to capture 100% of transactions for performance monitoring.
    // We recommend adjusting this value in production
    tracesSampleRate: 1.0,
  });

  console.log('Sentry monitoring initialized');
}

/**
 * Capture an exception in Sentry
 * @param error - The error to capture
 * @param context - Additional context to include with the error
 */
export function captureException(error: Error, context?: Record<string, any>) {
  if (isSentryDisabled) {
    console.error('Error:', error);
    if (context) {
      console.error('Context:', context);
    }
    return;
  }

  if (context) {
    Sentry.withScope((scope: Scope) => {
      Object.entries(context).forEach(([key, value]) => {
        scope.setExtra(key, value);
      });
      Sentry.captureException(error);
    });
  } else {
    Sentry.captureException(error);
  }
}

/**
 * Capture a message in Sentry
 * @param message - The message to capture
 * @param level - The severity level of the message
 * @param context - Additional context to include with the message
 */
export function captureMessage(
  message: string,
  level: Sentry.SeverityLevel = 'info',
  context?: Record<string, any>
) {
  if (isSentryDisabled) {
    console.log(`[${level.toUpperCase()}] ${message}`);
    if (context) {
      console.log('Context:', context);
    }
    return;
  }

  if (context) {
    Sentry.withScope((scope: Scope) => {
      Object.entries(context).forEach(([key, value]) => {
        scope.setExtra(key, value);
      });
      Sentry.captureMessage(message, level);
    });
  } else {
    Sentry.captureMessage(message, level);
  }
} 