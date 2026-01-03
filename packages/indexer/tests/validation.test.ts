/**
 * Validation Module Tests
 *
 * Tests Zod schemas for all 24 event types and the validateEvent helper.
 */

import { describe, expect, it, vi } from "vitest";

import {
  baseEventSchema,
  factoryClassHashesUpdatedSchema,
  factoryYieldContractsCreatedSchema,
  marketBurnSchema,
  marketFactoryMarketCreatedSchema,
  marketFeesCollectedSchema,
  marketImpliedRateUpdatedSchema,
  marketMintSchema,
  marketScalarRootUpdatedSchema,
  marketSwapSchema,
  routerAddLiquiditySchema,
  routerMintPYSchema,
  routerRedeemPYSchema,
  routerRemoveLiquiditySchema,
  routerSwapSchema,
  routerSwapYTSchema,
  syDepositSchema,
  syOracleRateUpdatedSchema,
  syRedeemSchema,
  validateEvent,
  ytExpiryReachedSchema,
  ytInterestClaimedSchema,
  ytMintPYSchema,
  ytRedeemPYPostExpirySchema,
  ytRedeemPYSchema,
} from "../src/lib/validation";

// Mock logger to suppress output during tests
vi.mock("../src/lib/logger", () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

// ============================================================
// BASE EVENT SCHEMA TESTS
// ============================================================

describe("baseEventSchema", () => {
  it("validates a valid base event", () => {
    const event = {
      address: "0x123abc",
      keys: ["0xselector"],
      data: ["0x1", "0x2"],
      transactionHash: "0xabc123",
    };

    const result = baseEventSchema.safeParse(event);
    expect(result.success).toBe(true);
  });

  it("validates event with optional eventIndex", () => {
    const event = {
      address: "0x123abc",
      keys: ["0xselector"],
      data: [],
      transactionHash: "0xabc123",
      eventIndex: 5,
    };

    const result = baseEventSchema.safeParse(event);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.eventIndex).toBe(5);
    }
  });

  it("rejects invalid hex address", () => {
    const event = {
      address: "invalid",
      keys: ["0xselector"],
      data: [],
      transactionHash: "0xabc",
    };

    const result = baseEventSchema.safeParse(event);
    expect(result.success).toBe(false);
  });

  it("rejects empty keys array", () => {
    const event = {
      address: "0x123",
      keys: [],
      data: [],
      transactionHash: "0xabc",
    };

    const result = baseEventSchema.safeParse(event);
    expect(result.success).toBe(false);
  });

  it("rejects negative eventIndex", () => {
    const event = {
      address: "0x123",
      keys: ["0xselector"],
      data: [],
      transactionHash: "0xabc",
      eventIndex: -1,
    };

    const result = baseEventSchema.safeParse(event);
    expect(result.success).toBe(false);
  });
});

// ============================================================
// FACTORY EVENT SCHEMA TESTS
// ============================================================

// Valid hex addresses for testing
const FACTORY_ADDR = "0x01a2b3c4d5e6f7890abcdef1234567890abcdef12345678";
const TX_HASH = "0xabc123def456789";
const SELECTOR = "0x00e316f0a";

describe("factoryYieldContractsCreatedSchema", () => {
  it("validates event with sufficient keys and data", () => {
    const event = {
      address: FACTORY_ADDR,
      keys: [SELECTOR, "0xabc123", "0xdef456"],
      data: Array.from({ length: 11 }, (_, i) => `0x${(i + 1).toString(16)}`),
      transactionHash: TX_HASH,
    };

    const result = factoryYieldContractsCreatedSchema.safeParse(event);
    expect(result.success).toBe(true);
  });

  it("rejects event with insufficient keys", () => {
    const event = {
      address: FACTORY_ADDR,
      keys: [SELECTOR, "0xabc123"], // Missing expiry
      data: Array.from({ length: 11 }, (_, i) => `0x${(i + 1).toString(16)}`),
      transactionHash: TX_HASH,
    };

    const result = factoryYieldContractsCreatedSchema.safeParse(event);
    expect(result.success).toBe(false);
  });

  it("rejects event with insufficient data", () => {
    const event = {
      address: FACTORY_ADDR,
      keys: [SELECTOR, "0xabc123", "0xdef456"],
      data: ["0x1", "0x2"], // Only 2 elements, need 11
      transactionHash: TX_HASH,
    };

    const result = factoryYieldContractsCreatedSchema.safeParse(event);
    expect(result.success).toBe(false);
  });
});

