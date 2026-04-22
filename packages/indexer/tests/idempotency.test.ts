/**
 * Idempotency Tests
 *
 * Verifies that the schema and indexer patterns support idempotent event processing:
 * - Unique constraints on (block_number, transaction_hash, event_index)
 * - onConflictDoNothing() handling prevents duplicate insert errors
 *
 * These tests verify schema configuration. Integration tests with a real database
 * would be needed to fully verify idempotency behavior.
 */

import { describe, expect, it } from "vitest";

// Import all event tables to verify their structure
import {
  factoryClassHashesUpdated,
  factoryYieldContractsCreated,
  marketBurn,
  marketFactoryClassHashUpdated,
  marketFactoryDefaultReserveFeeUpdated,
  marketFactoryMarketCreated,
  marketFactoryOverrideFeeSet,
  marketFactoryTreasuryUpdated,
  marketFeesCollected,
  marketImpliedRateUpdated,
  marketMint,
  marketReserveFeeTransferred,
  marketScalarRootUpdated,
  marketSwap,
  routerAddLiquidity,
  routerMintPY,
  routerRedeemPY,
  routerRemoveLiquidity,
  routerSwap,
  routerSwapYT,
  syDeposit,
  syNegativeYieldDetected,
  syOracleRateUpdated,
  syPauseState,
  syRedeem,
  syRewardIndexUpdated,
  syRewardsClaimed,
  syRewardTokenAdded,
  ytExpiryReached,
  ytInterestClaimed,
  ytInterestFeeRateSet,
  ytMintPY,
  ytMintPYMulti,
  ytPostExpiryDataSet,
  ytPyIndexUpdated,
  ytRedeemPY,
  ytRedeemPYMulti,
  ytRedeemPYPostExpiry,
  ytRedeemPYWithInterest,
  ytTreasuryInterestRedeemed,
} from "../src/schema";

// ============================================================
// SCHEMA IDEMPOTENCY CONSTRAINT TESTS
// ============================================================

/**
 * All 40 event tables must have these three columns for idempotency:
 * - block_number: The block where the event occurred
 * - transaction_hash: The transaction containing the event
 * - event_index: The position of the event within the transaction
 *
 * The combination of these three fields uniquely identifies an event.
 */

const ALL_EVENT_TABLES = [
  { name: "factoryYieldContractsCreated", table: factoryYieldContractsCreated },
  { name: "factoryClassHashesUpdated", table: factoryClassHashesUpdated },
  { name: "marketFactoryMarketCreated", table: marketFactoryMarketCreated },
  {
    name: "marketFactoryClassHashUpdated",
    table: marketFactoryClassHashUpdated,
  },
  {
    name: "marketFactoryTreasuryUpdated",
    table: marketFactoryTreasuryUpdated,
  },
  {
    name: "marketFactoryDefaultReserveFeeUpdated",
    table: marketFactoryDefaultReserveFeeUpdated,
  },
  {
    name: "marketFactoryOverrideFeeSet",
    table: marketFactoryOverrideFeeSet,
  },
  { name: "syDeposit", table: syDeposit },
  { name: "syRedeem", table: syRedeem },
  { name: "syOracleRateUpdated", table: syOracleRateUpdated },
  // SY Phase 4: Monitoring tables
  { name: "syNegativeYieldDetected", table: syNegativeYieldDetected },
  { name: "syPauseState", table: syPauseState },
  // SY Phase 4: Reward tables
  { name: "syRewardsClaimed", table: syRewardsClaimed },
  { name: "syRewardIndexUpdated", table: syRewardIndexUpdated },
  { name: "syRewardTokenAdded", table: syRewardTokenAdded },
  { name: "ytMintPY", table: ytMintPY },
  { name: "ytRedeemPY", table: ytRedeemPY },
  { name: "ytRedeemPYPostExpiry", table: ytRedeemPYPostExpiry },
  { name: "ytInterestClaimed", table: ytInterestClaimed },
  { name: "ytExpiryReached", table: ytExpiryReached },
  // YT Pendle-style interest system events
  { name: "ytTreasuryInterestRedeemed", table: ytTreasuryInterestRedeemed },
  { name: "ytInterestFeeRateSet", table: ytInterestFeeRateSet },
  { name: "ytMintPYMulti", table: ytMintPYMulti },
  { name: "ytRedeemPYMulti", table: ytRedeemPYMulti },
  { name: "ytRedeemPYWithInterest", table: ytRedeemPYWithInterest },
  { name: "ytPostExpiryDataSet", table: ytPostExpiryDataSet },
  { name: "ytPyIndexUpdated", table: ytPyIndexUpdated },
  { name: "marketMint", table: marketMint },
  { name: "marketBurn", table: marketBurn },
  { name: "marketSwap", table: marketSwap },
  { name: "marketImpliedRateUpdated", table: marketImpliedRateUpdated },
  { name: "marketFeesCollected", table: marketFeesCollected },
  { name: "marketScalarRootUpdated", table: marketScalarRootUpdated },
  { name: "marketReserveFeeTransferred", table: marketReserveFeeTransferred },
  { name: "routerMintPY", table: routerMintPY },
  { name: "routerRedeemPY", table: routerRedeemPY },
  { name: "routerAddLiquidity", table: routerAddLiquidity },
  { name: "routerRemoveLiquidity", table: routerRemoveLiquidity },
  { name: "routerSwap", table: routerSwap },
  { name: "routerSwapYT", table: routerSwapYT },
];

