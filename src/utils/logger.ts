/**
 * Centralized logger that sends all logs to Discord
 * Replaces console.log, console.error, etc. with Discord-aware logging
 */

let discordLogger: any = null;

/**
 * Initialize the logger with Discord logger instance
 */
export function initializeLogger(logger: any): void {
  discordLogger = logger;
}

/**
 * Log info message
 */
export function logInfo(message: string, data?: any): void {
  console.log(message, data || '');
  if (discordLogger) {
    discordLogger.info(message, data);
  }
}

/**
 * Log warning message
 */
export function logWarn(message: string, data?: any): void {
  console.warn(message, data || '');
  if (discordLogger) {
    discordLogger.warn(message, data);
  }
}

/**
 * Log error message
 */
export function logError(message: string, data?: any): void {
  console.error(message, data || '');
  if (discordLogger) {
    discordLogger.error(message, data);
  }
}

/**
 * Log debug message
 */
export function logDebug(message: string, data?: any): void {
  console.debug(message, data || '');
  if (discordLogger) {
    discordLogger.debug(message, data);
  }
}
