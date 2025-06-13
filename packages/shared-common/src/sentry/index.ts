import type { Scope } from '@sentry/types';
import type { NodeOptions } from '@sentry/node';

type SentryModule = {
  withScope: (cb: (scope: Scope) => void) => void;
  captureException: (error: unknown) => void;
  captureMessage: (message: string, level?: SentryLevel) => void;
  init: (options: NodeOptions) => void;
};

let sentryModule: SentryModule | null = null;
let withScope: ((cb: (scope: Scope) => void) => void) | null = null;
let captureExceptionFn: ((error: unknown) => void) | null = null;
let captureMessageFn: ((message: string, level?: SentryLevel) => void) | null = null;
let initFn: ((options: NodeOptions) => void) | null = null;

type SentryLevel = 'fatal' | 'error' | 'warning' | 'log' | 'info' | 'debug';
type ContextRecord = Record<string, unknown>;

/**
 * Initialize the Sentry adapter with the appropriate package
 */
export async function initSentryAdapter(): Promise<SentryModule> {
  if (sentryModule) {
    return sentryModule;
  }

  // In a Next.js environment, use @sentry/nextjs
  // In a Node.js environment, use @sentry/node
  const isNextJs = process.env.NEXT_PUBLIC_SENTRY_DSN !== undefined;
  
  try {
    if (isNextJs) {
      const nextjsModule = await import('@sentry/nextjs');
      sentryModule = nextjsModule as unknown as SentryModule;
    } else {
      const nodeModule = await import('@sentry/node');
      sentryModule = nodeModule as unknown as SentryModule;
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
export async function getSentry(): Promise<SentryModule> {
  if (!sentryModule) {
    await initSentryAdapter();
  }
  return sentryModule!;
}

/**
 * Capture an exception in Sentry
 */
export async function captureException(error: Error, context?: ContextRecord): Promise<void> {
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
  level: SentryLevel = 'info',
  context?: ContextRecord
): Promise<void> {
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
}): Promise<void> {
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

export function withScopeAndContext(context: ContextRecord, cb: () => void): void {
  console.debug('[Sentry] withScope called with context:', context);
  if (withScope) withScope((scope: Scope) => {
    if (context.module) {
      console.debug('[Sentry] setTag module:', context.module);
      scope.setTag('module', context.module as string);
    }
    if (context.submodule) {
      console.debug('[Sentry] setTag submodule:', context.submodule);
      scope.setTag('submodule', context.submodule as string);
    }
    Object.entries(context).forEach(([key, value]) => {
      if (key !== 'module' && key !== 'submodule') {
        console.debug('[Sentry] setExtra', key, value);
        scope.setExtra(key, value);
      }
    });
    cb();
  });
}

export function captureExceptionWithContext(error: Error, context: ContextRecord = {}): void {
  withScopeAndContext(context, () => {
    console.debug('[Sentry] captureException called:', error);
    captureException(error);
  });
}

export function captureMessageWithContext(
  message: string,
  level: SentryLevel = 'error',
  context: ContextRecord = {}
): void {
  withScopeAndContext(context, () => {
    console.debug('[Sentry] captureMessage called:', message, level);
    captureMessage(message, level);
  });
} 