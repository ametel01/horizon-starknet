/**
 * Structured logging utility with Sentry integration.
 *
 * Uses Sentry's built-in logger for structured logs that appear in the Sentry dashboard.
 * Also provides tracing helpers for performance monitoring.
 *
 * @see https://docs.sentry.io/platforms/javascript/guides/nextjs/
 */

import * as Sentry from '@sentry/nextjs';

// Get the Sentry logger for structured logging
const { logger } = Sentry;

export interface LogContext {
  /** Component or module name for categorization */
  module?: string;
  /** Additional context to include with the log */
  [key: string]: unknown;
}

// ============================================================================
// Logging Functions
// ============================================================================

/**
 * Logs an error to both console and Sentry.
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

  // Always log to console for development
  if (context) {
    console.error(`[${context.module ?? 'app'}]`, errorObj.message, context);
  } else {
    console.error(errorObj);
  }

  // Build capture options - only include defined properties
  const captureOptions: Parameters<typeof Sentry.captureException>[1] = {};

  if (context) {
    captureOptions.extra = context;
  }
  if (context?.module) {
    captureOptions.tags = { module: context.module };
  }

  // Send to Sentry with context
  Sentry.captureException(errorObj, captureOptions);

  // Also log via Sentry logger for structured logs
  logger.error(errorObj.message, context ?? {});
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

  logger.warn(message, context ?? {});
}

/**
 * Logs an info message.
 *
 * @param message - The info message
 * @param context - Additional context
 */
export function logInfo(message: string, context?: LogContext): void {
  logger.info(message, context ?? {});
}

/**
 * Logs a debug message.
 *
 * @param message - The debug message
 * @param context - Additional context
 */
export function logDebug(message: string, context?: LogContext): void {
  logger.debug(message, context ?? {});
}

/**
 * Logs a trace message (lowest level, for detailed debugging).
 *
 * @param message - The trace message
 * @param context - Additional context
 */
export function logTrace(message: string, context?: LogContext): void {
  logger.trace(message, context ?? {});
}

/**
 * Logs a fatal error (highest severity).
 *
 * @param message - The fatal error message
 * @param context - Additional context
 */
export function logFatal(message: string, context?: LogContext): void {
  console.error(`[FATAL] [${context?.module ?? 'app'}]`, message, context);
  logger.fatal(message, context ?? {});
}

// ============================================================================
// User Context
// ============================================================================

/**
 * Sets user context for error tracking.
 * Call this when a user connects their wallet.
 *
 * @param userId - User identifier (e.g., truncated wallet address)
 */
export function setUser(userId: string | null): void {
  if (userId) {
    Sentry.setUser({ id: userId });
  } else {
    Sentry.setUser(null);
  }
}

// ============================================================================
// Breadcrumbs
// ============================================================================

/**
 * Adds a breadcrumb for debugging error traces.
 *
 * @param message - Description of the action
 * @param category - Category for grouping (e.g., 'transaction', 'navigation')
 * @param data - Additional data to include
 */
export function addBreadcrumb(
  message: string,
  category: string,
  data?: Record<string, unknown>
): void {
  const breadcrumb: Sentry.Breadcrumb = {
    message,
    category,
    level: 'info',
  };

  if (data) {
    breadcrumb.data = data;
  }

  Sentry.addBreadcrumb(breadcrumb);
}

// ============================================================================
// Performance Tracing
// ============================================================================

/**
 * Creates a span to measure performance of an operation.
 * Use for UI interactions, API calls, and other meaningful actions.
 *
 * @param op - Operation type (e.g., 'ui.click', 'http.client', 'db.query')
 * @param name - Human-readable name for the span
 * @param fn - Function to execute within the span
 * @returns The result of the function
 *
 * @example
 * ```ts
 * // UI interaction tracing
 * const result = await trace('ui.click', 'Swap Button Click', async (span) => {
 *   span.setAttribute('market', marketAddress);
 *   return await executeSwap();
 * });
 *
 * // API call tracing
 * const data = await trace('http.client', 'GET /api/markets', async () => {
 *   return await fetch('/api/markets').then(r => r.json());
 * });
 * ```
 */
export function trace<T>(
  op: string,
  name: string,
  fn: (span: Sentry.Span) => T | Promise<T>
): T | Promise<T> {
  return Sentry.startSpan({ op, name }, fn);
}

/**
 * Creates a span for an async operation with automatic error handling.
 *
 * @param op - Operation type
 * @param name - Human-readable name
 * @param fn - Async function to execute
 * @param attributes - Optional attributes to add to the span
 */
export async function traceAsync<T>(
  op: string,
  name: string,
  fn: () => Promise<T>,
  attributes?: Record<string, string | number | boolean>
): Promise<T> {
  return Sentry.startSpan({ op, name }, async (span) => {
    if (attributes) {
      Object.entries(attributes).forEach(([key, value]) => {
        span.setAttribute(key, value);
      });
    }
    return fn();
  });
}

// ============================================================================
// Template Literal Helper
// ============================================================================

/**
 * Re-export Sentry's logger.fmt for template literal logging.
 *
 * @example
 * ```ts
 * logger.debug(fmt`Cache miss for user: ${userId}`);
 * ```
 */
export const fmt = logger.fmt;

// Re-export the Sentry logger for direct access
export { logger };
