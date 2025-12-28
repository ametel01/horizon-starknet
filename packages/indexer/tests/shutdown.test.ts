/**
 * Shutdown Module Tests
 *
 * Tests graceful shutdown handling, cleanup registration, and execution order.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  clearCleanups,
  getCleanupCount,
  isShutdownInProgress,
  registerCleanup,
  resetShutdownState,
  unregisterCleanup,
} from "../src/lib/shutdown";

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

describe("Shutdown Module", () => {
  beforeEach(() => {
    // Reset state before each test
    clearCleanups();
    resetShutdownState();
  });

  afterEach(() => {
    // Ensure clean state after each test
    clearCleanups();
    resetShutdownState();
  });

  describe("registerCleanup", () => {
    it("registers a cleanup function", () => {
      expect(getCleanupCount()).toBe(0);

      registerCleanup("test-cleanup", () => Promise.resolve());

      expect(getCleanupCount()).toBe(1);
    });

    it("allows multiple registrations", () => {
      registerCleanup("cleanup-1", () => Promise.resolve());
      registerCleanup("cleanup-2", () => Promise.resolve());
      registerCleanup("cleanup-3", () => Promise.resolve());

      expect(getCleanupCount()).toBe(3);
    });

    it("allows registrations with same name", () => {
      // This is intentional - same name can be registered multiple times
      // Use unregisterCleanup to remove specific cleanups
      registerCleanup("same-name", () => Promise.resolve());
      registerCleanup("same-name", () => Promise.resolve());

      expect(getCleanupCount()).toBe(2);
    });
  });

  describe("unregisterCleanup", () => {
    it("removes a registered cleanup by name", () => {
      registerCleanup("to-remove", () => Promise.resolve());
      registerCleanup("to-keep", () => Promise.resolve());

      expect(getCleanupCount()).toBe(2);

      const removed = unregisterCleanup("to-remove");

      expect(removed).toBe(true);
      expect(getCleanupCount()).toBe(1);
    });

    it("returns false for non-existent cleanup", () => {
      registerCleanup("exists", () => Promise.resolve());

      const removed = unregisterCleanup("does-not-exist");

      expect(removed).toBe(false);
      expect(getCleanupCount()).toBe(1);
    });

    it("only removes first matching cleanup", () => {
      registerCleanup("duplicate", () => Promise.resolve());
      registerCleanup("duplicate", () => Promise.resolve());

      expect(getCleanupCount()).toBe(2);

      unregisterCleanup("duplicate");

      expect(getCleanupCount()).toBe(1);
    });
  });

  describe("getCleanupCount", () => {
    it("returns 0 when no cleanups registered", () => {
      expect(getCleanupCount()).toBe(0);
    });

    it("returns correct count after registrations", () => {
      registerCleanup("a", () => Promise.resolve());
      expect(getCleanupCount()).toBe(1);

      registerCleanup("b", () => Promise.resolve());
      expect(getCleanupCount()).toBe(2);

      unregisterCleanup("a");
      expect(getCleanupCount()).toBe(1);
    });
  });

  describe("clearCleanups", () => {
    it("removes all registered cleanups", () => {
      registerCleanup("a", () => Promise.resolve());
      registerCleanup("b", () => Promise.resolve());
      registerCleanup("c", () => Promise.resolve());

      expect(getCleanupCount()).toBe(3);

      clearCleanups();

      expect(getCleanupCount()).toBe(0);
    });
  });

  describe("isShutdownInProgress", () => {
    it("returns false initially", () => {
      expect(isShutdownInProgress()).toBe(false);
    });

    it("returns false after reset", () => {
      resetShutdownState();
      expect(isShutdownInProgress()).toBe(false);
    });
  });

  describe("resetShutdownState", () => {
    it("resets shutdown state to not in progress", () => {
      // We can't easily trigger shutdown in tests, so just verify reset works
      resetShutdownState();
      expect(isShutdownInProgress()).toBe(false);
    });
  });
});

describe("Cleanup Execution Order", () => {
  beforeEach(() => {
    clearCleanups();
    resetShutdownState();
  });

  afterEach(() => {
    clearCleanups();
    resetShutdownState();
  });

  it("documents LIFO execution order", () => {
    // This test documents the expected behavior:
    // Cleanups are executed in reverse order (Last-In-First-Out)
    // So if we register: A, B, C
    // They execute in order: C, B, A
    // This ensures dependencies are cleaned up after their dependents

    registerCleanup("first-registered", () => Promise.resolve());
    registerCleanup("second-registered", () => Promise.resolve());
    registerCleanup("third-registered", () => Promise.resolve());

    // We can't easily trigger the actual shutdown, but we verify registration
    expect(getCleanupCount()).toBe(3);

    // The expected execution order would be: third, second, first (LIFO)
    // This is documented in the module implementation
  });
});

describe("Cleanup Function Types", () => {
  beforeEach(() => {
    clearCleanups();
    resetShutdownState();
  });

  afterEach(() => {
    clearCleanups();
    resetShutdownState();
  });

  it("accepts async cleanup functions", () => {
    registerCleanup("async-cleanup", async () => {
      await new Promise((resolve) => setTimeout(resolve, 1));
    });

    expect(getCleanupCount()).toBe(1);
  });

  it("accepts cleanup functions that return immediately", () => {
    registerCleanup("immediate-cleanup", () => Promise.resolve());

    expect(getCleanupCount()).toBe(1);
  });

  it("accepts cleanup functions with complex logic", () => {
    const state = { closed: false };

    registerCleanup("complex-cleanup", async () => {
      state.closed = true;
      await Promise.resolve();
    });

    expect(getCleanupCount()).toBe(1);
    expect(state.closed).toBe(false); // Not executed yet
  });
});

describe("Database Pool Cleanup Integration", () => {
  beforeEach(() => {
    clearCleanups();
    resetShutdownState();
  });

  afterEach(() => {
    clearCleanups();
    resetShutdownState();
  });

  it("documents database pool cleanup pattern", () => {
    // This documents the expected usage pattern from database.ts
    const poolClosed = { value: false };

    registerCleanup("database-pool", async () => {
      // In real usage, this would call pool.end()
      poolClosed.value = true;
      await Promise.resolve();
    });

    expect(getCleanupCount()).toBe(1);

    // In production, when SIGTERM is received:
    // 1. setupGracefulShutdown() catches the signal
    // 2. performShutdown() executes all cleanups in LIFO order
    // 3. The database-pool cleanup calls pool.end()
    // 4. Process exits cleanly
  });

  it("documents multiple resource cleanup pattern", () => {
    // When multiple resources need cleanup, register them in dependency order
    // Resources registered first will be cleaned up last

    registerCleanup("http-server", () => Promise.resolve());
    registerCleanup("database-pool", () => Promise.resolve());

    expect(getCleanupCount()).toBe(2);

    // Execution order will be:
    // 1. database-pool (last registered, cleaned first - LIFO)
    // 2. http-server (first registered, cleaned last)
    //
    // For proper cleanup, we should register in reverse dependency order:
    // - Register database-pool first (will be cleaned last)
    // - Register http-server last (will be cleaned first)
    //
    // This way, http-server stops accepting connections first,
    // then database-pool closes after all in-flight requests complete.
  });
});
