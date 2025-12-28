/**
 * Metrics Module Tests
 *
 * Tests the centralized metrics tracking functionality.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  getMetrics,
  getAllMetrics,
  recordEvent,
  recordEvents,
  recordBlock,
  recordDbLatency,
  recordReorg,
  generateReport,
  measureDbLatency,
  startMetricsReporter,
  stopMetricsReporter,
} from "../src/lib/metrics";

// Mock logger to suppress output during tests
vi.mock("../src/lib/logger", () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

// Helper to reset metrics between tests
function resetMetrics(): void {
  const allMetrics = getAllMetrics();
  allMetrics.clear();
}

// Helper for timing tests
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("Metrics Module", () => {
  beforeEach(() => {
    resetMetrics();
    vi.useFakeTimers();
  });

  afterEach(() => {
    stopMetricsReporter();
    vi.useRealTimers();
  });

  // ============================================================
  // GET METRICS TESTS
  // ============================================================

  describe("getMetrics", () => {
    it("creates new metrics for unknown indexer", () => {
      const metrics = getMetrics("new-indexer");

      expect(metrics).toBeDefined();
      expect(metrics.eventsProcessed).toBe(0);
      expect(metrics.eventsFailed).toBe(0);
      expect(metrics.blocksProcessed).toBe(0);
      expect(metrics.lastBlockNumber).toBe(0);
      expect(metrics.lastBlockTimestamp).toBe(0);
      expect(metrics.dbInsertLatencyMs).toEqual([]);
      expect(metrics.reorgCount).toBe(0);
      expect(metrics.totalEventsProcessed).toBe(0);
      expect(metrics.totalEventsFailed).toBe(0);
    });

    it("returns same metrics object for same indexer", () => {
      const metrics1 = getMetrics("factory");
      const metrics2 = getMetrics("factory");

      expect(metrics1).toBe(metrics2);
    });

    it("returns different metrics for different indexers", () => {
      const factoryMetrics = getMetrics("factory");
      const routerMetrics = getMetrics("router");

      expect(factoryMetrics).not.toBe(routerMetrics);
    });
  });

  // ============================================================
  // GET ALL METRICS TESTS
  // ============================================================

  describe("getAllMetrics", () => {
    it("returns empty map when no metrics registered", () => {
      const allMetrics = getAllMetrics();
      expect(allMetrics.size).toBe(0);
    });

    it("returns all registered indexer metrics", () => {
      getMetrics("factory");
      getMetrics("router");
      getMetrics("market");

      const allMetrics = getAllMetrics();
      expect(allMetrics.size).toBe(3);
      expect(allMetrics.has("factory")).toBe(true);
      expect(allMetrics.has("router")).toBe(true);
      expect(allMetrics.has("market")).toBe(true);
    });
  });

  // ============================================================
  // RECORD EVENT TESTS
  // ============================================================

  describe("recordEvent", () => {
    it("increments eventsProcessed for success", () => {
      recordEvent("factory", true);
      recordEvent("factory", true);

      const metrics = getMetrics("factory");
      expect(metrics.eventsProcessed).toBe(2);
      expect(metrics.totalEventsProcessed).toBe(2);
      expect(metrics.eventsFailed).toBe(0);
    });

    it("increments eventsFailed for failure", () => {
      recordEvent("factory", false);
      recordEvent("factory", false);

      const metrics = getMetrics("factory");
      expect(metrics.eventsFailed).toBe(2);
      expect(metrics.totalEventsFailed).toBe(2);
      expect(metrics.eventsProcessed).toBe(0);
    });

    it("tracks both success and failure correctly", () => {
      recordEvent("router", true);
      recordEvent("router", false);
      recordEvent("router", true);
      recordEvent("router", false);

      const metrics = getMetrics("router");
      expect(metrics.eventsProcessed).toBe(2);
      expect(metrics.eventsFailed).toBe(2);
      expect(metrics.totalEventsProcessed).toBe(2);
      expect(metrics.totalEventsFailed).toBe(2);
    });
  });

  // ============================================================
  // RECORD EVENTS (BATCH) TESTS
  // ============================================================

  describe("recordEvents", () => {
    it("records multiple events at once", () => {
      recordEvents("market", 10, 2);

      const metrics = getMetrics("market");
      expect(metrics.eventsProcessed).toBe(10);
      expect(metrics.eventsFailed).toBe(2);
      expect(metrics.totalEventsProcessed).toBe(10);
      expect(metrics.totalEventsFailed).toBe(2);
    });

    it("accumulates with existing counts", () => {
      recordEvents("market", 5, 1);
      recordEvents("market", 3, 2);

      const metrics = getMetrics("market");
      expect(metrics.eventsProcessed).toBe(8);
      expect(metrics.eventsFailed).toBe(3);
    });
  });

  // ============================================================
  // RECORD BLOCK TESTS
  // ============================================================

  describe("recordBlock", () => {
    it("increments blocksProcessed", () => {
      recordBlock("factory", 100);
      recordBlock("factory", 101);

      const metrics = getMetrics("factory");
      expect(metrics.blocksProcessed).toBe(2);
    });

    it("updates lastBlockNumber", () => {
      recordBlock("factory", 100);
      expect(getMetrics("factory").lastBlockNumber).toBe(100);

      recordBlock("factory", 200);
      expect(getMetrics("factory").lastBlockNumber).toBe(200);
    });

    it("updates lastBlockTimestamp", () => {
      const now = Date.now();
      vi.setSystemTime(now);

      recordBlock("factory", 100);

      const metrics = getMetrics("factory");
      expect(metrics.lastBlockTimestamp).toBe(now);
    });
  });

  // ============================================================
  // RECORD DB LATENCY TESTS
  // ============================================================

  describe("recordDbLatency", () => {
    it("adds latency to array", () => {
      recordDbLatency("factory", 10);
      recordDbLatency("factory", 20);
      recordDbLatency("factory", 30);

      const metrics = getMetrics("factory");
      expect(metrics.dbInsertLatencyMs).toEqual([10, 20, 30]);
    });

    it("maintains max 100 samples", () => {
      for (let i = 0; i < 110; i++) {
        recordDbLatency("factory", i);
      }

      const metrics = getMetrics("factory");
      expect(metrics.dbInsertLatencyMs.length).toBe(100);
      // Should keep the last 100 (10-109)
      expect(metrics.dbInsertLatencyMs[0]).toBe(10);
      expect(metrics.dbInsertLatencyMs[99]).toBe(109);
    });
  });

  // ============================================================
  // RECORD REORG TESTS
  // ============================================================

  describe("recordReorg", () => {
    it("increments reorg count", () => {
      recordReorg("factory");
      recordReorg("factory");

      const metrics = getMetrics("factory");
      expect(metrics.reorgCount).toBe(2);
    });
  });

  // ============================================================
  // GENERATE REPORT TESTS
  // ============================================================

  describe("generateReport", () => {
    it("generates report with all fields", () => {
      const now = Date.now();
      vi.setSystemTime(now);

      recordEvents("factory", 100, 5);
      recordBlock("factory", 12345);
      recordDbLatency("factory", 10);
      recordDbLatency("factory", 20);
      recordDbLatency("factory", 30);

      const report = generateReport("factory", 60000);

      expect(report["indexer"]).toBe("factory");
      expect(report["interval"]).toBeDefined();
      expect(report["cumulative"]).toBeDefined();
      expect(report["latency"]).toBeDefined();
      expect(report["position"]).toBeDefined();
    });

    it("calculates error rate correctly", () => {
      recordEvents("factory", 90, 10); // 10% error rate

      const report = generateReport("factory", 60000);
      const interval = report["interval"] as Record<string, unknown>;

      expect(interval["errorRate"]).toBe("0.1000");
    });

    it("calculates events per second correctly", () => {
      recordEvents("factory", 60, 0);

      const report = generateReport("factory", 60000); // 60 second interval
      const interval = report["interval"] as Record<string, unknown>;

      expect(interval["eventsPerSec"]).toBe("1.00");
    });

    it("calculates latency percentiles", () => {
      // Add 100 samples from 1 to 100
      for (let i = 1; i <= 100; i++) {
        recordDbLatency("factory", i);
      }

      const report = generateReport("factory", 60000);
      const latency = report["latency"] as Record<string, unknown>;

      expect(latency["samples"]).toBe(100);
      expect(latency["p50Ms"]).toBe("50.00");
      expect(latency["p95Ms"]).toBe("95.00");
      expect(latency["p99Ms"]).toBe("99.00");
    });

    it("handles empty latency array", () => {
      const report = generateReport("factory", 60000);
      const latency = report["latency"] as Record<string, unknown>;

      expect(latency["avgMs"]).toBe("0.00");
      expect(latency["p50Ms"]).toBe("0.00");
      expect(latency["samples"]).toBe(0);
    });
  });

  // ============================================================
  // MEASURE DB LATENCY TESTS
  // ============================================================

  describe("measureDbLatency", () => {
    it("records latency and returns result", async () => {
      const result = await measureDbLatency("factory", () => {
        return Promise.resolve("test-result");
      });

      expect(result).toBe("test-result");

      const metrics = getMetrics("factory");
      expect(metrics.dbInsertLatencyMs.length).toBe(1);
    });

    it("records latency even on error", async () => {
      await expect(
        measureDbLatency("factory", () => {
          return Promise.reject(new Error("Test error"));
        }),
      ).rejects.toThrow("Test error");

      const metrics = getMetrics("factory");
      expect(metrics.dbInsertLatencyMs.length).toBe(1);
    });

    it("measures actual execution time", async () => {
      vi.useRealTimers(); // Need real timers for this test

      await measureDbLatency("factory", () => delay(50));

      const metrics = getMetrics("factory");
      expect(metrics.dbInsertLatencyMs[0]).toBeGreaterThanOrEqual(40); // Allow some variance
    });
  });

  // ============================================================
  // METRICS REPORTER TESTS
  // ============================================================

  describe("startMetricsReporter", () => {
    it("starts periodic reporting", () => {
      getMetrics("factory"); // Register an indexer

      startMetricsReporter(1000);

      // Advance time to trigger reporter
      vi.advanceTimersByTime(1000);

      // Metrics should have been reset after reporting
      const metrics = getMetrics("factory");
      expect(metrics.eventsProcessed).toBe(0);
    });

    it("stops previous reporter when called again", () => {
      getMetrics("factory");
      recordEvents("factory", 10, 0);

      startMetricsReporter(1000);
      startMetricsReporter(2000); // Should stop the first one

      // Only the 2000ms interval should be active
      vi.advanceTimersByTime(1000);
      // Should not have reset yet
      expect(getMetrics("factory").eventsProcessed).toBe(10);

      vi.advanceTimersByTime(1000);
      // Now should have reset
      expect(getMetrics("factory").eventsProcessed).toBe(0);
    });
  });

  describe("stopMetricsReporter", () => {
    it("stops the reporter", () => {
      getMetrics("factory");
      recordEvents("factory", 10, 0);

      startMetricsReporter(1000);
      stopMetricsReporter();

      vi.advanceTimersByTime(2000);

      // Should not have reset because reporter was stopped
      expect(getMetrics("factory").eventsProcessed).toBe(10);
    });

    it("is safe to call multiple times", () => {
      expect(() => {
        stopMetricsReporter();
        stopMetricsReporter();
        stopMetricsReporter();
      }).not.toThrow();
    });
  });
});
