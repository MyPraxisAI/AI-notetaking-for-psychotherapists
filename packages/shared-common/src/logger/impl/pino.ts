import type { Logger, LogFn } from '../logger';
import * as Sentry from '@sentry/nextjs';

// Define types for logger context and extras
type Extras = Record<string, unknown>;
type LoggerContext = {
  env?: string;
  [key: string]: unknown;
};

// Define a type for environment variables that includes only what we need
type EnvVars = {
  NODE_ENV?: string;
  [key: string]: string | undefined;
};

/**
 * Process extra arguments to make them suitable for structured logging
 * @param args Extra arguments passed to the logger
 * @param ctx The context object (will be modified in-place)
 * @returns The modified context object
 */
function processExtraArgs(args: unknown[], ctx: Extras = {}): Extras {
  if (!args || args.length === 0) return ctx;
  
  // Process each additional argument
  args.forEach((arg, index) => {
    if (arg instanceof Error) {
      // Handle Error objects specially to capture their properties
      ctx.error = {
        message: arg.message,
        stack: arg.stack,
        name: arg.name,
        ...Object.getOwnPropertyNames(arg).reduce((acc, key) => {
          if (key !== 'stack' && key !== 'message' && key !== 'name') {
            acc[key] = (arg as any)[key];
          }
          return acc;
        }, {} as Extras)
      };
    } else if (typeof arg === 'object' && arg !== null) {
      // Handle objects by merging them into context
      Object.assign(ctx, arg as Extras);
    } else {
      // Handle primitives by adding them with an index-based key
      ctx[`arg${index + 1}`] = arg;
    }
  });
  
  return ctx;
}

// Get environment variables safely
const getEnv = (): EnvVars => {
  try {
    return typeof process !== 'undefined' && process.env ? process.env : { NODE_ENV: 'development' };
  } catch (e) {
    return { NODE_ENV: 'development' };
  }
};

/**
 * @name PinoLogger
 * @description A logger implementation using Pino
 */
const createPinoLogger = (): Logger => {
  try {
    // Dynamic import to avoid issues with module resolution
    const pino = require('pino');
    
    const logger = pino({
      browser: {
        asObject: true,
      },
      level: 'debug',
      base: {
        env: getEnv().NODE_ENV || 'development',
      } as LoggerContext,
      errorKey: 'error',
    });

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
      info: createEnhancedLogFn(logger.info.bind(logger)),
      error: createEnhancedLogFn((...args: unknown[]) => {
        // First log to Pino
        logger.error(...args);
        
        // Then capture in Sentry
        const [firstArg, secondArg] = args;
        if (typeof firstArg === 'object' && firstArg !== null) {
          captureErrorInSentry(firstArg, typeof secondArg === 'string' ? secondArg : undefined);
        } else if (typeof firstArg === 'string') {
          captureErrorInSentry({}, firstArg);
        }
      }),
      warn: createEnhancedLogFn(logger.warn.bind(logger)),
      debug: createEnhancedLogFn(logger.debug.bind(logger)),
      fatal: createEnhancedLogFn((...args: unknown[]) => {
        // First log to Pino
        logger.fatal(...args);
        
        // Then capture in Sentry with fatal level
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
  } catch (e) {
    // Fallback logger if pino is not available
    return {
      info: createEnhancedLogFn(console.info.bind(console)),
      error: createEnhancedLogFn((...args: unknown[]) => {
        console.error(...args);
        const [firstArg, secondArg] = args;
        if (typeof firstArg === 'object' && firstArg !== null) {
          if (firstArg instanceof Error) {
            Sentry.captureException(firstArg);
          } else if (typeof secondArg === 'string') {
            Sentry.captureMessage(secondArg, {
              level: 'error',
              extra: firstArg as Extras
            });
          }
        } else if (typeof firstArg === 'string') {
          Sentry.captureMessage(firstArg, { level: 'error' });
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
  }
};

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
        // Process additional args and merge them into the context object
        const obj = firstArg as Extras;
        const msg = args[1] as string;
        const extraArgs = args.slice(2);
        const processedCtx = processExtraArgs(extraArgs, obj);
        originalLogFn(processedCtx, msg);
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

export default createPinoLogger;
