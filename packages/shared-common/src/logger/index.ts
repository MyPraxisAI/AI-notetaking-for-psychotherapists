import type { Logger } from './logger';

let loggerInstance: Logger | null = null;

/**
 * @name getLogger
 * @description Retrieves the logger implementation based on the environment.
 */
export async function getLogger(): Promise<Logger> {
  if (loggerInstance) {
    return loggerInstance;
  }

  const { default: createPinoLogger } = await import('./impl/pino.js');
  loggerInstance = createPinoLogger();

  return loggerInstance;
}

export type { Logger } from './logger';
