// Import from the shared-common package
import { getLogger as getCommonLogger, type Logger } from '@kit/shared-common';

/**
 * @name getLogger
 * @description Retrieves the logger implementation from shared-common
 */
export async function getLogger(): Promise<Logger> {
  return getCommonLogger();
}

export type { Logger } from '@kit/shared-common';
