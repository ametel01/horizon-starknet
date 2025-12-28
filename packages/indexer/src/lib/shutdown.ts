/**
 * Graceful Shutdown Module
 *
 * Handles process signals (SIGTERM, SIGINT) and ensures all resources
 * are properly cleaned up before exiting.
 *
 * Features:
 * - Cleanup function registry (LIFO order)
 * - Idempotent shutdown (only runs once)
 * - Timeout protection to prevent hanging
 * - Logging of cleanup progress
 */

import { logger } from "./logger";

import type { Logger } from "./logger";

const log: Logger = logger.child({ module: "shutdown" });

/**
 * Cleanup function type - must be async and return void
 */
type CleanupFn = () => Promise<void>;

/**
 * Registered cleanup entry with name for logging
 */
interface CleanupEntry {
  name: string;
  fn: CleanupFn;
}

/**
 * Registry of cleanup functions (executed in reverse order - LIFO)
 */
const cleanupRegistry: CleanupEntry[] = [];

/**
 * Guard to prevent multiple simultaneous shutdowns
 */
let isShuttingDown = false;

/**
 * Default timeout for the entire shutdown process (ms)
 */
const SHUTDOWN_TIMEOUT_MS = 30000;

/**
 * Register a cleanup function to be called on shutdown
 *
 * Cleanup functions are called in reverse order of registration (LIFO).
 * This ensures that dependencies are cleaned up after their dependents.
 *
 * @param name - Human-readable name for logging
 * @param fn - Async cleanup function
 *
 * @example
 * registerCleanup("database-pool", async () => {
 *   await pool.end();
 * });
 */
export function registerCleanup(name: string, fn: CleanupFn): void {
  cleanupRegistry.push({ name, fn });
  log.debug({ name, total: cleanupRegistry.length }, "Registered cleanup");
}

/**
 * Unregister a cleanup function by name
 *
 * Useful for resources that may be cleaned up manually before shutdown.
 *
 * @param name - Name of the cleanup function to remove
 * @returns true if the cleanup was found and removed
 */
export function unregisterCleanup(name: string): boolean {
  const index = cleanupRegistry.findIndex((entry) => entry.name === name);
  if (index !== -1) {
    cleanupRegistry.splice(index, 1);
    log.debug({ name, total: cleanupRegistry.length }, "Unregistered cleanup");
    return true;
  }
  return false;
}

/**
 * Execute all cleanup functions
 *
 * Runs cleanup functions in reverse order (LIFO).
 * Errors are logged but don't prevent other cleanups from running.
 *
 * @param signal - The signal that triggered shutdown (for logging)
 * @returns Number of cleanups that failed
 */
async function executeCleanups(signal: string): Promise<number> {
  let failureCount = 0;
  const total = cleanupRegistry.length;

  log.info({ signal, total }, "Starting cleanup");

  // Execute in reverse order (LIFO)
  for (let i = cleanupRegistry.length - 1; i >= 0; i--) {
    const entry = cleanupRegistry.at(i);
    if (!entry) continue;

    const { name, fn } = entry;
    const startTime = Date.now();

    try {
      log.debug({ name, remaining: i + 1 }, "Running cleanup");
      await fn();
      const duration = Date.now() - startTime;
      log.info({ name, durationMs: duration }, "Cleanup completed");
    } catch (err) {
      const duration = Date.now() - startTime;
      log.error({ err, name, durationMs: duration }, "Cleanup failed");
      failureCount++;
    }
  }

  return failureCount;
}

/**
 * Perform graceful shutdown
 *
 * Called when the process receives a termination signal.
 * Runs all registered cleanup functions and exits.
 *
 * @param signal - The signal that triggered shutdown
 */
async function performShutdown(signal: string): Promise<void> {
  // Guard against multiple simultaneous shutdowns
  if (isShuttingDown) {
    log.warn({ signal }, "Shutdown already in progress, ignoring signal");
    return;
  }
  isShuttingDown = true;

  log.info({ signal }, "Received shutdown signal");

  // Set a timeout to force exit if cleanup takes too long
  const timeoutId = setTimeout(() => {
    log.fatal(
      { timeoutMs: SHUTDOWN_TIMEOUT_MS },
      "Shutdown timeout exceeded, forcing exit",
    );
    // eslint-disable-next-line n/no-process-exit -- Intentional: force exit on timeout
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);

  try {
    const failureCount = await executeCleanups(signal);

    if (failureCount > 0) {
      log.warn({ failureCount }, "Shutdown completed with errors");
    } else {
      log.info("Shutdown completed successfully");
    }

    clearTimeout(timeoutId);
    // eslint-disable-next-line n/no-process-exit -- Intentional: graceful shutdown
    process.exit(failureCount > 0 ? 1 : 0);
  } catch (err) {
    log.fatal({ err }, "Unexpected error during shutdown");
    clearTimeout(timeoutId);
    // eslint-disable-next-line n/no-process-exit -- Intentional: graceful shutdown
    process.exit(1);
  }
}

/**
 * Check if shutdown is currently in progress
 *
 * Useful for preventing new work from starting during shutdown.
 */
export function isShutdownInProgress(): boolean {
  return isShuttingDown;
}

/**
 * Get the number of registered cleanup functions
 *
 * Useful for testing and diagnostics.
 */
export function getCleanupCount(): number {
  return cleanupRegistry.length;
}

/**
 * Clear all registered cleanup functions
 *
 * WARNING: Only use this for testing. In production, cleanups should
 * be managed via registerCleanup/unregisterCleanup.
 */
export function clearCleanups(): void {
  cleanupRegistry.length = 0;
  log.debug("All cleanups cleared");
}

/**
 * Reset shutdown state
 *
 * WARNING: Only use this for testing. In production, shutdown state
 * should never be reset.
 */
export function resetShutdownState(): void {
  isShuttingDown = false;
}

/**
 * Set up graceful shutdown handlers for process signals
 *
 * Call this once during application startup.
 *
 * Handles:
 * - SIGTERM: Sent by Docker/Kubernetes on container stop
 * - SIGINT: Sent by Ctrl+C in terminal
 * - SIGUSR2: Sent by nodemon on restart (for development)
 *
 * @example
 * // In your main entry point:
 * setupGracefulShutdown();
 * registerCleanup("database", async () => { ... });
 * startIndexers();
 */
export function setupGracefulShutdown(): void {
  // Helper to handle shutdown with proper error catching
  const handleSignal = (signal: string): void => {
    void performShutdown(signal).catch((err: unknown) => {
      log.fatal({ err, signal }, "Shutdown handler failed");
    });
  };

  // SIGTERM: Docker/Kubernetes stop
  process.on("SIGTERM", () => {
    handleSignal("SIGTERM");
  });

  // SIGINT: Ctrl+C
  process.on("SIGINT", () => {
    handleSignal("SIGINT");
  });

  // SIGUSR2: nodemon restart (development)
  process.on("SIGUSR2", () => {
    handleSignal("SIGUSR2");
  });

  // Uncaught exceptions - log and exit
  process.on("uncaughtException", (err) => {
    log.fatal({ err }, "Uncaught exception");
    handleSignal("uncaughtException");
  });

  // Unhandled promise rejections
  process.on("unhandledRejection", (reason) => {
    log.fatal({ reason }, "Unhandled promise rejection");
    handleSignal("unhandledRejection");
  });

  log.info("Graceful shutdown handlers registered");
}
