/**
 * Simplified logging utility for SolidJS frontend.
 *
 * Console-based logging without external dependencies.
 * Can be extended to integrate with external logging services.
 */

// Check if we're on the server
const isServer = typeof window === 'undefined';

export interface LogContext {
  /** Component or module name for categorization */
  module?: string;
  /** Additional context to include with the log */
  [key: string]: unknown;
}

/**
 * Logs an error to console.
 *
 * @param error - The error to log (can be Error object or any value)
 * @param context - Additional context to include with the error
 *
 * @example
 * ```ts
 * try {
 *   await fetchData();
 * } catch (error) {
 *   logError(error, { module: 'markets', marketAddress });
 * }
 * ```
 */
export function logError(error: unknown, context?: LogContext): void {
  // Convert non-Error values to Error objects for consistent handling
  const errorObj = error instanceof Error ? error : new Error(String(error));

  if (context) {
    console.error(`[${context.module ?? 'app'}]`, errorObj.message, context);
  } else {
    console.error(errorObj);
  }
}

/**
 * Logs a warning message.
 *
 * @param message - The warning message
 * @param context - Additional context
 */
export function logWarn(message: string, context?: LogContext): void {
  if (context) {
    console.warn(`[${context.module ?? 'app'}]`, message, context);
  } else {
    console.warn(message);
  }
}

/**
 * Logs an info message.
 *
 * @param message - The info message
 * @param context - Additional context
 */
export function logInfo(message: string, context?: LogContext): void {
  if (isServer) {
    if (context) {
      console.info(`[${context.module ?? 'app'}]`, message, context);
    } else {
      console.info(message);
    }
  }
}

/**
 * Logs a debug message.
 *
 * @param message - The debug message
 * @param context - Additional context
 */
export function logDebug(message: string, context?: LogContext): void {
  if (isServer) {
    if (context) {
      console.debug(`[${context.module ?? 'app'}]`, message, context);
    } else {
      console.debug(message);
    }
  }
}

/**
 * Logs a trace message (lowest level, for detailed debugging).
 *
 * @param message - The trace message
 * @param context - Additional context
 */
export function logTrace(message: string, context?: LogContext): void {
  if (isServer) {
    if (context) {
      console.debug(`[TRACE] [${context.module ?? 'app'}]`, message, context);
    } else {
      console.debug(`[TRACE]`, message);
    }
  }
}

/**
 * Logs a fatal error (highest severity).
 *
 * @param message - The fatal error message
 * @param context - Additional context
 */
export function logFatal(message: string, context?: LogContext): void {
  console.error(`[FATAL] [${context?.module ?? 'app'}]`, message, context);
}
