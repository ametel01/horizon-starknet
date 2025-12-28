/**
 * Environment Validation Module Tests
 *
 * Tests environment variable validation, defaults, and helper functions.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  getEnv,
  hasEnv,
  isDatabaseConfigured,
  isDevelopment,
  isDnaTokenConfigured,
  isProduction,
  isTest,
  resetEnvCache,
  validateEnv,
} from "../src/lib/env";

// Mock logger to suppress output during tests
vi.mock("../src/lib/logger", () => ({
  logger: {
    child: () => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      fatal: vi.fn(),
    }),
  },
}));

describe("Environment Validation", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset cache before each test
    resetEnvCache();
    // Create a clean copy of process.env
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    // Restore original env
    process.env = originalEnv;
    resetEnvCache();
  });

  describe("validateEnv", () => {
    it("returns validated environment with defaults", () => {
      const env = validateEnv();

      expect(env.PG_POOL_MAX).toBe(10);
      expect(env.PG_POOL_MIN).toBe(2);
      expect(env.HEALTH_PORT).toBe(8080);
      expect(env.METRICS_INTERVAL_MS).toBe(60000);
      expect(env.LOG_LEVEL).toBe("info");
      // NODE_ENV is "test" when running in vitest
      expect(["development", "test"]).toContain(env.NODE_ENV);
    });

    it("parses numeric environment variables", () => {
      process.env["PG_POOL_MAX"] = "20";
      process.env["PG_POOL_MIN"] = "5";
      process.env["HEALTH_PORT"] = "9090";
      process.env["METRICS_INTERVAL_MS"] = "30000";

      const env = validateEnv();

      expect(env.PG_POOL_MAX).toBe(20);
      expect(env.PG_POOL_MIN).toBe(5);
      expect(env.HEALTH_PORT).toBe(9090);
      expect(env.METRICS_INTERVAL_MS).toBe(30000);
    });

    it("validates string environment variables", () => {
      process.env["POSTGRES_CONNECTION_STRING"] =
        "postgresql://user:pass@localhost:5432/db";
      process.env["DNA_STREAM_URL"] = "https://mainnet.starknet.a5a.ch";
      process.env["DNA_TOKEN"] = "test-token";

      const env = validateEnv();

      expect(env.POSTGRES_CONNECTION_STRING).toBe(
        "postgresql://user:pass@localhost:5432/db",
      );
      expect(env.DNA_STREAM_URL).toBe("https://mainnet.starknet.a5a.ch");
      expect(env.DNA_TOKEN).toBe("test-token");
    });

    it("validates LOG_LEVEL enum values", () => {
      const validLevels = [
        "trace",
        "debug",
        "info",
        "warn",
        "error",
        "fatal",
      ] as const;

      for (const level of validLevels) {
        resetEnvCache();
        process.env["LOG_LEVEL"] = level;
        const env = validateEnv();
        expect(env.LOG_LEVEL).toBe(level);
      }
    });

    it("validates NODE_ENV enum values", () => {
      const validEnvs = ["development", "production", "test"] as const;

      for (const nodeEnv of validEnvs) {
        resetEnvCache();
        process.env.NODE_ENV = nodeEnv;
        const env = validateEnv();
        expect(env.NODE_ENV).toBe(nodeEnv);
      }
    });

    it("caches validation result", () => {
      const env1 = validateEnv();
      process.env["PG_POOL_MAX"] = "999";
      const env2 = validateEnv();

      // Should return cached result, not re-parse
      expect(env1).toBe(env2);
      expect(env2.PG_POOL_MAX).toBe(10); // Original default
    });

    it("resets cache correctly", () => {
      const env1 = validateEnv();
      expect(env1.PG_POOL_MAX).toBe(10);

      resetEnvCache();
      process.env["PG_POOL_MAX"] = "25";

      const env2 = validateEnv();
      expect(env2.PG_POOL_MAX).toBe(25);
    });
  });

  describe("getEnv", () => {
    it("returns validated environment", () => {
      const env = getEnv();

      expect(env).toBeDefined();
      expect(env.PG_POOL_MAX).toBe(10);
    });

    it("returns same cached result as validateEnv", () => {
      const env1 = validateEnv();
      const env2 = getEnv();

      expect(env1).toBe(env2);
    });
  });

  describe("hasEnv", () => {
    it("returns false for unset optional variables", () => {
      expect(hasEnv("POSTGRES_CONNECTION_STRING")).toBe(false);
      expect(hasEnv("DNA_TOKEN")).toBe(false);
      expect(hasEnv("DNA_STREAM_URL")).toBe(false);
    });

    it("returns true for set variables", () => {
      process.env["POSTGRES_CONNECTION_STRING"] =
        "postgresql://localhost:5432/db";
      process.env["DNA_TOKEN"] = "token";

      expect(hasEnv("POSTGRES_CONNECTION_STRING")).toBe(true);
      expect(hasEnv("DNA_TOKEN")).toBe(true);
    });

    it("returns true for variables with defaults", () => {
      expect(hasEnv("PG_POOL_MAX")).toBe(true);
      expect(hasEnv("HEALTH_PORT")).toBe(true);
      expect(hasEnv("LOG_LEVEL")).toBe(true);
    });
  });

  describe("isDatabaseConfigured", () => {
    it("returns false when connection string is not set", () => {
      expect(isDatabaseConfigured()).toBe(false);
    });

    it("returns true when connection string is set", () => {
      process.env["POSTGRES_CONNECTION_STRING"] =
        "postgresql://localhost:5432/db";

      expect(isDatabaseConfigured()).toBe(true);
    });
  });

  describe("isDnaTokenConfigured", () => {
    it("returns false when token is not set", () => {
      expect(isDnaTokenConfigured()).toBe(false);
    });

    it("returns true when token is set", () => {
      process.env["DNA_TOKEN"] = "test-token";

      expect(isDnaTokenConfigured()).toBe(true);
    });
  });

  describe("isProduction", () => {
    it("returns false in development", () => {
      process.env.NODE_ENV = "development";

      expect(isProduction()).toBe(false);
    });

    it("returns true in production", () => {
      process.env.NODE_ENV = "production";

      expect(isProduction()).toBe(true);
    });

    it("returns false in test", () => {
      process.env.NODE_ENV = "test";

      expect(isProduction()).toBe(false);
    });
  });

  describe("isDevelopment", () => {
    it("returns true in development", () => {
      process.env.NODE_ENV = "development";

      expect(isDevelopment()).toBe(true);
    });

    it("returns false in production", () => {
      process.env.NODE_ENV = "production";

      expect(isDevelopment()).toBe(false);
    });

    it("returns false in test", () => {
      process.env.NODE_ENV = "test";

      expect(isDevelopment()).toBe(false);
    });
  });

  describe("isTest", () => {
    it("returns false in development", () => {
      process.env.NODE_ENV = "development";

      expect(isTest()).toBe(false);
    });

    it("returns false in production", () => {
      process.env.NODE_ENV = "production";

      expect(isTest()).toBe(false);
    });

    it("returns true in test", () => {
      process.env.NODE_ENV = "test";

      expect(isTest()).toBe(true);
    });
  });
});

describe("Environment Validation Constraints", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    resetEnvCache();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    resetEnvCache();
  });

  describe("PG_POOL_MAX constraints", () => {
    it("accepts valid values between 1 and 100", () => {
      process.env["PG_POOL_MAX"] = "50";

      const env = validateEnv();

      expect(env.PG_POOL_MAX).toBe(50);
    });

    it("accepts minimum value of 1", () => {
      process.env["PG_POOL_MAX"] = "1";

      const env = validateEnv();

      expect(env.PG_POOL_MAX).toBe(1);
    });

    it("accepts maximum value of 100", () => {
      process.env["PG_POOL_MAX"] = "100";

      const env = validateEnv();

      expect(env.PG_POOL_MAX).toBe(100);
    });
  });

  describe("PG_POOL_MIN constraints", () => {
    it("accepts valid values between 0 and 50", () => {
      process.env["PG_POOL_MIN"] = "5";

      const env = validateEnv();

      expect(env.PG_POOL_MIN).toBe(5);
    });

    it("accepts minimum value of 0", () => {
      process.env["PG_POOL_MIN"] = "0";

      const env = validateEnv();

      expect(env.PG_POOL_MIN).toBe(0);
    });
  });

  describe("HEALTH_PORT constraints", () => {
    it("accepts valid port values", () => {
      process.env["HEALTH_PORT"] = "3000";

      const env = validateEnv();

      expect(env.HEALTH_PORT).toBe(3000);
    });

    it("accepts minimum port 1024", () => {
      process.env["HEALTH_PORT"] = "1024";

      const env = validateEnv();

      expect(env.HEALTH_PORT).toBe(1024);
    });

    it("accepts maximum port 65535", () => {
      process.env["HEALTH_PORT"] = "65535";

      const env = validateEnv();

      expect(env.HEALTH_PORT).toBe(65535);
    });
  });

  describe("METRICS_INTERVAL_MS constraints", () => {
    it("accepts valid interval values", () => {
      process.env["METRICS_INTERVAL_MS"] = "5000";

      const env = validateEnv();

      expect(env.METRICS_INTERVAL_MS).toBe(5000);
    });

    it("accepts minimum value of 1000", () => {
      process.env["METRICS_INTERVAL_MS"] = "1000";

      const env = validateEnv();

      expect(env.METRICS_INTERVAL_MS).toBe(1000);
    });
  });
});

describe("Environment Type Coercion", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    resetEnvCache();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    resetEnvCache();
  });

  it("coerces string numbers to integers", () => {
    process.env["PG_POOL_MAX"] = "15";
    process.env["PG_POOL_MIN"] = "3";
    process.env["HEALTH_PORT"] = "9000";

    const env = validateEnv();

    expect(typeof env.PG_POOL_MAX).toBe("number");
    expect(typeof env.PG_POOL_MIN).toBe("number");
    expect(typeof env.HEALTH_PORT).toBe("number");
  });

  it("handles undefined optional values", () => {
    const env = validateEnv();

    expect(env.POSTGRES_CONNECTION_STRING).toBeUndefined();
    expect(env.DNA_TOKEN).toBeUndefined();
    expect(env.DNA_STREAM_URL).toBeUndefined();
  });
});
