import type { Logger, LogFn } from './logger';

let loggerInstance: Logger | null = null;

/**
 * @name getLogger
 * @description Retrieves the logger implementation based on the environment.
 */
export async function getLogger(): Promise<Logger> {
  if (loggerInstance) {
    return loggerInstance;
  }

  const env = process.env.NODE_ENV || 'development';
  
  if (env === 'production') {
    // In production, use Pino logger
    const createPinoLogger = (await import('./impl/pino.js')).default;
    loggerInstance = createPinoLogger();
  } else {
    // In development, use console logger
    const { createConsoleLogger } = await import('./impl/console.js');
    loggerInstance = createConsoleLogger();
  }

  return loggerInstance;
}

export type { Logger, LogFn } from './logger';
