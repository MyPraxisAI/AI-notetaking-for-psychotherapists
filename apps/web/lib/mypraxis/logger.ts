/**
 * Logger utility for consistent logging across the application
 */

// Log levels
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

// Current log level (can be changed at runtime)
let currentLogLevel = process.env.NODE_ENV === 'production' 
  ? LogLevel.WARN  // Only show warnings and errors in production
  : LogLevel.DEBUG // Show all logs in development

// Colors for different log levels
const LOG_COLORS = {
  [LogLevel.DEBUG]: '#9ca3af', // Gray
  [LogLevel.INFO]: '#3b82f6',  // Blue
  [LogLevel.WARN]: '#f59e0b',  // Amber
  [LogLevel.ERROR]: '#ef4444', // Red
}

// Log level names
const LOG_NAMES = {
  [LogLevel.DEBUG]: 'DEBUG',
  [LogLevel.INFO]: 'INFO',
  [LogLevel.WARN]: 'WARN',
  [LogLevel.ERROR]: 'ERROR',
}

/**
 * Set the current log level
 * @param level New log level
 */
export function setLogLevel(level: LogLevel): void {
  currentLogLevel = level
}

/**
 * Get the current log level
 * @returns Current log level
 */
export function getLogLevel(): LogLevel {
  return currentLogLevel
}

/**
 * Format a log message with timestamp and module name
 * @param level Log level
 * @param module Module name
 * @param message Log message
 * @returns Formatted log message
 */
function formatLogMessage(level: LogLevel, module: string, message: string): string {
  const timestamp = new Date().toISOString()
  return `[${timestamp}] [${LOG_NAMES[level]}] [${module}] ${message}`
}

/**
 * Log a message if the current log level allows it
 * @param level Log level
 * @param module Module name
 * @param message Log message
 * @param data Additional data to log
 */
function log(level: LogLevel, module: string, message: string, ...data: any[]): void {
  if (level < currentLogLevel) return
  
  const formattedMessage = formatLogMessage(level, module, message)
  
  // Use different console methods based on log level
  switch (level) {
    case LogLevel.DEBUG:
      console.debug(`%c${formattedMessage}`, `color: ${LOG_COLORS[level]}`, ...data)
      break
    case LogLevel.INFO:
      console.info(`%c${formattedMessage}`, `color: ${LOG_COLORS[level]}`, ...data)
      break
    case LogLevel.WARN:
      console.warn(`%c${formattedMessage}`, `color: ${LOG_COLORS[level]}`, ...data)
      break
    case LogLevel.ERROR:
      console.error(`%c${formattedMessage}`, `color: ${LOG_COLORS[level]}`, ...data)
      break
  }
}

/**
 * Create a logger for a specific module
 * @param module Module name
 * @returns Logger object with methods for each log level
 */
export function createLogger(module: string) {
  return {
    debug: (message: string, ...data: any[]) => log(LogLevel.DEBUG, module, message, ...data),
    info: (message: string, ...data: any[]) => log(LogLevel.INFO, module, message, ...data),
    warn: (message: string, ...data: any[]) => log(LogLevel.WARN, module, message, ...data),
    error: (message: string, ...data: any[]) => log(LogLevel.ERROR, module, message, ...data),
  }
}

// Default logger with createLogger method exposed
export const logger = {
  debug: (message: string, ...data: any[]) => log(LogLevel.DEBUG, 'App', message, ...data),
  info: (message: string, ...data: any[]) => log(LogLevel.INFO, 'App', message, ...data),
  warn: (message: string, ...data: any[]) => log(LogLevel.WARN, 'App', message, ...data),
  error: (message: string, ...data: any[]) => log(LogLevel.ERROR, 'App', message, ...data),
  createLogger,
}
