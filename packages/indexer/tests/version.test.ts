/**
 * Version Module Tests
 *
 * Tests build metadata retrieval and formatting.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  getBuildInfo,
  getBuildInfoForHealth,
  getBuildSummary,
  isDevelopmentBuild,
  logBuildInfo,
} from "../src/lib/version";

describe("Version Module", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Create a clean copy of process.env
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    // Restore original env
    process.env = originalEnv;
  });

  describe("getBuildInfo", () => {
    it("returns default values when env vars not set", () => {
      process.env["GIT_COMMIT"] = undefined;
      process.env["GIT_BRANCH"] = undefined;
      process.env["BUILD_TIME"] = undefined;

      const info = getBuildInfo();

      expect(info.commit).toBe("unknown");
      expect(info.branch).toBe("unknown");
      expect(info.buildTime).toBeDefined();
      // Runtime can be Bun or Node depending on test runner
      expect(info.runtime).toMatch(/^(Bun|Node)/);
      expect(info.env).toBeDefined();
      expect(info.version).toBeDefined();
    });

    it("reads GIT_COMMIT from environment", () => {
      process.env["GIT_COMMIT"] = "abc123def456";

      const info = getBuildInfo();

      expect(info.commit).toBe("abc123def456");
    });

    it("reads GIT_BRANCH from environment", () => {
      process.env["GIT_BRANCH"] = "main";

      const info = getBuildInfo();

      expect(info.branch).toBe("main");
    });

    it("reads BUILD_TIME from environment", () => {
      process.env["BUILD_TIME"] = "2025-12-28T10:00:00Z";

      const info = getBuildInfo();

      expect(info.buildTime).toBe("2025-12-28T10:00:00Z");
    });

    it("reads NODE_ENV from environment", () => {
      process.env.NODE_ENV = "production";

      const info = getBuildInfo();

      expect(info.env).toBe("production");
    });

    it("reads npm_package_version from environment", () => {
      process.env["npm_package_version"] = "1.2.3";

      const info = getBuildInfo();

      expect(info.version).toBe("1.2.3");
    });

    it("includes runtime version", () => {
      const info = getBuildInfo();

      // Runtime can be Bun or Node depending on test runner
      expect(info.runtime).toMatch(/^(Bun|Node)/);
    });
  });

  describe("getBuildSummary", () => {
    it("returns formatted summary with version and short commit", () => {
      process.env["npm_package_version"] = "1.0.0";
      process.env["GIT_COMMIT"] = "abc123def456789";

      const summary = getBuildSummary();

      expect(summary).toBe("v1.0.0 (abc123d)");
    });

    it("handles unknown commit", () => {
      process.env["GIT_COMMIT"] = undefined;
      process.env["npm_package_version"] = "2.0.0";

      const summary = getBuildSummary();

      expect(summary).toBe("v2.0.0 (unknown)");
    });

    it("handles missing version", () => {
      process.env["npm_package_version"] = undefined;
      process.env["GIT_COMMIT"] = "abc123def";

      const summary = getBuildSummary();

      expect(summary).toBe("v0.0.0 (abc123d)");
    });
  });

  describe("getBuildInfoForHealth", () => {
    it("returns formatted info for health endpoint", () => {
      process.env["npm_package_version"] = "1.0.0";
      process.env["GIT_COMMIT"] = "abc123def456789";
      process.env["GIT_BRANCH"] = "main";
      process.env["BUILD_TIME"] = "2025-12-28T10:00:00Z";

      const info = getBuildInfoForHealth();

      expect(info["version"]).toBe("1.0.0");
      expect(info["commit"]).toBe("abc123d");
      expect(info["branch"]).toBe("main");
      expect(info["buildTime"]).toBe("2025-12-28T10:00:00Z");
      // Runtime can be Bun or Node depending on test runner
      expect(info["runtime"]).toMatch(/^(Bun|Node)/);
    });

    it("truncates commit to 7 characters", () => {
      process.env["GIT_COMMIT"] = "abcdefghijklmnop";

      const info = getBuildInfoForHealth();

      expect(info["commit"]).toBe("abcdefg");
      expect(info["commit"]).toHaveLength(7);
    });

    it("handles short commit gracefully", () => {
      process.env["GIT_COMMIT"] = "abc";

      const info = getBuildInfoForHealth();

      expect(info["commit"]).toBe("abc");
    });
  });

  describe("isDevelopmentBuild", () => {
    it("returns true when commit is unknown", () => {
      process.env["GIT_COMMIT"] = undefined;

      const isDev = isDevelopmentBuild();

      expect(isDev).toBe(true);
    });

    it("returns false when commit is set", () => {
      process.env["GIT_COMMIT"] = "abc123";

      const isDev = isDevelopmentBuild();

      expect(isDev).toBe(false);
    });
  });

  describe("logBuildInfo", () => {
    it("calls logger.info with build information", () => {
      process.env["npm_package_version"] = "1.0.0";
      process.env["GIT_COMMIT"] = "abc123def456789";
      process.env["GIT_BRANCH"] = "main";
      process.env["BUILD_TIME"] = "2025-12-28T10:00:00Z";
      process.env["NODE_ENV"] = "production";

      const mockLogger = {
        info: vi.fn(),
      };

      logBuildInfo(mockLogger);

      expect(mockLogger.info).toHaveBeenCalledTimes(1);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          version: "1.0.0",
          commit: "abc123d",
          branch: "main",
          buildTime: "2025-12-28T10:00:00Z",
          env: "production",
        }),
        "Build information"
      );
    });

    it("includes runtime in log output", () => {
      const mockLogger = {
        info: vi.fn(),
      };

      logBuildInfo(mockLogger);

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          // Runtime can be Bun or Node depending on test runner
          runtime: expect.stringMatching(/^(Bun|Node)/),
        }),
        "Build information"
      );
    });
  });
});

describe("Build Info Complete Flow", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("simulates CI/CD environment", () => {
    // Simulate GitHub Actions environment
    process.env["GIT_COMMIT"] = "614ebdc123456789abcdef";
    process.env["GIT_BRANCH"] = "develop";
    process.env["BUILD_TIME"] = "2025-12-28T12:00:00Z";
    process.env["NODE_ENV"] = "production";
    process.env["npm_package_version"] = "0.1.0";

    const info = getBuildInfo();
    const summary = getBuildSummary();
    const healthInfo = getBuildInfoForHealth();

    expect(info.commit).toBe("614ebdc123456789abcdef");
    expect(info.branch).toBe("develop");
    expect(info.env).toBe("production");
    expect(summary).toBe("v0.1.0 (614ebdc)");
    expect(healthInfo["commit"]).toBe("614ebdc");
    expect(isDevelopmentBuild()).toBe(false);
  });

  it("simulates local development environment", () => {
    // Simulate local development (no CI vars set)
    process.env["GIT_COMMIT"] = undefined;
    process.env["GIT_BRANCH"] = undefined;
    process.env["BUILD_TIME"] = undefined;
    process.env["NODE_ENV"] = "development";

    const info = getBuildInfo();
    const summary = getBuildSummary();

    expect(info.commit).toBe("unknown");
    expect(info.branch).toBe("unknown");
    expect(info.env).toBe("development");
    expect(summary).toContain("unknown");
    expect(isDevelopmentBuild()).toBe(true);
  });
});
