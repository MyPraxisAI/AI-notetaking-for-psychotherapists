import type { Logger, LogFn } from '../logger';
import * as Sentry from '@sentry/node';

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

// Create a fallback logger
const createFallbackLogger = (): Logger => {
  const captureErrorInSentry = async (obj: unknown, msg?: string) => {
    const isSentryDisabled = process.env.SENTRY_DISABLED === 'true';
    console.debug('Sentry status:', { 
      isSentryDisabled,
      hasSentryDsn: !!process.env.SENTRY_DSN || !!process.env.NEXT_PUBLIC_SENTRY_DSN,
      env: process.env.NODE_ENV,
      errorType: obj instanceof Error ? obj.constructor.name : typeof obj
    });

    if (isSentryDisabled) {
      console.debug('Sentry is disabled, skipping error capture');
      return;
    }

    if (!process.env.SENTRY_DSN && !process.env.NEXT_PUBLIC_SENTRY_DSN) {
      console.warn('Sentry DSN is not set, skipping error capture');
      return;
    }

    try {
      if (obj instanceof Error) {
        console.debug('Capturing Error object in Sentry:', { 
          errorName: obj.name, 
          errorMessage: obj.message 
        });
        await Sentry.captureException(obj);
      } else if (typeof obj === 'object' && obj !== null) {
        const objWithError = obj as { error?: Error };
        if (objWithError.error instanceof Error) {
          console.debug('Capturing Error from context in Sentry:', { 
            errorName: objWithError.error.name, 
            errorMessage: objWithError.error.message 
          });
          await Sentry.captureException(objWithError.error);
        } else if (msg) {
          console.debug('Capturing message with context in Sentry:', { 
            message: msg,
            hasContext: true 
          });
          await Sentry.captureMessage(msg, 'error');
        }
      } else if (msg) {
        console.debug('Capturing message in Sentry:', { message: msg });
        await Sentry.captureMessage(msg, 'error');
      }
    } catch (sentryError) {
      console.error('Failed to capture error in Sentry:', { 
        error: sentryError,
        originalError: obj instanceof Error ? {
          name: obj.name,
          message: obj.message,
          stack: obj.stack
        } : obj
      });
    }
  };

  return {
    info: createEnhancedLogFn(console.info.bind(console)),
    error: createEnhancedLogFn(async (...args: unknown[]) => {
      console.error(...args);
      const [firstArg, secondArg] = args;
      if (typeof firstArg === 'object' && firstArg !== null) {
        await captureErrorInSentry(firstArg, typeof secondArg === 'string' ? secondArg : undefined);
      } else if (typeof firstArg === 'string') {
        await captureErrorInSentry({}, firstArg);
      }
    }),
    warn: createEnhancedLogFn(console.warn.bind(console)),
    debug: createEnhancedLogFn(console.debug.bind(console)),
    fatal: createEnhancedLogFn(async (...args: unknown[]) => {
      console.error(...args);
      const [firstArg, secondArg] = args;
      if (typeof firstArg === 'object' && firstArg !== null) {
        if (firstArg instanceof Error) {
          console.debug('Capturing fatal Error in Sentry:', { 
            errorName: firstArg.name, 
            errorMessage: firstArg.message,
            level: 'fatal'
          });
          await Sentry.captureException(firstArg);
        } else if (typeof secondArg === 'string') {
          console.debug('Capturing fatal message with context in Sentry:', { 
            message: secondArg,
            level: 'fatal',
            hasContext: true 
          });
          await Sentry.captureMessage(secondArg, 'fatal');
        }
      } else if (typeof firstArg === 'string') {
        console.debug('Capturing fatal message in Sentry:', { 
          message: firstArg,
          level: 'fatal' 
        });
        await Sentry.captureMessage(firstArg, 'fatal');
      }
    }),
  };
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

    // Helper to forward context fields to Sentry as tags/extras
    function forwardContextToSentry(context: Record<string, any>, cb: () => void) {
      Sentry.withScope((scope: any) => {
        if (context.module) scope.setTag('module', context.module);
        if (context.submodule) scope.setTag('submodule', context.submodule);
        Object.entries(context).forEach(([key, value]) => {
          if (key !== 'module' && key !== 'submodule') {
            scope.setExtra(key, value);
          }
        });
        cb();
      });
    }

    // Helper function to capture error in Sentry with debug logging
    const captureErrorInSentry = async (obj: unknown, msg?: string) => {
      const isSentryDisabled = process.env.SENTRY_DISABLED === 'true';
      logger.debug({ 
        isSentryDisabled,
        hasSentryDsn: !!process.env.SENTRY_DSN || !!process.env.NEXT_PUBLIC_SENTRY_DSN,
        env: process.env.NODE_ENV,
        errorType: obj instanceof Error ? obj.constructor.name : typeof obj
      }, 'Attempting to capture error in Sentry');

      if (isSentryDisabled) {
        logger.debug('Sentry is disabled, skipping error capture');
        return;
      }

      if (!process.env.SENTRY_DSN && !process.env.NEXT_PUBLIC_SENTRY_DSN) {
        logger.warn('Sentry DSN is not set, skipping error capture');
        return;
      }

      try {
        if (obj instanceof Error) {
          logger.debug({ errorName: obj.name, errorMessage: obj.message }, 'Capturing Error object in Sentry');
          forwardContextToSentry({}, () => Sentry.captureException(obj));
        } else if (typeof obj === 'object' && obj !== null) {
          const objWithError = obj as { error?: Error };
          if (objWithError.error instanceof Error) {
            logger.debug({ errorName: objWithError.error.name, errorMessage: objWithError.error.message }, 'Capturing Error from context in Sentry');
            forwardContextToSentry(obj as Record<string, any>, () => Sentry.captureException(objWithError.error as Error));
          } else {
            logger.debug({ message: msg || 'Error logged', hasContext: true }, 'Capturing message with context in Sentry');
            forwardContextToSentry(obj as Record<string, any>, () => Sentry.captureMessage(msg || 'Error logged', 'error'));
          }
        } else if (msg) {
          logger.debug({ message: msg }, 'Capturing message in Sentry');
          forwardContextToSentry({}, () => Sentry.captureMessage(msg, 'error'));
        }
      } catch (sentryError) {
        logger.error({ error: sentryError, originalError: obj instanceof Error ? { name: obj.name, message: obj.message, stack: obj.stack } : obj }, 'Failed to capture error in Sentry');
      }
    };
    
    // Create enhanced logger functions that handle additional arguments
    const enhancedLogger: Logger = {
      info: createEnhancedLogFn(logger.info.bind(logger)),
      error: createEnhancedLogFn(async (...args: unknown[]) => {
        // First log to Pino
        logger.error(...args);
        
        // Then capture in Sentry
        const [firstArg, secondArg] = args;
        if (typeof firstArg === 'object' && firstArg !== null) {
          await captureErrorInSentry(firstArg, typeof secondArg === 'string' ? secondArg : undefined);
        } else if (typeof firstArg === 'string') {
          await captureErrorInSentry({}, firstArg);
        }
      }),
      warn: createEnhancedLogFn(logger.warn.bind(logger)),
      debug: createEnhancedLogFn(logger.debug.bind(logger)),
      fatal: createEnhancedLogFn(async (...args: unknown[]) => {
        // First log to Pino
        logger.fatal(...args);
        
        // Then capture in Sentry with fatal level
        const [firstArg, secondArg] = args;
        if (typeof firstArg === 'object' && firstArg !== null) {
          if (firstArg instanceof Error) {
            logger.debug({ 
              errorName: firstArg.name, 
              errorMessage: firstArg.message,
              level: 'fatal'
            }, 'Capturing fatal Error in Sentry');
            await Sentry.captureException(firstArg);
          } else if (typeof secondArg === 'string') {
            logger.debug({ 
              message: secondArg,
              level: 'fatal',
              hasContext: true 
            }, 'Capturing fatal message with context in Sentry');
            await Sentry.captureMessage(secondArg, 'fatal');
          }
        } else if (typeof firstArg === 'string') {
          logger.debug({ 
            message: firstArg,
            level: 'fatal' 
          }, 'Capturing fatal message in Sentry');
          await Sentry.captureMessage(firstArg, 'fatal');
        }
      }),
    };
    
    return enhancedLogger;
  } catch (error) {
    // Fallback logger if pino is not available
    console.error('Failed to create Pino logger, falling back to console logger:', error);
    return createFallbackLogger();
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
