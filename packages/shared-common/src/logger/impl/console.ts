import type { Logger, LogFn } from '../logger';
import * as Sentry from '@sentry/nextjs';

// Define type for logger extras
type Extras = Record<string, unknown>;

/**
 * Creates a console-based logger implementation
 * @returns A logger instance that uses console methods
 */
export function createConsoleLogger(): Logger {
  // Helper function to capture error in Sentry
  const captureErrorInSentry = (obj: unknown, msg?: string) => {
    if (obj instanceof Error) {
      Sentry.captureException(obj);
    } else if (typeof obj === 'object' && obj !== null) {
      // If we have an error object in the context
      const objWithError = obj as { error?: Error };
      if (objWithError.error instanceof Error) {
        Sentry.captureException(objWithError.error);
      } else {
        // Otherwise capture as a message with context
        Sentry.captureMessage(msg || 'Error logged', {
          level: 'error',
          extra: obj as Extras
        });
      }
    } else if (msg) {
      // If we just have a message, capture it
      Sentry.captureMessage(msg, {
        level: 'error',
        extra: obj as Extras
      });
    }
  };

  // Create enhanced logger functions that handle additional arguments
  const enhancedLogger: Logger = {
    info: createEnhancedLogFn(console.info.bind(console)),
    error: createEnhancedLogFn((...args: unknown[]) => {
      console.error(...args);
      const [firstArg, secondArg] = args;
      if (typeof firstArg === 'object' && firstArg !== null) {
        captureErrorInSentry(firstArg, typeof secondArg === 'string' ? secondArg : undefined);
      } else if (typeof firstArg === 'string') {
        captureErrorInSentry({} as Extras, firstArg);
      }
    }),
    warn: createEnhancedLogFn(console.warn.bind(console)),
    debug: createEnhancedLogFn(console.debug.bind(console)),
    fatal: createEnhancedLogFn((...args: unknown[]) => {
      console.error(...args);
      const [firstArg, secondArg] = args;
      if (typeof firstArg === 'object' && firstArg !== null) {
        if (firstArg instanceof Error) {
          Sentry.captureException(firstArg, { level: 'fatal' });
        } else if (typeof secondArg === 'string') {
          Sentry.captureMessage(secondArg, {
            level: 'fatal',
            extra: firstArg as Extras
          });
        }
      } else if (typeof firstArg === 'string') {
        Sentry.captureMessage(firstArg, { level: 'fatal' });
      }
    }),
  };

  return enhancedLogger;
}

/**
 * Creates an enhanced log function that processes additional arguments
 * @param originalLogFn The original log function
 * @returns Enhanced log function
 */
function createEnhancedLogFn(originalLogFn: Function): LogFn {
  // Create a function that matches the LogFn type's overloads
  const enhancedLogFn = function(...args: unknown[]): void {
    // Handle different calling patterns based on the arguments
    if (args.length === 0) {
      // No arguments, just call the original function
      originalLogFn();
      return;
    }
    
    const firstArg = args[0];
    
    if (typeof firstArg === 'string') {
      // Called with (msg, ...args) - first overload
      originalLogFn(firstArg, ...args.slice(1));
    } else if (typeof firstArg === 'object' && firstArg !== null) {
      // Object as first argument
      if (args.length >= 2 && typeof args[1] === 'string') {
        // Called with (obj, msg, ...args) - second overload
        originalLogFn(firstArg, args[1], ...args.slice(2));
      } else {
        // Called with just (obj) - third overload
        originalLogFn(firstArg);
      }
    } else {
      // Called with a primitive as first argument
      originalLogFn(...args);
    }
  };
  
  return enhancedLogFn as LogFn;
} 