describe("factoryClassHashesUpdatedSchema", () => {
  it("validates event with sufficient data", () => {
    const event = {
      address: FACTORY_ADDR,
      keys: [SELECTOR],
      data: ["0xabc123", "0xdef456"],
      transactionHash: TX_HASH,
    };

    const result = factoryClassHashesUpdatedSchema.safeParse(event);
    expect(result.success).toBe(true);
  });

  it("rejects event with insufficient data", () => {
    const event = {
      address: FACTORY_ADDR,
      keys: [SELECTOR],
      data: ["0xabc123"], // Missing second element
      transactionHash: TX_HASH,
    };

    const result = factoryClassHashesUpdatedSchema.safeParse(event);
    expect(result.success).toBe(false);
  });
});

// ============================================================
// MARKET FACTORY EVENT SCHEMA TESTS
// ============================================================

describe("marketFactoryMarketCreatedSchema", () => {
  it("validates event with sufficient keys and data", () => {
    const event = {
      address: FACTORY_ADDR,
      keys: [SELECTOR, "0xabc123", "0xdef456"],
      data: Array.from({ length: 19 }, (_, i) => `0x${(i + 1).toString(16)}`),
      transactionHash: TX_HASH,
    };

    const result = marketFactoryMarketCreatedSchema.safeParse(event);
    expect(result.success).toBe(true);
  });

  it("rejects event with insufficient data", () => {
    const event = {
      address: FACTORY_ADDR,
      keys: [SELECTOR, "0xabc123", "0xdef456"],
      data: Array.from({ length: 10 }, (_, i) => `0x${(i + 1).toString(16)}`), // Only 10, need 19
      transactionHash: TX_HASH,
    };

    const result = marketFactoryMarketCreatedSchema.safeParse(event);
    expect(result.success).toBe(false);
  });
});

// ============================================================
// SY EVENT SCHEMA TESTS
// ============================================================

const SY_ADDR = "0x0123456789abcdef0123456789abcdef01234567";

describe("syDepositSchema", () => {
  it("validates event with sufficient keys and data", () => {
    const event = {
      address: SY_ADDR,
      keys: [SELECTOR, "0xabc1", "0xabc2", "0xabc3"],
      data: Array.from({ length: 8 }, (_, i) => `0x${(i + 1).toString(16)}`),
      transactionHash: TX_HASH,
    };

    const result = syDepositSchema.safeParse(event);
    expect(result.success).toBe(true);
  });

  it("rejects event with insufficient keys", () => {
    const event = {
      address: SY_ADDR,
      keys: [SELECTOR, "0xabc1"], // Missing receiver and underlying
      data: Array.from({ length: 8 }, (_, i) => `0x${(i + 1).toString(16)}`),
      transactionHash: TX_HASH,
    };

    const result = syDepositSchema.safeParse(event);
    expect(result.success).toBe(false);
  });
});

describe("syRedeemSchema", () => {
  it("validates event with sufficient keys and data", () => {
    const event = {
      address: SY_ADDR,
      keys: [SELECTOR, "0xabc1", "0xabc2", "0xabc3"],
      data: Array.from({ length: 8 }, (_, i) => `0x${(i + 1).toString(16)}`),
      transactionHash: TX_HASH,
    };

    const result = syRedeemSchema.safeParse(event);
    expect(result.success).toBe(true);
  });
});

