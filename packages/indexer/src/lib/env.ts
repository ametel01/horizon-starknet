/**
 * Environment Validation Module
 *
 * Validates required environment variables on startup using Zod schemas.
 * Fails fast with clear error messages if configuration is invalid.
 *
 * Features:
 * - Type-safe environment access
 * - Default values for optional variables
 * - Validation with clear error messages
 * - Lazy initialization (validates on first access)
 */

import { z } from "zod";
import type { Logger } from "./logger";
import { logger } from "./logger";

const log: Logger = logger.child({ module: "env" });

/**
 * Environment variable schema
 *
 * All environment variables are validated against this schema.
 * Required variables will cause startup failure if missing.
 * Optional variables have sensible defaults.
 */
const envSchema = z.object({
  // ============================================================
  // Database Configuration (Required for production)
  // ============================================================

  /**
   * PostgreSQL connection string
   * Format: postgresql://user:password@host:port/database
   */
  POSTGRES_CONNECTION_STRING: z.string().min(1).optional(),

  /**
   * Maximum connections in the pool
   * Railway Hobby: 20 max, use 3-5 per indexer
   * Railway Pro: 100+ max, use 10-15 per indexer
   */
  PG_POOL_MAX: z.coerce.number().int().min(1).max(100).default(10),

  /**
   * Minimum connections to keep open
   */
  PG_POOL_MIN: z.coerce.number().int().min(0).max(50).default(2),

  // ============================================================
  // DNA Stream Configuration
  // ============================================================

  /**
   * DNA stream URL for Starknet data
   * Defaults to local devnet DNA server
   */
  DNA_STREAM_URL: z.url().optional(),

  /**
   * DNA authentication token (required for Apibara hosted streams)
   */
  DNA_TOKEN: z.string().min(1).optional(),

  // ============================================================
  // Health & Metrics Configuration
  // ============================================================

  /**
   * Port for health check HTTP server
   */
  HEALTH_PORT: z.coerce.number().int().min(1024).max(65535).default(8080),

  /**
   * Interval for metrics reporting (ms)
   */
  METRICS_INTERVAL_MS: z.coerce.number().int().min(1000).default(60000),

  // ============================================================
  // Logging Configuration
  // ============================================================

  /**
   * Log level
   */
  LOG_LEVEL: z
    .enum(["trace", "debug", "info", "warn", "error", "fatal"])
    .default("info"),

  // ============================================================
  // Runtime Configuration
  // ============================================================

  /**
   * Node environment
   */
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
});

/**
 * Validated environment type
 */
export type Env = z.infer<typeof envSchema>;

/**
 * Cached validated environment
 */
let cachedEnv: Env | null = null;

/**
 * Validate environment variables
 *
 * Parses and validates all environment variables against the schema.
 * Logs detailed errors for any validation failures.
 *
 * @returns Validated environment object
 * @throws Error if validation fails (in production mode)
 */
export function validateEnv(): Env {
  // Return cached result if already validated
  if (cachedEnv !== null) {
    return cachedEnv;
  }

  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const errors = result.error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
      code: issue.code,
    }));

    log.fatal({ errors }, "Environment validation failed");

    // In production, fail fast

    if (process.env.NODE_ENV === "production") {
      const errorMessages = errors.map((e) => `${e.path}: ${e.message}`);
      throw new Error(
        `Environment validation failed: ${errorMessages.join(", ")}`
      );
    }

    // In development, log warning but continue with defaults
    log.warn("Continuing with default values in development mode");
    cachedEnv = envSchema.parse({});
    return cachedEnv;
  }

  cachedEnv = result.data;
  log.debug({ env: summarizeEnv(cachedEnv) }, "Environment validated");
  return cachedEnv;
}

/**
 * Get validated environment
 *
 * Validates on first access and caches the result.
 * Use this for type-safe access to environment variables.
 *
 * @returns Validated environment object
 *
 * @example
 * const env = getEnv();
 * console.log(env.PG_POOL_MAX); // Type-safe access
 */
export function getEnv(): Env {
  return validateEnv();
}

/**
 * Check if a required environment variable is set
 *
 * Useful for conditional feature enablement.
 *
 * @param key - Environment variable name
 * @returns true if the variable is set and non-empty
 */
export function hasEnv(key: keyof Env): boolean {
  const env = getEnv();
  // Use Object.prototype.hasOwnProperty to safely check
  if (!Object.hasOwn(env, key)) {
    return false;
  }
  const descriptor = Object.getOwnPropertyDescriptor(env, key);
  const value = descriptor?.value as unknown;
  return value !== undefined && value !== "";
}

/**
 * Check if database is configured
 *
 * @returns true if POSTGRES_CONNECTION_STRING is set
 */
export function isDatabaseConfigured(): boolean {
  return hasEnv("POSTGRES_CONNECTION_STRING");
}

/**
 * Check if DNA token is configured
 *
 * @returns true if DNA_TOKEN is set
 */
export function isDnaTokenConfigured(): boolean {
  return hasEnv("DNA_TOKEN");
}

/**
 * Check if running in production mode
 *
 * @returns true if NODE_ENV is "production"
 */
export function isProduction(): boolean {
  return getEnv().NODE_ENV === "production";
}

/**
 * Check if running in development mode
 *
 * @returns true if NODE_ENV is "development"
 */
export function isDevelopment(): boolean {
  return getEnv().NODE_ENV === "development";
}

/**
 * Check if running in test mode
 *
 * @returns true if NODE_ENV is "test"
 */
export function isTest(): boolean {
  return getEnv().NODE_ENV === "test";
}

/**
 * Create a safe summary of environment for logging
 *
 * Masks sensitive values like connection strings and tokens.
 *
 * @param env - Environment object
 * @returns Safe summary for logging
 */
function summarizeEnv(env: Env): Record<string, unknown> {
  return {
    POSTGRES_CONNECTION_STRING: env.POSTGRES_CONNECTION_STRING
      ? "[CONFIGURED]"
      : "[NOT SET]",
    PG_POOL_MAX: env.PG_POOL_MAX,
    PG_POOL_MIN: env.PG_POOL_MIN,
    DNA_STREAM_URL: env.DNA_STREAM_URL ?? "[DEFAULT]",
    DNA_TOKEN: env.DNA_TOKEN ? "[CONFIGURED]" : "[NOT SET]",
    HEALTH_PORT: env.HEALTH_PORT,
    METRICS_INTERVAL_MS: env.METRICS_INTERVAL_MS,
    LOG_LEVEL: env.LOG_LEVEL,
    NODE_ENV: env.NODE_ENV,
  };
}

/**
 * Reset cached environment (for testing only)
 *
 * @internal
 */
export function resetEnvCache(): void {
  cachedEnv = null;
}
