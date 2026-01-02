/**
 * Centralized Metrics Tracking Module
 *
 * Provides observability for indexer health, performance, and error tracking.
 * Metrics are stored in memory and periodically logged for external aggregation.
 *
 * Features:
 * - Per-indexer metrics tracking
 * - Event success/failure counting
 * - Database latency percentiles
 * - Reorg detection
 * - Periodic metrics reporting via Pino structured logs
 */

import { logger } from "./logger";

/**
 * Metrics tracked per indexer
 */
export interface IndexerMetrics {
  /** Total events successfully processed since last report */
  eventsProcessed: number;
  /** Total events that failed processing since last report */
  eventsFailed: number;
  /** Total blocks processed since last report */
  blocksProcessed: number;
  /** Most recent block number processed */
  lastBlockNumber: number;
  /** Timestamp when last block was processed */
  lastBlockTimestamp: number;
  /** Recent database insert latencies (ms) for percentile calculation */
  dbInsertLatencyMs: number[];
  /** Count of chain reorganizations detected */
  reorgCount: number;
  /** Total events processed since startup (cumulative) */
  totalEventsProcessed: number;
  /** Total events failed since startup (cumulative) */
  totalEventsFailed: number;
}

/**
 * In-memory metrics store keyed by indexer name
 */
const metrics = new Map<string, IndexerMetrics>();

/**
 * Interval ID for metrics reporter (used for cleanup)
 */
let reporterIntervalId: ReturnType<typeof setInterval> | null = null;

/**
 * Get or create metrics object for an indexer
 *
 * @param indexer - Indexer name (e.g., "factory", "market", "router")
 * @returns Metrics object for the indexer
 */
export function getMetrics(indexer: string): IndexerMetrics {
  const existing = metrics.get(indexer);
  if (existing) {
    return existing;
  }

  const newMetrics: IndexerMetrics = {
    eventsProcessed: 0,
    eventsFailed: 0,
    blocksProcessed: 0,
    lastBlockNumber: 0,
    lastBlockTimestamp: 0,
    dbInsertLatencyMs: [],
    reorgCount: 0,
    totalEventsProcessed: 0,
    totalEventsFailed: 0,
  };
  metrics.set(indexer, newMetrics);
  return newMetrics;
}

/**
 * Get all metrics for all indexers (for health checks)
 *
 * @returns Map of indexer names to their metrics
 */
export function getAllMetrics(): Map<string, IndexerMetrics> {
  return metrics;
}

/**
 * Record an event processing result
 *
 * @param indexer - Indexer name
 * @param success - Whether the event was processed successfully
 */
export function recordEvent(indexer: string, success: boolean): void {
  const m = getMetrics(indexer);
  if (success) {
    m.eventsProcessed++;
    m.totalEventsProcessed++;
  } else {
    m.eventsFailed++;
    m.totalEventsFailed++;
  }
}

/**
 * Record multiple events at once (for batch processing)
 *
 * @param indexer - Indexer name
 * @param successCount - Number of successfully processed events
 * @param failureCount - Number of failed events
 */
export function recordEvents(
  indexer: string,
  successCount: number,
  failureCount: number
): void {
  const m = getMetrics(indexer);
  m.eventsProcessed += successCount;
  m.totalEventsProcessed += successCount;
  m.eventsFailed += failureCount;
  m.totalEventsFailed += failureCount;
}

/**
 * Record a processed block
 *
 * @param indexer - Indexer name
 * @param blockNumber - Block number that was processed
 */
export function recordBlock(indexer: string, blockNumber: number): void {
  const m = getMetrics(indexer);
  m.blocksProcessed++;
  m.lastBlockNumber = blockNumber;
  m.lastBlockTimestamp = Date.now();
}

/**
 * Record database insert latency
 *
 * @param indexer - Indexer name
 * @param latencyMs - Latency in milliseconds
 */
export function recordDbLatency(indexer: string, latencyMs: number): void {
  const m = getMetrics(indexer);
  m.dbInsertLatencyMs.push(latencyMs);
  // Keep last 100 samples for percentile calculation
  if (m.dbInsertLatencyMs.length > 100) {
    m.dbInsertLatencyMs.shift();
  }
}

/**
 * Record a chain reorganization
 *
 * @param indexer - Indexer name
 */
export function recordReorg(indexer: string): void {
  const m = getMetrics(indexer);
  m.reorgCount++;
  logger.warn({ indexer, totalReorgs: m.reorgCount }, "Chain reorg detected");
}

