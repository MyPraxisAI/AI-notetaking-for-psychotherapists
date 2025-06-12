import { getLogger } from '@kit/shared-common/logger';

/**
 * Creates a standardized logger context for the background service
 * @param submodule - The specific submodule within the background service
 * @param additionalContext - Additional context to include in the log
 * @returns A logger context object with standard fields
 */
export function createLoggerContext(submodule: string, additionalContext: Record<string, unknown> = {}) {
  return {
    module: 'bg',
    submodule,
    environment: process.env.NODE_ENV,
    ...additionalContext
  };
}

/**
 * Gets a logger instance with the background service context
 * @returns A logger instance
 */
export async function getBackgroundLogger() {
  return getLogger();
} 