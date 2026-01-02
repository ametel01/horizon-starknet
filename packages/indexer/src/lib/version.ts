/**
 * Build Metadata Module
 *
 * Provides build-time information for logging, health checks, and debugging.
 * Values are injected via environment variables at build/deploy time.
 *
 * CI/CD Integration:
 * Set these environment variables in your CI/CD pipeline:
 *
 * GitHub Actions:
 * ```yaml
 * env:
 *   GIT_COMMIT: ${{ github.sha }}
 *   GIT_BRANCH: ${{ github.ref_name }}
 *   BUILD_TIME: ${{ github.event.head_commit.timestamp }}
 * ```
 *
 * Docker:
 * ```dockerfile
 * ARG GIT_COMMIT
 * ARG BUILD_TIME
 * ENV GIT_COMMIT=$GIT_COMMIT
 * ENV BUILD_TIME=$BUILD_TIME
 * ```
 */

/**
 * Build information interface
 */
export interface BuildInfo {
  /**
   * Git commit SHA (full or short)
   */
  commit: string;

  /**
   * Git branch name
   */
  branch: string;

  /**
   * Build timestamp (ISO 8601)
   */
  buildTime: string;

  /**
   * Bun/Node.js version
   */
  runtime: string;

  /**
   * Environment (development/production/test)
   */
  env: string;

  /**
   * Package version from package.json
   */
  version: string;
}

/**
 * Get build information from environment
 *
 * Values are read from environment variables set at build time.
 * Falls back to sensible defaults for local development.
 *
 * @returns Build information object
 *
 * @example
 * const info = getBuildInfo();
 * console.log(`Running commit ${info.commit} built at ${info.buildTime}`);
 */
export function getBuildInfo(): BuildInfo {
  const bunVersion = process.versions.bun;
  return {
    commit: process.env["GIT_COMMIT"] ?? "unknown",
    branch: process.env["GIT_BRANCH"] ?? "unknown",
    buildTime: process.env["BUILD_TIME"] ?? new Date().toISOString(),
    runtime: bunVersion ? `Bun ${bunVersion}` : `Node ${process.version}`,

    env: process.env.NODE_ENV ?? "development",
    version: process.env["npm_package_version"] ?? "0.0.0",
  };
}

/**
 * Get a short summary string for logging
 *
 * @returns Summary string like "v1.0.0 (abc1234)"
 *
 * @example
 * logger.info({ build: getBuildSummary() }, "Indexer starting");
 */
export function getBuildSummary(): string {
  const info = getBuildInfo();
  const shortCommit = info.commit.slice(0, 7);
  return `v${info.version} (${shortCommit})`;
}

/**
 * Get build info formatted for health endpoint
 *
 * @returns Build info suitable for JSON response
 */
export function getBuildInfoForHealth(): Record<string, string> {
  const info = getBuildInfo();
  return {
    version: info.version,
    commit: info.commit.slice(0, 7),
    branch: info.branch,
    buildTime: info.buildTime,
    runtime: info.runtime,
  };
}

/**
 * Check if running a development build
 *
 * @returns true if commit is unknown (local development)
 */
export function isDevelopmentBuild(): boolean {
  return getBuildInfo().commit === "unknown";
}

/**
 * Log build info at startup
 *
 * Call this during application startup to log build metadata.
 *
 * @param log - Logger instance
 *
 * @example
 * import { logger } from "./logger";
 * logBuildInfo(logger);
 */
export function logBuildInfo(log: {
  info: (obj: Record<string, unknown>, msg: string) => void;
}): void {
  const info = getBuildInfo();
  log.info(
    {
      version: info.version,
      commit: info.commit.slice(0, 7),
      branch: info.branch,
      buildTime: info.buildTime,
      runtime: info.runtime,
      env: info.env,
    },
    "Build information"
  );
}
