/**
 * Structured logging utility with Sentry integration.
 *
 * On the server, uses Sentry for error tracking and structured logs.
 * On the client, logs to console only (Sentry DSN is kept private server-side).
 *
 * @see https://docs.sentry.io/platforms/javascript/guides/nextjs/
 */

import * as Sentry from '@sentry/nextjs';

// Check if we're on the server
const isServer = typeof window === 'undefined';

// Get the Sentry logger for structured logging (server-side only)
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

  // Only send to Sentry on server (DSN is private)
  if (isServer) {
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

  if (isServer) {
    logger.warn(message, context ?? {});
  }
}
// ============================================================================
// User Context
// ============================================================================
// ============================================================================
// Breadcrumbs
// ============================================================================
// ============================================================================
// Performance Tracing
// ============================================================================
// ============================================================================
// Template Literal Helper
// ============================================================================
// Re-export the Sentry logger for direct access