describe("syOracleRateUpdatedSchema", () => {
  it("validates event with sufficient keys and data", () => {
    const event = {
      address: SY_ADDR,
      keys: [SELECTOR, "0xabc1", "0xabc2"],
      data: Array.from({ length: 6 }, (_, i) => `0x${(i + 1).toString(16)}`),
      transactionHash: TX_HASH,
    };

    const result = syOracleRateUpdatedSchema.safeParse(event);
    expect(result.success).toBe(true);
  });
});

// ============================================================
// YT EVENT SCHEMA TESTS
// ============================================================

const YT_ADDR = "0xabcdef0123456789abcdef0123456789abcdef01";

describe("ytMintPYSchema", () => {
  it("validates event with sufficient keys and data", () => {
    const event = {
      address: YT_ADDR,
      keys: [SELECTOR, "0xabc1", "0xabc2", "0xabc3"],
      data: Array.from({ length: 16 }, (_, i) => `0x${(i + 1).toString(16)}`),
      transactionHash: TX_HASH,
    };

    const result = ytMintPYSchema.safeParse(event);
    expect(result.success).toBe(true);
  });
});

describe("ytRedeemPYSchema", () => {
  it("validates event with sufficient keys and data", () => {
    const event = {
      address: YT_ADDR,
      keys: [SELECTOR, "0xabc1", "0xabc2", "0xabc3"],
      data: Array.from({ length: 10 }, (_, i) => `0x${(i + 1).toString(16)}`),
      transactionHash: TX_HASH,
    };

    const result = ytRedeemPYSchema.safeParse(event);
    expect(result.success).toBe(true);
  });
});

describe("ytRedeemPYPostExpirySchema", () => {
  it("validates event with sufficient keys and data", () => {
    const event = {
      address: YT_ADDR,
      keys: [SELECTOR, "0xabc1", "0xabc2", "0xabc3"],
      data: Array.from({ length: 10 }, (_, i) => `0x${(i + 1).toString(16)}`),
      transactionHash: TX_HASH,
    };

    const result = ytRedeemPYPostExpirySchema.safeParse(event);
    expect(result.success).toBe(true);
  });
});

describe("ytInterestClaimedSchema", () => {
  it("validates event with sufficient keys and data", () => {
    const event = {
      address: YT_ADDR,
      keys: [SELECTOR, "0xabc1", "0xabc2", "0xabc3"],
      data: Array.from({ length: 9 }, (_, i) => `0x${(i + 1).toString(16)}`),
      transactionHash: TX_HASH,
    };

    const result = ytInterestClaimedSchema.safeParse(event);
    expect(result.success).toBe(true);
  });
});

describe("ytExpiryReachedSchema", () => {
  it("validates event with sufficient keys and data", () => {
    const event = {
      address: YT_ADDR,
      keys: [SELECTOR, "0xabc1", "0xabc2", "0xabc3"],
      data: Array.from({ length: 14 }, (_, i) => `0x${(i + 1).toString(16)}`),
      transactionHash: TX_HASH,
    };

    const result = ytExpiryReachedSchema.safeParse(event);
    expect(result.success).toBe(true);
  });
});

// ============================================================
// MARKET EVENT SCHEMA TESTS
// ============================================================

const MARKET_ADDR = "0x1234567890abcdef1234567890abcdef12345678";

describe("marketMintSchema", () => {
  it("validates event with sufficient keys and data", () => {
    const event = {
      address: MARKET_ADDR,
      keys: [SELECTOR, "0xabc1", "0xabc2", "0xabc3"],
      data: Array.from({ length: 18 }, (_, i) => `0x${(i + 1).toString(16)}`),
      transactionHash: TX_HASH,
    };

    const result = marketMintSchema.safeParse(event);
    expect(result.success).toBe(true);
  });
});

describe("marketBurnSchema", () => {
  it("validates event with sufficient keys and data", () => {
    const event = {
      address: MARKET_ADDR,
      keys: [SELECTOR, "0xabc1", "0xabc2", "0xabc3"],
      data: Array.from({ length: 18 }, (_, i) => `0x${(i + 1).toString(16)}`),
      transactionHash: TX_HASH,
    };

    const result = marketBurnSchema.safeParse(event);
    expect(result.success).toBe(true);
  });
});

