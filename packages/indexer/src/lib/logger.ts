/**
 * Production-grade logging module using Pino
 *
 * Features:
 * - JSON structured logging for log aggregation (ELK, DataDog, etc.)
 * - Configurable log levels via LOG_LEVEL env var
 * - Pretty printing in development via LOG_PRETTY env var
 * - Child loggers for per-indexer context
 * - High performance (pino is the fastest Node.js logger)
 */

import type { Logger } from "pino";
import pino from "pino";

export type { Logger };

/**
 * Log levels (from most to least verbose):
 * - trace: Fine-grained debugging
 * - debug: Debugging information
 * - info: General operational information
 * - warn: Warning conditions
 * - error: Error conditions
 * - fatal: System is unusable
 */
type LogLevel = "trace" | "debug" | "info" | "warn" | "error" | "fatal";

const LOG_LEVEL: LogLevel =
  (process.env["LOG_LEVEL"] as LogLevel | undefined) ?? "info";
const LOG_PRETTY = process.env["LOG_PRETTY"] === "true";
const NODE_ENV = process.env["NODE_ENV"];

/**
 * Create the base logger configuration
 */
function createLoggerConfig(): pino.LoggerOptions {
  const env = NODE_ENV ?? "development";
  const isProduction = env === "production";

  const baseConfig: pino.LoggerOptions = {
    level: LOG_LEVEL,
    // Add timestamp to all logs
    timestamp: pino.stdTimeFunctions.isoTime,
    // Base context for all logs
    base: {
      env,
      service: "horizon-indexer",
    },
    // Format error objects properly
    formatters: {
      level: (label) => ({ level: label }),
      bindings: (bindings) => ({
        pid: bindings["pid"] as number,
        host: bindings["hostname"] as string,
      }),
    },
    // Redact sensitive fields
    redact: {
      paths: ["connectionString", "password", "secret", "token", "apiKey"],
      censor: "[REDACTED]",
    },
  };

  // In production, use JSON output for log aggregation
  if (isProduction) {
    return baseConfig;
  }

  // In development, optionally use pretty printing
  if (LOG_PRETTY) {
    return {
      ...baseConfig,
      transport: {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "HH:MM:ss.l",
          ignore: "pid,hostname,env,service",
          messageFormat: "{msg}",
        },
      },
    };
  }

  return baseConfig;
}

/**
 * Root logger instance
 */
export const logger = pino(createLoggerConfig());

/**
 * Create a child logger for a specific indexer
 *
 * @param indexerName - Name of the indexer (e.g., "factory", "market", "router")
 * @returns Child logger with indexer context
 *
 * @example
 * const log = createIndexerLogger("factory");
 * log.info({ block: 123 }, "Processing block");
 */
export function createIndexerLogger(indexerName: string): Logger {
  return logger.child({ indexer: indexerName });
}

/**
 * Create a child logger for scripts
 *
 * @param scriptName - Name of the script
 * @returns Child logger with script context
 */
export function createScriptLogger(scriptName: string): Logger {
  return logger.child({ script: scriptName });
}

/**
 * Log a block progress message (throttled to reduce noise)
 *
 * @param log - Logger instance
 * @param blockNumber - Current block number
 * @param cursor - Current cursor
 * @param throttleInterval - Only log every N blocks (default: 1000)
 */
export function logBlockProgress(
  log: Logger,
  blockNumber: number,
  cursor: bigint | undefined,
  throttleInterval = 1000
): void {
  if (blockNumber % throttleInterval === 0) {
    log.info(
      { block: blockNumber, cursor: cursor?.toString() },
      "Block progress"
    );
  }
}

/**
 * Log indexer startup
 */
export function logIndexerStart(
  log: Logger,
  config: {
    streamUrl: string;
    startingBlock: number;
    knownContracts?: number;
  }
): void {
  log.info(
    {
      streamUrl: config.streamUrl,
      startingBlock: config.startingBlock,
      knownContracts: config.knownContracts,
    },
    "Indexer starting"
  );
}

/**
 * Log contract discovery (factory pattern)
 */
export function logContractDiscovery(
  log: Logger,
  contractType: string,
  address: string
): void {
  log.info({ contractType, address }, "Discovered new contract");
}

/**
 * Log batch insert completion
 */
export function logBatchInsert(
  log: Logger,
  blockNumber: number,
  eventCount: number
): void {
  log.debug(
    { block: blockNumber, events: eventCount },
    "Batch insert completed"
  );
}
