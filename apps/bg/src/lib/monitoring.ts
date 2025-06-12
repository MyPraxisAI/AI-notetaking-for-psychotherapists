import { initSentry, captureException as captureExceptionInSentry, captureMessage as captureMessageInSentry } from '@kit/shared-common/sentry';
import type { Event, EventHint } from '@sentry/types';
import type { NodeOptions } from '@sentry/node';

const isSentryDisabled = process.env.SENTRY_DISABLED === 'true';

export function initMonitoring() {
  if (isSentryDisabled) {
    console.log('Sentry monitoring is disabled');
    return;
  }

  // Check both SENTRY_DSN and NEXT_PUBLIC_SENTRY_DSN for backward compatibility
  const dsn = process.env.SENTRY_DSN || '';
  if (!dsn) {
    console.warn('SENTRY_DSN is not set, Sentry monitoring will not be initialized');
    return;
  }

  console.log('Initializing Sentry with DSN:', dsn.substring(0, 10) + '...');

  try {
    initSentry({
      dsn,
      environment: process.env.NODE_ENV,
      // Set tracesSampleRate to 1.0 to capture 100% of transactions for performance monitoring.
      // We recommend adjusting this value in production
      tracesSampleRate: 1.0,
      debug: process.env.NODE_ENV === 'development', // Enable debug mode in development
      beforeSend(event: Event, hint: EventHint) {
        event.tags = {
          ...event.tags,
          module: 'bg',
        };
        return event;
      },
    } as any);

    console.log('Sentry monitoring initialized successfully');
  } catch (error) {
    console.error('Failed to initialize Sentry:', error);
  }
}

/**
 * Capture an exception in Sentry
 * @param error - The error to capture
 * @param context - Additional context to include with the error
 */
export async function captureException(error: Error, context?: Record<string, any>) {
  if (isSentryDisabled) {
    console.error('Error:', error);
    if (context) {
      console.error('Context:', context);
    }
    return;
  }

  console.debug('Capturing exception in Sentry:', {
    errorName: error.name,
    errorMessage: error.message,
    hasContext: !!context,
    environment: process.env.NODE_ENV
  });

  try {
    await captureExceptionInSentry(error, context);
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
 * @param message - The message to capture
 * @param level - The severity level of the message
 * @param context - Additional context to include with the message
 */
export async function captureMessage(
  message: string,
  level: 'fatal' | 'error' | 'warning' | 'log' | 'info' | 'debug' = 'info',
  context?: Record<string, any>
) {
  if (isSentryDisabled) {
    console.log(`[${level.toUpperCase()}] ${message}`);
    if (context) {
      console.log('Context:', context);
    }
    return;
  }

  console.debug('Capturing message in Sentry:', {
    message,
    level,
    hasContext: !!context,
    environment: process.env.NODE_ENV
  });

  try {
    await captureMessageInSentry(message, level, context);
  } catch (sentryError) {
    console.error('Failed to capture message in Sentry:', {
      sentryError,
      message,
      level,
      context
    });
  }
} 