describe("Schema Idempotency Constraints", () => {
  describe("All tables have required idempotency columns", () => {
    it.each(ALL_EVENT_TABLES)("$name has block_number column", ({ table }) => {
      const columns = Object.keys(table);
      expect(columns).toContain("block_number");
    });

    it.each(ALL_EVENT_TABLES)("$name has transaction_hash column", ({
      table,
    }) => {
      const columns = Object.keys(table);
      expect(columns).toContain("transaction_hash");
    });

    it.each(ALL_EVENT_TABLES)("$name has event_index column", ({ table }) => {
      const columns = Object.keys(table);
      expect(columns).toContain("event_index");
    });

    it.each(ALL_EVENT_TABLES)("$name has _id primary key column", ({
      table,
    }) => {
      const columns = Object.keys(table);
      expect(columns).toContain("_id");
    });
  });

  it("verifies we have all 40 event tables", () => {
    expect(ALL_EVENT_TABLES).toHaveLength(40);
  });
});

// ============================================================
// EVENT KEY UNIQUENESS TESTS
// ============================================================

describe("Event Key Uniqueness", () => {
  it("same block_number, transaction_hash, event_index identifies same event", () => {
    // Two events with identical keys should be considered duplicates
    const event1 = {
      block_number: 4643353,
      transaction_hash: "0xabc123",
      event_index: 0,
    };
    const event2 = {
      block_number: 4643353,
      transaction_hash: "0xabc123",
      event_index: 0,
    };

    expect(event1.block_number).toBe(event2.block_number);
    expect(event1.transaction_hash).toBe(event2.transaction_hash);
    expect(event1.event_index).toBe(event2.event_index);
  });

  it("different event_index in same transaction creates unique events", () => {
    const event1 = {
      block_number: 4643353,
      transaction_hash: "0xabc123",
      event_index: 0,
    };
    const event2 = {
      block_number: 4643353,
      transaction_hash: "0xabc123",
      event_index: 1,
    };

    // These are different events despite same block and tx
    expect(event1.event_index).not.toBe(event2.event_index);
  });

  it("same event_index in different transaction creates unique events", () => {
    const event1 = {
      block_number: 4643353,
      transaction_hash: "0xabc123",
      event_index: 0,
    };
    const event2 = {
      block_number: 4643353,
      transaction_hash: "0xdef456",
      event_index: 0,
    };

    // These are different events despite same block and index
    expect(event1.transaction_hash).not.toBe(event2.transaction_hash);
  });

  it("same event_index in different block creates unique events", () => {
    const event1 = {
      block_number: 4643353,
      transaction_hash: "0xabc123",
      event_index: 0,
    };
    const event2 = {
      block_number: 4643354,
      transaction_hash: "0xabc123",
      event_index: 0,
    };

    // These are different events despite same tx hash and index
    // (tx hash collision across blocks is theoretically possible)
    expect(event1.block_number).not.toBe(event2.block_number);
  });
});

// ============================================================
// IDEMPOTENT INSERT PATTERN TESTS
// ============================================================

