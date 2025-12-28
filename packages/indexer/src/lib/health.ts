/**
 * Health Check HTTP Server
 *
 * Provides HTTP endpoints for Kubernetes/Railway health probes and debugging.
 * Exposes indexer health status based on metrics thresholds.
 *
 * Endpoints:
 * - GET /health or /healthz - Health check (200 healthy, 503 degraded)
 * - GET /ready - Readiness check (200 if at least one indexer is active)
 * - GET /metrics - JSON metrics dump (for debugging, not Prometheus format)
 *
 * Health Thresholds:
 * - Lag: > 5 minutes since last block = degraded
 * - Error rate: > 10% = degraded
 */

import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";

import { logger } from "./logger";
import { getAllMetrics, generateReport, type IndexerMetrics } from "./metrics";

/**
 * Health status for an individual indexer
 */
export interface IndexerHealthStatus {
  lastBlock: number;
  lagSeconds: number;
  errorRate: number;
  status: "healthy" | "degraded" | "inactive";
}

/**
 * Overall health status response
 */
export interface HealthStatus {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  indexers: Record<string, IndexerHealthStatus>;
}

/**
 * Health check configuration thresholds
 */
export interface HealthConfig {
  /** Maximum lag in seconds before marking as degraded (default: 300 = 5 min) */
  maxLagSeconds: number;
  /** Maximum error rate before marking as degraded (default: 0.1 = 10%) */
  maxErrorRate: number;
  /** Maximum time since last block before marking as inactive (default: 600 = 10 min) */
  inactiveThresholdSeconds: number;
}

const DEFAULT_HEALTH_CONFIG: HealthConfig = {
  maxLagSeconds: 300,
  maxErrorRate: 0.1,
  inactiveThresholdSeconds: 600,
};

/**
 * Calculate health status for a single indexer
 *
 * @param metrics - Indexer metrics
 * @param config - Health thresholds
 * @returns Health status for the indexer
 */
function calculateIndexerHealth(
  metrics: IndexerMetrics,
  config: HealthConfig,
): IndexerHealthStatus {
  const now = Date.now();
  const lagSeconds =
    metrics.lastBlockTimestamp > 0
      ? (now - metrics.lastBlockTimestamp) / 1000
      : Infinity;

  const totalEvents = metrics.totalEventsProcessed + metrics.totalEventsFailed;
  const errorRate =
    totalEvents > 0 ? metrics.totalEventsFailed / totalEvents : 0;

  let status: IndexerHealthStatus["status"] = "healthy";

  // Check if indexer is inactive (never processed or very stale)
  if (
    metrics.lastBlockTimestamp === 0 ||
    lagSeconds > config.inactiveThresholdSeconds
  ) {
    status = "inactive";
  } else if (
    lagSeconds > config.maxLagSeconds ||
    errorRate > config.maxErrorRate
  ) {
    status = "degraded";
  }

  return {
    lastBlock: metrics.lastBlockNumber,
    lagSeconds: Math.round(lagSeconds),
    errorRate: Number(errorRate.toFixed(4)),
    status,
  };
}

/**
 * Get overall health status for all indexers
 *
 * @param config - Health thresholds (optional)
 * @returns Aggregated health status
 */
export function getHealthStatus(
  config: HealthConfig = DEFAULT_HEALTH_CONFIG,
): HealthStatus {
  const allMetrics = getAllMetrics();

  // Calculate health for each indexer and build the indexers map
  const indexerEntries: [string, IndexerHealthStatus][] = [];
  for (const [name, metrics] of allMetrics) {
    const indexerHealth = calculateIndexerHealth(metrics, config);
    indexerEntries.push([name, indexerHealth]);
  }
  const indexers = Object.fromEntries(indexerEntries);

  // Determine overall health
  const hasHealthy = indexerEntries.some(([, h]) => h.status === "healthy");
  const hasDegraded = indexerEntries.some(([, h]) => h.status === "degraded");

  // Overall status logic:
  // - unhealthy: no indexers registered or all inactive
  // - degraded: at least one indexer is degraded
  // - healthy: at least one indexer is healthy and none degraded
  let overallStatus: HealthStatus["status"];

  if (allMetrics.size === 0) {
    overallStatus = "unhealthy";
  } else if (hasDegraded) {
    overallStatus = "degraded";
  } else if (hasHealthy) {
    overallStatus = "healthy";
  } else {
    overallStatus = "unhealthy";
  }

  return {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    indexers,
  };
}

/**
 * Check if system is ready to receive traffic
 *
 * Ready if at least one indexer has processed a block.
 *
 * @returns Whether the system is ready
 */
export function isReady(): boolean {
  const allMetrics = getAllMetrics();

  for (const [, metrics] of allMetrics) {
    if (metrics.lastBlockNumber > 0) {
      return true;
    }
  }

  return false;
}

/**
 * Get detailed metrics dump for debugging
 *
 * @returns Metrics for all indexers
 */
function getMetricsDump(): Record<string, unknown> {
  const allMetrics = getAllMetrics();

  const entries: [string, unknown][] = [];
  for (const [name] of allMetrics) {
    entries.push([name, generateReport(name, 60000)]);
  }

  return {
    timestamp: new Date().toISOString(),
    indexers: Object.fromEntries(entries),
  };
}

/**
 * HTTP request handler
 */
function handleRequest(
  req: IncomingMessage,
  res: ServerResponse,
  config: HealthConfig,
): void {
  const url = req.url ?? "/";

  // Health check endpoints
  if (url === "/health" || url === "/healthz") {
    const status = getHealthStatus(config);
    const statusCode = status.status === "healthy" ? 200 : 503;

    res.writeHead(statusCode, { "Content-Type": "application/json" });
    res.end(JSON.stringify(status, null, 2));
    return;
  }

  // Readiness check endpoint
  if (url === "/ready" || url === "/readyz") {
    const ready = isReady();
    const statusCode = ready ? 200 : 503;

    res.writeHead(statusCode, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        ready,
        timestamp: new Date().toISOString(),
      }),
    );
    return;
  }

  // Metrics dump endpoint
  if (url === "/metrics") {
    const metrics = getMetricsDump();

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(metrics, null, 2));
    return;
  }

  // 404 for unknown routes
  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(
    JSON.stringify({
      error: "Not found",
      availableEndpoints: [
        "/health",
        "/healthz",
        "/ready",
        "/readyz",
        "/metrics",
      ],
    }),
  );
}

/**
 * Health server instance (for cleanup)
 */
let healthServer: Server | null = null;

/**
 * Start the health check HTTP server
 *
 * @param port - Port to listen on (default: 8080)
 * @param config - Health thresholds (optional)
 * @returns HTTP server instance
 */
export function startHealthServer(
  port = 8080,
  config: HealthConfig = DEFAULT_HEALTH_CONFIG,
): Server {
  // Stop existing server if running
  if (healthServer) {
    healthServer.close();
  }

  healthServer = createServer((req, res) => {
    handleRequest(req, res, config);
  });

  healthServer.listen(port, () => {
    logger.info(
      {
        port,
        endpoints: ["/health", "/ready", "/metrics"],
      },
      "Health server started",
    );
  });

  // Handle server errors
  healthServer.on("error", (err) => {
    logger.error({ err, port }, "Health server error");
  });

  return healthServer;
}

/**
 * Stop the health check HTTP server
 *
 * Call this during graceful shutdown.
 */
export function stopHealthServer(): Promise<void> {
  return new Promise((resolve) => {
    if (healthServer) {
      healthServer.close(() => {
        logger.info("Health server stopped");
        healthServer = null;
        resolve();
      });
    } else {
      resolve();
    }
  });
}