/**
 * Calculate percentile from array of numbers
 *
 * @param values - Array of numbers
 * @param percentile - Percentile to calculate (0-100)
 * @returns Percentile value or 0 if array is empty
 */
function calculatePercentile(values: number[], percentile: number): number {
  if (values.length === 0) return 0;

  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)] ?? 0;
}

/**
 * Calculate average from array of numbers
 *
 * @param values - Array of numbers
 * @returns Average value or 0 if array is empty
 */
function calculateAverage(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, val) => sum + val, 0) / values.length;
}

/**
 * Generate a metrics report for an indexer
 *
 * @param indexer - Indexer name
 * @param intervalMs - Reporting interval in milliseconds
 * @returns Formatted metrics report
 */
export function generateReport(
  indexer: string,
  intervalMs: number
): Record<string, unknown> {
  const m = getMetrics(indexer);

  const avgLatency = calculateAverage(m.dbInsertLatencyMs);
  const p50Latency = calculatePercentile(m.dbInsertLatencyMs, 50);
  const p95Latency = calculatePercentile(m.dbInsertLatencyMs, 95);
  const p99Latency = calculatePercentile(m.dbInsertLatencyMs, 99);

  const totalProcessed = m.eventsProcessed + m.eventsFailed;
  const errorRate = totalProcessed > 0 ? m.eventsFailed / totalProcessed : 0;
  const eventsPerSec = m.eventsProcessed / (intervalMs / 1000);

  return {
    indexer,
    interval: {
      eventsProcessed: m.eventsProcessed,
      eventsFailed: m.eventsFailed,
      blocksProcessed: m.blocksProcessed,
      errorRate: errorRate.toFixed(4),
      eventsPerSec: eventsPerSec.toFixed(2),
    },
    cumulative: {
      totalEventsProcessed: m.totalEventsProcessed,
      totalEventsFailed: m.totalEventsFailed,
      reorgCount: m.reorgCount,
    },
    latency: {
      avgMs: avgLatency.toFixed(2),
      p50Ms: p50Latency.toFixed(2),
      p95Ms: p95Latency.toFixed(2),
      p99Ms: p99Latency.toFixed(2),
      samples: m.dbInsertLatencyMs.length,
    },
    position: {
      lastBlockNumber: m.lastBlockNumber,
      lastBlockAge:
        m.lastBlockTimestamp > 0
          ? `${String(Math.round((Date.now() - m.lastBlockTimestamp) / 1000))}s ago`
          : "never",
    },
  };
}

/**
 * Reset per-interval counters after reporting
 *
 * @param indexer - Indexer name
 */
function resetIntervalCounters(indexer: string): void {
  const m = getMetrics(indexer);
  m.eventsProcessed = 0;
  m.eventsFailed = 0;
  m.blocksProcessed = 0;
  m.dbInsertLatencyMs = [];
}

/**
 * Start periodic metrics reporting
 *
 * Logs metrics for all active indexers at the specified interval.
 * Metrics are output as structured JSON logs for aggregation by
 * external systems (DataDog, ELK, CloudWatch, etc.)
 *
 * @param intervalMs - Reporting interval in milliseconds (default: 60000)
 * @returns Interval ID for cleanup
 */
export function startMetricsReporter(
  intervalMs = 60000
): ReturnType<typeof setInterval> {
  // Stop existing reporter if running
  if (reporterIntervalId) {
    clearInterval(reporterIntervalId);
  }

  logger.info({ intervalMs }, "Starting metrics reporter");

  reporterIntervalId = setInterval(() => {
    for (const [indexer] of metrics) {
      const report = generateReport(indexer, intervalMs);
      logger.info(report, "Indexer metrics");
      resetIntervalCounters(indexer);
    }
  }, intervalMs);

  return reporterIntervalId;
}

/**
 * Stop the metrics reporter
 *
 * Call this during graceful shutdown.
 */
export function stopMetricsReporter(): void {
  if (reporterIntervalId) {
    clearInterval(reporterIntervalId);
    reporterIntervalId = null;
    logger.info("Metrics reporter stopped");
  }
}

/**
 * Measure execution time of an async function
 *
 * @param indexer - Indexer name for recording latency
 * @param fn - Async function to measure
 * @returns Result of the function
 *
 * @example
 * await measureDbLatency("market", async () => {
 *   await db.insert(marketSwap).values(rows);
 * });
 */
export async function measureDbLatency<T>(
  indexer: string,
  fn: () => Promise<T>
): Promise<T> {
  const startTime = performance.now();
  try {
    return await fn();
  } finally {
    const latency = performance.now() - startTime;
    recordDbLatency(indexer, latency);
  }
}