describe("marketSwapSchema", () => {
  it("validates event with sufficient keys and data", () => {
    const event = {
      address: MARKET_ADDR,
      keys: [SELECTOR, "0xabc1", "0xabc2", "0xabc3"],
      data: Array.from({ length: 27 }, (_, i) => `0x${(i + 1).toString(16)}`),
      transactionHash: TX_HASH,
    };

    const result = marketSwapSchema.safeParse(event);
    expect(result.success).toBe(true);
  });

  it("rejects event with insufficient data", () => {
    const event = {
      address: MARKET_ADDR,
      keys: [SELECTOR, "0xabc1", "0xabc2", "0xabc3"],
      data: Array.from({ length: 10 }, (_, i) => `0x${(i + 1).toString(16)}`), // Only 10, need 27
      transactionHash: TX_HASH,
    };

    const result = marketSwapSchema.safeParse(event);
    expect(result.success).toBe(false);
  });
});

describe("marketImpliedRateUpdatedSchema", () => {
  it("validates event with sufficient keys and data", () => {
    const event = {
      address: MARKET_ADDR,
      keys: [SELECTOR, "0xabc1", "0xabc2"],
      data: Array.from({ length: 14 }, (_, i) => `0x${(i + 1).toString(16)}`),
      transactionHash: TX_HASH,
    };

    const result = marketImpliedRateUpdatedSchema.safeParse(event);
    expect(result.success).toBe(true);
  });
});

describe("marketFeesCollectedSchema", () => {
  it("validates event with sufficient keys and data", () => {
    const event = {
      address: MARKET_ADDR,
      keys: [SELECTOR, "0xabc1", "0xabc2", "0xabc3"],
      data: Array.from({ length: 6 }, (_, i) => `0x${(i + 1).toString(16)}`),
      transactionHash: TX_HASH,
    };

    const result = marketFeesCollectedSchema.safeParse(event);
    expect(result.success).toBe(true);
  });
});

describe("marketScalarRootUpdatedSchema", () => {
  it("validates event with sufficient keys and data", () => {
    const event = {
      address: MARKET_ADDR,
      keys: [SELECTOR, "0xabc1"],
      data: Array.from({ length: 4 }, (_, i) => `0x${(i + 1).toString(16)}`),
      transactionHash: TX_HASH,
    };

    const result = marketScalarRootUpdatedSchema.safeParse(event);
    expect(result.success).toBe(true);
  });
});

// ============================================================
// ROUTER EVENT SCHEMA TESTS
// ============================================================

const ROUTER_ADDR = "0xfedcba9876543210fedcba9876543210fedcba98";

describe("routerMintPYSchema", () => {
  it("validates event with sufficient keys and data", () => {
    const event = {
      address: ROUTER_ADDR,
      keys: [SELECTOR, "0xabc1", "0xabc2"],
      data: Array.from({ length: 7 }, (_, i) => `0x${(i + 1).toString(16)}`),
      transactionHash: TX_HASH,
    };

    const result = routerMintPYSchema.safeParse(event);
    expect(result.success).toBe(true);
  });
});

describe("routerRedeemPYSchema", () => {
  it("validates event with sufficient keys and data", () => {
    const event = {
      address: ROUTER_ADDR,
      keys: [SELECTOR, "0xabc1", "0xabc2"],
      data: Array.from({ length: 5 }, (_, i) => `0x${(i + 1).toString(16)}`),
      transactionHash: TX_HASH,
    };

    const result = routerRedeemPYSchema.safeParse(event);
    expect(result.success).toBe(true);
  });
});

