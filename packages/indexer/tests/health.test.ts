/**
 * Health Module Tests
 *
 * Tests the health check functionality.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getHealthStatus, isReady, type HealthConfig } from "../src/lib/health";
import {
  getAllMetrics,
  getMetrics,
  recordBlock,
  recordEvents,
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

describe("Health Module", () => {
  beforeEach(() => {
    resetMetrics();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ============================================================
  // GET HEALTH STATUS TESTS
  // ============================================================

  describe("getHealthStatus", () => {
    it("returns unhealthy when no indexers registered", () => {
      const status = getHealthStatus();

      expect(status.status).toBe("unhealthy");
      expect(Object.keys(status.indexers)).toHaveLength(0);
    });

    it("returns healthy for active indexer within thresholds", () => {
      const now = Date.now();
      vi.setSystemTime(now);

      // Create indexer with recent activity
      const metrics = getMetrics("factory");
      metrics.lastBlockNumber = 100;
      metrics.lastBlockTimestamp = now; // Just now
      metrics.totalEventsProcessed = 100;
      metrics.totalEventsFailed = 0; // 0% error rate

      const status = getHealthStatus();

      expect(status.status).toBe("healthy");
      expect(status.indexers["factory"]).toBeDefined();
      expect(status.indexers["factory"]?.status).toBe("healthy");
    });

    it("returns degraded when lag exceeds threshold", () => {
      const now = Date.now();
      vi.setSystemTime(now);

      const metrics = getMetrics("factory");
      metrics.lastBlockNumber = 100;
      metrics.lastBlockTimestamp = now - 400000; // 400 seconds ago (> 300s threshold)
      metrics.totalEventsProcessed = 100;
      metrics.totalEventsFailed = 0;

      const status = getHealthStatus();

      expect(status.status).toBe("degraded");
      expect(status.indexers["factory"]?.status).toBe("degraded");
    });

    it("returns degraded when error rate exceeds threshold", () => {
      const now = Date.now();
      vi.setSystemTime(now);

      const metrics = getMetrics("factory");
      metrics.lastBlockNumber = 100;
      metrics.lastBlockTimestamp = now;
      metrics.totalEventsProcessed = 80;
      metrics.totalEventsFailed = 20; // 20% error rate (> 10% threshold)

      const status = getHealthStatus();

      expect(status.status).toBe("degraded");
      expect(status.indexers["factory"]?.status).toBe("degraded");
    });

    it("returns inactive when never processed", () => {
      getMetrics("factory"); // Create but don't process anything

      const status = getHealthStatus();

      expect(status.status).toBe("unhealthy");
      expect(status.indexers["factory"]?.status).toBe("inactive");
    });

    it("returns inactive when very stale", () => {
      const now = Date.now();
      vi.setSystemTime(now);

      const metrics = getMetrics("factory");
      metrics.lastBlockNumber = 100;
      metrics.lastBlockTimestamp = now - 700000; // 700 seconds ago (> 600s inactive threshold)

      const status = getHealthStatus();

      expect(status.indexers["factory"]?.status).toBe("inactive");
    });

    it("calculates lag seconds correctly", () => {
      const now = Date.now();
      vi.setSystemTime(now);

      const metrics = getMetrics("factory");
      metrics.lastBlockNumber = 100;
      metrics.lastBlockTimestamp = now - 120000; // 120 seconds ago

      const status = getHealthStatus();

      expect(status.indexers["factory"]?.lagSeconds).toBe(120);
    });

    it("calculates error rate correctly", () => {
      const now = Date.now();
      vi.setSystemTime(now);

      const metrics = getMetrics("factory");
      metrics.lastBlockNumber = 100;
      metrics.lastBlockTimestamp = now;
      metrics.totalEventsProcessed = 90;
      metrics.totalEventsFailed = 10; // 10% error rate

      const status = getHealthStatus();

      expect(status.indexers["factory"]?.errorRate).toBe(0.1);
    });

    it("includes timestamp in response", () => {
      const status = getHealthStatus();

      expect(status.timestamp).toBeDefined();
      expect(() => new Date(status.timestamp)).not.toThrow();
    });

    it("respects custom health config", () => {
      const now = Date.now();
      vi.setSystemTime(now);

      const metrics = getMetrics("factory");
      metrics.lastBlockNumber = 100;
      metrics.lastBlockTimestamp = now - 200000; // 200 seconds ago

      const customConfig: HealthConfig = {
        maxLagSeconds: 100, // Stricter threshold
        maxErrorRate: 0.05,
        inactiveThresholdSeconds: 300,
      };

      const status = getHealthStatus(customConfig);

      // Should be degraded because 200s > 100s custom threshold
      expect(status.indexers["factory"]?.status).toBe("degraded");
    });

    it("handles multiple indexers with different states", () => {
      const now = Date.now();
      vi.setSystemTime(now);

      // Healthy indexer
      const factoryMetrics = getMetrics("factory");
      factoryMetrics.lastBlockNumber = 100;
      factoryMetrics.lastBlockTimestamp = now;
      factoryMetrics.totalEventsProcessed = 100;
      factoryMetrics.totalEventsFailed = 0;

      // Degraded indexer (high error rate)
      const routerMetrics = getMetrics("router");
      routerMetrics.lastBlockNumber = 100;
      routerMetrics.lastBlockTimestamp = now;
      routerMetrics.totalEventsProcessed = 50;
      routerMetrics.totalEventsFailed = 50; // 50% error rate

      // Inactive indexer
      getMetrics("market"); // Never processed

      const status = getHealthStatus();

      expect(status.status).toBe("degraded"); // Overall degraded
      expect(status.indexers["factory"]?.status).toBe("healthy");
      expect(status.indexers["router"]?.status).toBe("degraded");
      expect(status.indexers["market"]?.status).toBe("inactive");
    });

    it("returns healthy if some are healthy and rest inactive", () => {
      const now = Date.now();
      vi.setSystemTime(now);

      // Healthy indexer
      const factoryMetrics = getMetrics("factory");
      factoryMetrics.lastBlockNumber = 100;
      factoryMetrics.lastBlockTimestamp = now;
      factoryMetrics.totalEventsProcessed = 100;
      factoryMetrics.totalEventsFailed = 0;

      // Inactive indexer
      getMetrics("market");

      const status = getHealthStatus();

      // Overall healthy because at least one is healthy
      expect(status.status).toBe("healthy");
    });
  });

  // ============================================================
  // IS READY TESTS
  // ============================================================

  describe("isReady", () => {
    it("returns false when no indexers registered", () => {
      expect(isReady()).toBe(false);
    });

    it("returns false when no blocks processed", () => {
      getMetrics("factory"); // Create but don't process

      expect(isReady()).toBe(false);
    });

    it("returns true when at least one indexer has processed a block", () => {
      const metrics = getMetrics("factory");
      metrics.lastBlockNumber = 1;

      expect(isReady()).toBe(true);
    });

    it("returns true if any indexer is ready", () => {
      getMetrics("factory"); // Not ready

      const routerMetrics = getMetrics("router");
      routerMetrics.lastBlockNumber = 100; // Ready

      expect(isReady()).toBe(true);
    });
  });

  // ============================================================
  // INTEGRATION WITH METRICS TESTS
  // ============================================================

  describe("Integration with Metrics", () => {
    it("reflects recordBlock in health status", () => {
      const now = Date.now();
      vi.setSystemTime(now);

      recordBlock("factory", 100);

      const status = getHealthStatus();
      expect(status.indexers["factory"]?.lastBlock).toBe(100);
      expect(status.indexers["factory"]?.lagSeconds).toBe(0);
    });

    it("reflects recordEvents in health status", () => {
      const now = Date.now();
      vi.setSystemTime(now);

      recordBlock("factory", 100); // Need this for active status
      recordEvents("factory", 90, 10);

      const status = getHealthStatus();
      expect(status.indexers["factory"]?.errorRate).toBe(0.1);
    });

    it("tracks health over time", () => {
      const startTime = Date.now();
      vi.setSystemTime(startTime);

      recordBlock("factory", 100);
      recordEvents("factory", 100, 0);

      let status = getHealthStatus();
      expect(status.status).toBe("healthy");

      // Advance time past lag threshold
      vi.setSystemTime(startTime + 400000);

      status = getHealthStatus();
      expect(status.status).toBe("degraded");
      expect(status.indexers["factory"]?.lagSeconds).toBe(400);
    });
  });
});
