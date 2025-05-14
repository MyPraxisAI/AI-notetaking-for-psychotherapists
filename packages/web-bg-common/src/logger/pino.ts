import { pino } from 'pino';
import { Logger } from './logger';

/**
 * @name PinoLogger
 * @description A logger implementation using Pino
 */
const PinoLogger = pino({
  browser: {
    asObject: true,
  },
  level: 'debug',
  base: {
    env: process.env.NODE_ENV,
  },
  errorKey: 'error',
}) as unknown as Logger;

export { PinoLogger };