describe("routerAddLiquiditySchema", () => {
  it("validates event with sufficient keys and data", () => {
    const event = {
      address: ROUTER_ADDR,
      keys: [SELECTOR, "0xabc1", "0xabc2"],
      data: Array.from({ length: 7 }, (_, i) => `0x${(i + 1).toString(16)}`),
      transactionHash: TX_HASH,
    };

    const result = routerAddLiquiditySchema.safeParse(event);
    expect(result.success).toBe(true);
  });
});

describe("routerRemoveLiquiditySchema", () => {
  it("validates event with sufficient keys and data", () => {
    const event = {
      address: ROUTER_ADDR,
      keys: [SELECTOR, "0xabc1", "0xabc2"],
      data: Array.from({ length: 7 }, (_, i) => `0x${(i + 1).toString(16)}`),
      transactionHash: TX_HASH,
    };

    const result = routerRemoveLiquiditySchema.safeParse(event);
    expect(result.success).toBe(true);
  });
});

describe("routerSwapSchema", () => {
  it("validates event with sufficient keys and data", () => {
    const event = {
      address: ROUTER_ADDR,
      keys: [SELECTOR, "0xabc1", "0xabc2"],
      data: Array.from({ length: 9 }, (_, i) => `0x${(i + 1).toString(16)}`),
      transactionHash: TX_HASH,
    };

    const result = routerSwapSchema.safeParse(event);
    expect(result.success).toBe(true);
  });
});

describe("routerSwapYTSchema", () => {
  it("validates event with sufficient keys and data", () => {
    const event = {
      address: ROUTER_ADDR,
      keys: [SELECTOR, "0xabc1", "0xabc2"],
      data: Array.from({ length: 10 }, (_, i) => `0x${(i + 1).toString(16)}`),
      transactionHash: TX_HASH,
    };

    const result = routerSwapYTSchema.safeParse(event);
    expect(result.success).toBe(true);
  });
});

// ============================================================
// VALIDATE EVENT HELPER TESTS
// ============================================================

describe("validateEvent", () => {
  it("returns validated data for valid event", () => {
    const event = {
      address: FACTORY_ADDR,
      keys: [SELECTOR],
      data: ["0xabc123", "0xdef456"],
      transactionHash: TX_HASH,
    };

    const result = validateEvent(factoryClassHashesUpdatedSchema, event, {
      indexer: "factory",
      eventName: "ClassHashesUpdated",
      blockNumber: 123,
      transactionHash: TX_HASH,
    });

    expect(result).not.toBeNull();
    expect(result?.address).toBe(FACTORY_ADDR);
    expect(result?.data).toHaveLength(2);
  });

  it("returns null for invalid event", () => {
    const event = {
      address: "invalid", // Invalid hex
      keys: [SELECTOR],
      data: ["0xabc123", "0xdef456"],
      transactionHash: TX_HASH,
    };

    const result = validateEvent(factoryClassHashesUpdatedSchema, event, {
      indexer: "factory",
      eventName: "ClassHashesUpdated",
      blockNumber: 123,
      transactionHash: TX_HASH,
    });

    expect(result).toBeNull();
  });

  it("returns null for missing required fields", () => {
    const event = {
      address: FACTORY_ADDR,
      keys: [SELECTOR],
      // Missing data array
      transactionHash: TX_HASH,
    };

    const result = validateEvent(
      factoryClassHashesUpdatedSchema,
      event as unknown,
      {
        indexer: "factory",
        eventName: "ClassHashesUpdated",
        blockNumber: 123,
        transactionHash: TX_HASH,
      }
    );

    expect(result).toBeNull();
  });

  it("returns null for insufficient data elements", () => {
    const event = {
      address: FACTORY_ADDR,
      keys: [SELECTOR],
      data: ["0xabc123"], // Only 1 element, need 2
      transactionHash: TX_HASH,
    };

    const result = validateEvent(factoryClassHashesUpdatedSchema, event, {
      indexer: "factory",
      eventName: "ClassHashesUpdated",
      blockNumber: 123,
      transactionHash: TX_HASH,
    });

    expect(result).toBeNull();
  });
});
