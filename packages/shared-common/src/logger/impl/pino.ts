import type { Logger } from '../logger';

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
    return pino({
      browser: {
        asObject: true,
      },
      level: 'debug',
      base: {
        env: getEnv().NODE_ENV,
      },
      errorKey: 'error',
    }) as unknown as Logger;
  } catch (e) {
    // Fallback logger if pino is not available
    return {
      info: console.info.bind(console),
      error: console.error.bind(console),
      warn: console.warn.bind(console),
      debug: console.debug.bind(console),
      fatal: console.error.bind(console),
    };
  }
};

const PinoLogger = createPinoLogger();

export { PinoLogger };
