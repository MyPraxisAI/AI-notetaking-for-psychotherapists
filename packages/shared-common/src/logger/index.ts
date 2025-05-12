import { createRegistry } from '../registry';
import type { Logger } from './logger';

// Define the type for the logger provider. Currently supporting 'pino'.
type LoggerProvider = 'pino';

const LOGGER = (process.env?.LOGGER ?? 'pino') as LoggerProvider;

// Create a registry for logger implementations
const loggerRegistry = createRegistry<Logger, LoggerProvider>();

// Register the 'pino' logger implementation
loggerRegistry.register('pino', async () => {
  const { PinoLogger } = await import('./impl/pino.js');
  return PinoLogger;
});

/**
 * @name getLogger
 * @description Retrieves the logger implementation based on the LOGGER environment variable using the registry API.
 */
export async function getLogger(): Promise<Logger> {
  return loggerRegistry.get(LOGGER);
}

export type { Logger, LogFn } from './logger';
