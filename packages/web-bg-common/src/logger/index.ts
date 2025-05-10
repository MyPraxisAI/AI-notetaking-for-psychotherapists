import type { Logger } from './logger';

// Define the type for the logger provider
type LoggerProvider = 'pino';

// Default to pino logger
const LOGGER = (process.env.LOGGER ?? 'pino') as LoggerProvider;

// Simple registry for logger implementations
const loggerRegistry = new Map<LoggerProvider, () => Promise<Logger>>();

// Register the pino logger implementation
loggerRegistry.set('pino', async () => {
  const { PinoLogger } = await import('./pino');
  return PinoLogger;
});

/**
 * @name getLogger
 * @description Returns the logger instance
 */
export async function getLogger(): Promise<Logger> {
  const factory = loggerRegistry.get(LOGGER);
  
  if (!factory) {
    throw new Error(`Logger implementation "${LOGGER}" not found`);
  }
  
  return factory();
}

export type { Logger };