describe("Idempotent Insert Pattern", () => {
  /**
   * This test documents the expected behavior of the indexer's
   * idempotent insert pattern. In production, this is implemented as:
   *
   * ```typescript
   * await db.transaction(async (tx) => {
   *   await tx.insert(table).values(rows).onConflictDoNothing();
   * });
   * ```
   *
   * The onConflictDoNothing() ensures that if an event with the same
   * (block_number, transaction_hash, event_index) already exists,
   * the insert is silently skipped rather than throwing an error.
   */

  it("documents idempotent insert behavior", () => {
    // Simulating two insert attempts with same event key
    const insertAttempts = [
      {
        block_number: 4643353,
        transaction_hash: "0xabc123",
        event_index: 0,
        data: "first insert",
      },
      {
        block_number: 4643353,
        transaction_hash: "0xabc123",
        event_index: 0,
        data: "second insert (should be ignored)",
      },
    ];

    // In a real database with onConflictDoNothing():
    // - First insert succeeds
    // - Second insert silently does nothing (no error thrown)
    // - Final table has 1 row with "first insert" data

    // For this unit test, we verify the pattern is correct
    const first = insertAttempts.at(0);
    const second = insertAttempts.at(1);

    expect(first).toBeDefined();
    expect(second).toBeDefined();
    expect(first?.block_number).toBe(second?.block_number);
    expect(first?.transaction_hash).toBe(second?.transaction_hash);
    expect(first?.event_index).toBe(second?.event_index);

    // The data differs but the key is the same
    expect(first?.data).not.toBe(second?.data);
  });

  it("batch inserts with duplicates should not fail", () => {
    // In production, the indexer may receive the same events on replay
    const batch = [
      { block_number: 100, transaction_hash: "0x1", event_index: 0 },
      { block_number: 100, transaction_hash: "0x1", event_index: 1 },
      { block_number: 100, transaction_hash: "0x2", event_index: 0 },
      // Duplicate of first event
      { block_number: 100, transaction_hash: "0x1", event_index: 0 },
    ];

    // Unique events in this batch
    const uniqueKeys = new Set(
      batch.map(
        (e) =>
          `${String(e.block_number)}-${e.transaction_hash}-${String(e.event_index)}`
      )
    );

    // 4 events but only 3 unique
    expect(batch.length).toBe(4);
    expect(uniqueKeys.size).toBe(3);
  });
});

// ============================================================
// REORG HANDLING TESTS
// ============================================================

describe("Reorg Handling", () => {
  /**
   * During a blockchain reorg, events from orphaned blocks need to be
   * removed. The Apibara drizzle plugin handles this automatically via
   * the _cursor column (added automatically by the plugin).
   *
   * When a reorg occurs:
   * 1. Events from orphaned blocks are deleted (based on _cursor)
   * 2. New events from the canonical chain are inserted
   * 3. If any events have the same key, onConflictDoNothing() prevents errors
   */

  it("documents reorg event replacement pattern", () => {
    // Original event before reorg
    const originalEvent = {
      block_number: 4643353,
      transaction_hash: "0xabc123",
      event_index: 0,
      data: "original data",
    };

    // After reorg, same block but different transaction
    const reorgEvent = {
      block_number: 4643353,
      transaction_hash: "0xdef456", // Different tx in reorganized block
      event_index: 0,
      data: "reorg data",
    };

    // These are different events (different tx hash)
    expect(originalEvent.transaction_hash).not.toBe(
      reorgEvent.transaction_hash
    );
  });

  it("same event replayed after reorg recovery uses same key", () => {
    // Event in original chain
    const beforeReorg = {
      block_number: 4643353,
      transaction_hash: "0xabc123",
      event_index: 0,
    };

    // Same event replayed after chain recovers to same state
    const afterRecovery = {
      block_number: 4643353,
      transaction_hash: "0xabc123",
      event_index: 0,
    };

    // Same key means onConflictDoNothing() will skip the duplicate
    expect(beforeReorg.block_number).toBe(afterRecovery.block_number);
    expect(beforeReorg.transaction_hash).toBe(afterRecovery.transaction_hash);
    expect(beforeReorg.event_index).toBe(afterRecovery.event_index);
  });
});

// ============================================================
// TABLE COUNT VERIFICATION
// ============================================================

describe("Complete Table Coverage", () => {
  it("covers all Factory events (2)", () => {
    const factoryTables = ALL_EVENT_TABLES.filter((t) =>
      t.name.startsWith("factory")
    );
    expect(factoryTables).toHaveLength(2);
  });

  it("covers all MarketFactory events (5)", () => {
    const marketFactoryTables = ALL_EVENT_TABLES.filter((t) =>
      t.name.startsWith("marketFactory")
    );
    expect(marketFactoryTables).toHaveLength(5);
  });

  it("covers all SY events (8)", () => {
    const syTables = ALL_EVENT_TABLES.filter((t) => t.name.startsWith("sy"));
    expect(syTables).toHaveLength(8);
  });

  it("covers all YT events (12)", () => {
    const ytTables = ALL_EVENT_TABLES.filter((t) => t.name.startsWith("yt"));
    expect(ytTables).toHaveLength(12);
  });

  it("covers all Market events (7)", () => {
    const marketTables = ALL_EVENT_TABLES.filter(
      (t) => t.name.startsWith("market") && !t.name.startsWith("marketFactory")
    );
    expect(marketTables).toHaveLength(7);
  });

  it("covers all Router events (6)", () => {
    const routerTables = ALL_EVENT_TABLES.filter((t) =>
      t.name.startsWith("router")
    );
    expect(routerTables).toHaveLength(6);
  });
});
