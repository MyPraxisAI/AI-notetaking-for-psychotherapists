import type { Logger, LogFn } from '../logger';

/**
 * Process extra arguments to make them suitable for structured logging
 * @param args Extra arguments passed to the logger
 * @param ctx The context object (will be modified in-place)
 * @returns The modified context object
 */
function processExtraArgs(args: unknown[], ctx: Record<string, any> = {}): Record<string, any> {
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
        }, {} as Record<string, any>)
      };
    } else if (typeof arg === 'object' && arg !== null) {
      // Handle objects by merging them into context
      Object.assign(ctx, arg);
    } else {
      // Handle primitives by adding them with an index-based key
      ctx[`arg${index + 1}`] = arg;
    }
  });
  
  return ctx;
}

// Get environment variables safely
const getEnv = () => {
  try {
    return typeof process !== 'undefined' && process.env ? process.env : {};
  } catch (e) {
    return {};
  }
};

/**
 * @name PinoLogger
 * @description A logger implementation using Pino
 */
const createPinoLogger = (): Logger => {
  try {
    // Dynamic import to avoid issues with module resolution
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const pino = require('pino');
    const logger = pino({
      browser: {
        asObject: true,
      },
      level: 'debug',
      base: {
        env: getEnv().NODE_ENV,
      },
      errorKey: 'error',
    });
    
    // Create enhanced logger functions that handle additional arguments
    const enhancedLogger: Logger = {
      info: createEnhancedLogFn(logger.info.bind(logger)),
      error: createEnhancedLogFn(logger.error.bind(logger)),
      warn: createEnhancedLogFn(logger.warn.bind(logger)),
      debug: createEnhancedLogFn(logger.debug.bind(logger)),
      fatal: createEnhancedLogFn(logger.fatal.bind(logger)),
    };
    
    return enhancedLogger;
  } catch (e) {
    // Fallback logger if pino is not available
    return {
      info: createEnhancedLogFn(console.info.bind(console)),
      error: createEnhancedLogFn(console.error.bind(console)),
      warn: createEnhancedLogFn(console.warn.bind(console)),
      debug: createEnhancedLogFn(console.debug.bind(console)),
      fatal: createEnhancedLogFn(console.error.bind(console)),
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
        const obj = firstArg as Record<string, any>;
        const msg = args[1] as string;
        const restArgs = args.slice(2);
        const enhancedObj = processExtraArgs(restArgs, { ...obj });
        originalLogFn(enhancedObj, msg);
      } else {
        // Called with (obj) or (obj, nonString, ...args) - third overload
        const obj = firstArg as Record<string, any>;
        const restArgs = args.slice(1);
        const enhancedObj = processExtraArgs(restArgs, { ...obj });
        originalLogFn(enhancedObj);
      }
    } else {
      // Fallback for any other pattern
      originalLogFn(...args);
    }
  } as LogFn;
  
  return enhancedLogFn;
}

const PinoLogger = createPinoLogger();

export { PinoLogger };
