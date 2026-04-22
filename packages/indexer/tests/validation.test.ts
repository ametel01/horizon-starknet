/**
 * Validation Module Tests
 *
 * Tests Zod schemas for all event types and the validateEvent helper.
 */

import { describe, expect, it, vi } from "vitest";

import {
  baseEventSchema,
  factoryClassHashesUpdatedSchema,
  factoryDefaultInterestFeeRateSetSchema,
  factoryExpiryDivisorSetSchema,
  factoryRewardFeeRateSetSchema,
  factorySYWithRewardsClassHashUpdatedSchema,
  factorySYWithRewardsDeployedSchema,
  factoryYieldContractsCreatedSchema,
  marketBurnSchema,
  marketFactoryDefaultReserveFeeUpdatedSchema,
  marketFactoryMarketCreatedSchema,
  marketFactoryOverrideFeeSetSchema,
  marketFactoryTreasuryUpdatedSchema,
  marketFeesCollectedSchema,
  marketImpliedRateUpdatedSchema,
  marketMintSchema,
  marketReserveFeeTransferredSchema,
  marketScalarRootUpdatedSchema,
  marketSwapSchema,
  routerAddLiquiditySchema,
  routerMintPYSchema,
  routerRedeemPYSchema,
  routerRemoveLiquiditySchema,
  routerSwapSchema,
  routerSwapYTSchema,
  syDepositSchema,
  syNegativeYieldDetectedSchema,
  syOracleRateUpdatedSchema,
  syPausedSchema,
  syRedeemSchema,
  syRewardIndexUpdatedSchema,
  syRewardsClaimedSchema,
  syRewardTokenAddedSchema,
  syUnpausedSchema,
  validateEvent,
  ytExpiryReachedSchema,
  ytFlashMintPYSchema,
  ytInterestClaimedSchema,
  ytInterestFeeRateSetSchema,
  ytMintPYMultiSchema,
  ytMintPYSchema,
  ytPostExpiryDataSetSchema,
  ytPyIndexUpdatedSchema,
  ytRedeemPYMultiSchema,
  ytRedeemPYPostExpirySchema,
  ytRedeemPYSchema,
  ytRedeemPYWithInterestSchema,
  ytTreasuryInterestRedeemedSchema,
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

describe("factoryRewardFeeRateSetSchema", () => {
  it("validates event with sufficient data", () => {
    const event = {
      address: FACTORY_ADDR,
      keys: [SELECTOR],
      data: ["0x1", "0x0", "0x2", "0x0"], // old_fee_rate(u256), new_fee_rate(u256)
      transactionHash: TX_HASH,
    };

    const result = factoryRewardFeeRateSetSchema.safeParse(event);
    expect(result.success).toBe(true);
  });

  it("rejects event with insufficient data", () => {
    const event = {
      address: FACTORY_ADDR,
      keys: [SELECTOR],
      data: ["0x1", "0x0", "0x2"], // Only 3, need 4 for two u256s
      transactionHash: TX_HASH,
    };

    const result = factoryRewardFeeRateSetSchema.safeParse(event);
    expect(result.success).toBe(false);
  });
});

describe("factoryDefaultInterestFeeRateSetSchema", () => {
  it("validates event with sufficient data", () => {
    const event = {
      address: FACTORY_ADDR,
      keys: [SELECTOR],
      data: ["0x1", "0x0", "0x2", "0x0"], // old_fee_rate(u256), new_fee_rate(u256)
      transactionHash: TX_HASH,
    };

    const result = factoryDefaultInterestFeeRateSetSchema.safeParse(event);
    expect(result.success).toBe(true);
  });

  it("rejects event with insufficient data", () => {
    const event = {
      address: FACTORY_ADDR,
      keys: [SELECTOR],
      data: ["0x1", "0x0", "0x2"], // Only 3, need 4 for two u256s
      transactionHash: TX_HASH,
    };

    const result = factoryDefaultInterestFeeRateSetSchema.safeParse(event);
    expect(result.success).toBe(false);
  });
});

describe("factoryExpiryDivisorSetSchema", () => {
  it("validates event with sufficient data", () => {
    const event = {
      address: FACTORY_ADDR,
      keys: [SELECTOR],
      data: ["0x15180", "0x15180"], // old_expiry_divisor (86400), new_expiry_divisor (86400)
      transactionHash: TX_HASH,
    };

    const result = factoryExpiryDivisorSetSchema.safeParse(event);
    expect(result.success).toBe(true);
  });

  it("rejects event with insufficient data", () => {
    const event = {
      address: FACTORY_ADDR,
      keys: [SELECTOR],
      data: ["0x15180"], // Only 1, need 2
      transactionHash: TX_HASH,
    };

    const result = factoryExpiryDivisorSetSchema.safeParse(event);
    expect(result.success).toBe(false);
  });
});

describe("factorySYWithRewardsDeployedSchema", () => {
  it("validates event with sufficient keys and data", () => {
    const event = {
      address: FACTORY_ADDR,
      keys: [SELECTOR, "0xsy123"], // selector and sy address
      // data: name(ByteArray: 3 min), symbol(ByteArray: 3 min), underlying, deployer, timestamp
      data: Array.from({ length: 9 }, (_, i) => `0x${(i + 1).toString(16)}`),
      transactionHash: TX_HASH,
    };

    const result = factorySYWithRewardsDeployedSchema.safeParse(event);
    expect(result.success).toBe(true);
  });

  it("rejects event with insufficient keys", () => {
    const event = {
      address: FACTORY_ADDR,
      keys: [SELECTOR], // Missing sy key
      data: Array.from({ length: 9 }, (_, i) => `0x${(i + 1).toString(16)}`),
      transactionHash: TX_HASH,
    };

    const result = factorySYWithRewardsDeployedSchema.safeParse(event);
    expect(result.success).toBe(false);
  });

  it("rejects event with insufficient data", () => {
    const event = {
      address: FACTORY_ADDR,
      keys: [SELECTOR, "0xsy123"],
      data: Array.from({ length: 5 }, (_, i) => `0x${(i + 1).toString(16)}`), // Only 5, need 9
      transactionHash: TX_HASH,
    };

    const result = factorySYWithRewardsDeployedSchema.safeParse(event);
    expect(result.success).toBe(false);
  });
});

describe("factorySYWithRewardsClassHashUpdatedSchema", () => {
  it("validates event with sufficient data", () => {
    const event = {
      address: FACTORY_ADDR,
      keys: [SELECTOR],
      data: ["0xabc123", "0xdef456"], // old_class_hash, new_class_hash
      transactionHash: TX_HASH,
    };

    const result = factorySYWithRewardsClassHashUpdatedSchema.safeParse(event);
    expect(result.success).toBe(true);
  });

  it("rejects event with insufficient data", () => {
    const event = {
      address: FACTORY_ADDR,
      keys: [SELECTOR],
      data: ["0xabc123"], // Only 1, need 2
      transactionHash: TX_HASH,
    };

    const result = factorySYWithRewardsClassHashUpdatedSchema.safeParse(event);
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

describe("marketFactoryTreasuryUpdatedSchema", () => {
  it("validates event with sufficient keys and data", () => {
    const event = {
      address: FACTORY_ADDR,
      keys: [SELECTOR],
      data: ["0xabc123", "0xdef456"], // old_treasury, new_treasury
      transactionHash: TX_HASH,
    };

    const result = marketFactoryTreasuryUpdatedSchema.safeParse(event);
    expect(result.success).toBe(true);
  });

  it("rejects event with insufficient data", () => {
    const event = {
      address: FACTORY_ADDR,
      keys: [SELECTOR],
      data: ["0xabc123"], // Only 1, need 2
      transactionHash: TX_HASH,
    };

    const result = marketFactoryTreasuryUpdatedSchema.safeParse(event);
    expect(result.success).toBe(false);
  });
});

describe("marketFactoryDefaultReserveFeeUpdatedSchema", () => {
  it("validates event with sufficient keys and data", () => {
    const event = {
      address: FACTORY_ADDR,
      keys: [SELECTOR],
      data: ["0x14", "0x1e"], // old_percent (20), new_percent (30)
      transactionHash: TX_HASH,
    };

    const result = marketFactoryDefaultReserveFeeUpdatedSchema.safeParse(event);
    expect(result.success).toBe(true);
  });

  it("rejects event with insufficient data", () => {
    const event = {
      address: FACTORY_ADDR,
      keys: [SELECTOR],
      data: ["0x14"], // Only 1, need 2
      transactionHash: TX_HASH,
    };

    const result = marketFactoryDefaultReserveFeeUpdatedSchema.safeParse(event);
    expect(result.success).toBe(false);
  });
});

describe("marketFactoryOverrideFeeSetSchema", () => {
  it("validates event with sufficient keys and data", () => {
    const event = {
      address: FACTORY_ADDR,
      keys: [SELECTOR, "0xabc111", "0xdef222"],
      data: ["0x1", "0x0"], // ln_fee_rate_root as u256 (low, high)
      transactionHash: TX_HASH,
    };

    const result = marketFactoryOverrideFeeSetSchema.safeParse(event);
    expect(result.success).toBe(true);
  });

  it("rejects event with insufficient keys", () => {
    const event = {
      address: FACTORY_ADDR,
      keys: [SELECTOR, "0xabc111"], // Missing market
      data: ["0x1", "0x0"],
      transactionHash: TX_HASH,
    };

    const result = marketFactoryOverrideFeeSetSchema.safeParse(event);
    expect(result.success).toBe(false);
  });

  it("rejects event with insufficient data", () => {
    const event = {
      address: FACTORY_ADDR,
      keys: [SELECTOR, "0xabc111", "0xdef222"],
      data: ["0x1"], // Only 1, need 2 for u256
      transactionHash: TX_HASH,
    };

    const result = marketFactoryOverrideFeeSetSchema.safeParse(event);
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
// SY PHASE 4: MONITORING EVENT SCHEMA TESTS
// ============================================================

describe("syNegativeYieldDetectedSchema", () => {
  it("validates event with sufficient keys and data", () => {
    const event = {
      address: SY_ADDR,
      keys: [SELECTOR, "0xsy", "0xunderlying"],
      data: Array.from({ length: 7 }, (_, i) => `0x${(i + 1).toString(16)}`),
      transactionHash: TX_HASH,
    };

    const result = syNegativeYieldDetectedSchema.safeParse(event);
    expect(result.success).toBe(true);
  });

  it("rejects event with insufficient keys", () => {
    const event = {
      address: SY_ADDR,
      keys: [SELECTOR, "0xsy"], // Missing underlying
      data: Array.from({ length: 7 }, (_, i) => `0x${(i + 1).toString(16)}`),
      transactionHash: TX_HASH,
    };

    const result = syNegativeYieldDetectedSchema.safeParse(event);
    expect(result.success).toBe(false);
  });

  it("rejects event with insufficient data", () => {
    const event = {
      address: SY_ADDR,
      keys: [SELECTOR, "0xsy", "0xunderlying"],
      data: Array.from({ length: 5 }, (_, i) => `0x${(i + 1).toString(16)}`), // Only 5, need 7
      transactionHash: TX_HASH,
    };

    const result = syNegativeYieldDetectedSchema.safeParse(event);
    expect(result.success).toBe(false);
  });
});

describe("syPausedSchema", () => {
  it("validates event with sufficient keys and data", () => {
    const event = {
      address: SY_ADDR,
      keys: [SELECTOR],
      data: ["0xaccount"],
      transactionHash: TX_HASH,
    };

    const result = syPausedSchema.safeParse(event);
    expect(result.success).toBe(true);
  });

  it("rejects event with empty data", () => {
    const event = {
      address: SY_ADDR,
      keys: [SELECTOR],
      data: [],
      transactionHash: TX_HASH,
    };

    const result = syPausedSchema.safeParse(event);
    expect(result.success).toBe(false);
  });
});

describe("syUnpausedSchema", () => {
  it("validates event with sufficient keys and data", () => {
    const event = {
      address: SY_ADDR,
      keys: [SELECTOR],
      data: ["0xaccount"],
      transactionHash: TX_HASH,
    };

    const result = syUnpausedSchema.safeParse(event);
    expect(result.success).toBe(true);
  });

  it("rejects event with empty data", () => {
    const event = {
      address: SY_ADDR,
      keys: [SELECTOR],
      data: [],
      transactionHash: TX_HASH,
    };

    const result = syUnpausedSchema.safeParse(event);
    expect(result.success).toBe(false);
  });
});

// ============================================================
// SY PHASE 4: REWARD MANAGER EVENT SCHEMA TESTS
// ============================================================

describe("syRewardsClaimedSchema", () => {
  it("validates event with sufficient keys and data", () => {
    const event = {
      address: SY_ADDR,
      keys: [SELECTOR, "0xuser", "0xreward_token"],
      data: Array.from({ length: 3 }, (_, i) => `0x${(i + 1).toString(16)}`),
      transactionHash: TX_HASH,
    };

    const result = syRewardsClaimedSchema.safeParse(event);
    expect(result.success).toBe(true);
  });

  it("rejects event with insufficient keys", () => {
    const event = {
      address: SY_ADDR,
      keys: [SELECTOR, "0xuser"], // Missing reward_token
      data: Array.from({ length: 3 }, (_, i) => `0x${(i + 1).toString(16)}`),
      transactionHash: TX_HASH,
    };

    const result = syRewardsClaimedSchema.safeParse(event);
    expect(result.success).toBe(false);
  });

  it("rejects event with insufficient data", () => {
    const event = {
      address: SY_ADDR,
      keys: [SELECTOR, "0xuser", "0xreward_token"],
      data: ["0x1", "0x0"], // Only 2, need 3
      transactionHash: TX_HASH,
    };

    const result = syRewardsClaimedSchema.safeParse(event);
    expect(result.success).toBe(false);
  });
});

describe("syRewardIndexUpdatedSchema", () => {
  it("validates event with sufficient keys and data", () => {
    const event = {
      address: SY_ADDR,
      keys: [SELECTOR, "0xreward_token"],
      data: Array.from({ length: 9 }, (_, i) => `0x${(i + 1).toString(16)}`),
      transactionHash: TX_HASH,
    };

    const result = syRewardIndexUpdatedSchema.safeParse(event);
    expect(result.success).toBe(true);
  });

  it("rejects event with insufficient keys", () => {
    const event = {
      address: SY_ADDR,
      keys: [SELECTOR], // Missing reward_token
      data: Array.from({ length: 9 }, (_, i) => `0x${(i + 1).toString(16)}`),
      transactionHash: TX_HASH,
    };

    const result = syRewardIndexUpdatedSchema.safeParse(event);
    expect(result.success).toBe(false);
  });

  it("rejects event with insufficient data", () => {
    const event = {
      address: SY_ADDR,
      keys: [SELECTOR, "0xreward_token"],
      data: Array.from({ length: 6 }, (_, i) => `0x${(i + 1).toString(16)}`), // Only 6, need 9
      transactionHash: TX_HASH,
    };

    const result = syRewardIndexUpdatedSchema.safeParse(event);
    expect(result.success).toBe(false);
  });
});

describe("syRewardTokenAddedSchema", () => {
  it("validates event with sufficient keys and data", () => {
    const event = {
      address: SY_ADDR,
      keys: [SELECTOR, "0xreward_token"],
      data: ["0x1", "0x12345678"], // index, timestamp
      transactionHash: TX_HASH,
    };

    const result = syRewardTokenAddedSchema.safeParse(event);
    expect(result.success).toBe(true);
  });

  it("rejects event with insufficient keys", () => {
    const event = {
      address: SY_ADDR,
      keys: [SELECTOR], // Missing reward_token
      data: ["0x1", "0x12345678"],
      transactionHash: TX_HASH,
    };

    const result = syRewardTokenAddedSchema.safeParse(event);
    expect(result.success).toBe(false);
  });

  it("rejects event with insufficient data", () => {
    const event = {
      address: SY_ADDR,
      keys: [SELECTOR, "0xreward_token"],
      data: ["0x1"], // Only 1, need 2
      transactionHash: TX_HASH,
    };

    const result = syRewardTokenAddedSchema.safeParse(event);
    expect(result.success).toBe(false);
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
// YT PENDLE-STYLE INTEREST SYSTEM EVENT SCHEMA TESTS
// ============================================================

describe("ytTreasuryInterestRedeemedSchema", () => {
  it("validates event with sufficient keys and data", () => {
    const event = {
      address: YT_ADDR,
      keys: [SELECTOR, "0xyt", "0xtreasury"],
      data: Array.from({ length: 10 }, (_, i) => `0x${(i + 1).toString(16)}`),
      transactionHash: TX_HASH,
    };

    const result = ytTreasuryInterestRedeemedSchema.safeParse(event);
    expect(result.success).toBe(true);
  });

  it("rejects event with insufficient keys", () => {
    const event = {
      address: YT_ADDR,
      keys: [SELECTOR, "0xyt"], // Missing treasury
      data: Array.from({ length: 10 }, (_, i) => `0x${(i + 1).toString(16)}`),
      transactionHash: TX_HASH,
    };

    const result = ytTreasuryInterestRedeemedSchema.safeParse(event);
    expect(result.success).toBe(false);
  });

  it("rejects event with insufficient data", () => {
    const event = {
      address: YT_ADDR,
      keys: [SELECTOR, "0xyt", "0xtreasury"],
      data: Array.from({ length: 5 }, (_, i) => `0x${(i + 1).toString(16)}`), // Need 10
      transactionHash: TX_HASH,
    };

    const result = ytTreasuryInterestRedeemedSchema.safeParse(event);
    expect(result.success).toBe(false);
  });
});

describe("ytInterestFeeRateSetSchema", () => {
  it("validates event with sufficient keys and data", () => {
    const event = {
      address: YT_ADDR,
      keys: [SELECTOR, "0xyt"],
      data: Array.from({ length: 5 }, (_, i) => `0x${(i + 1).toString(16)}`),
      transactionHash: TX_HASH,
    };

    const result = ytInterestFeeRateSetSchema.safeParse(event);
    expect(result.success).toBe(true);
  });

  it("rejects event with insufficient keys", () => {
    const event = {
      address: YT_ADDR,
      keys: [SELECTOR], // Missing yt
      data: Array.from({ length: 5 }, (_, i) => `0x${(i + 1).toString(16)}`),
      transactionHash: TX_HASH,
    };

    const result = ytInterestFeeRateSetSchema.safeParse(event);
    expect(result.success).toBe(false);
  });

  it("rejects event with insufficient data", () => {
    const event = {
      address: YT_ADDR,
      keys: [SELECTOR, "0xyt"],
      data: Array.from({ length: 2 }, (_, i) => `0x${(i + 1).toString(16)}`), // Need 5
      transactionHash: TX_HASH,
    };

    const result = ytInterestFeeRateSetSchema.safeParse(event);
    expect(result.success).toBe(false);
  });
});

describe("ytMintPYMultiSchema", () => {
  it("validates event with sufficient keys and data", () => {
    const event = {
      address: YT_ADDR,
      keys: [SELECTOR, "0xcaller", "0xexpiry"],
      data: Array.from({ length: 6 }, (_, i) => `0x${(i + 1).toString(16)}`),
      transactionHash: TX_HASH,
    };

    const result = ytMintPYMultiSchema.safeParse(event);
    expect(result.success).toBe(true);
  });

  it("rejects event with insufficient keys", () => {
    const event = {
      address: YT_ADDR,
      keys: [SELECTOR, "0xcaller"], // Missing expiry
      data: Array.from({ length: 6 }, (_, i) => `0x${(i + 1).toString(16)}`),
      transactionHash: TX_HASH,
    };

    const result = ytMintPYMultiSchema.safeParse(event);
    expect(result.success).toBe(false);
  });

  it("rejects event with insufficient data", () => {
    const event = {
      address: YT_ADDR,
      keys: [SELECTOR, "0xcaller", "0xexpiry"],
      data: Array.from({ length: 3 }, (_, i) => `0x${(i + 1).toString(16)}`), // Need 6
      transactionHash: TX_HASH,
    };

    const result = ytMintPYMultiSchema.safeParse(event);
    expect(result.success).toBe(false);
  });
});

describe("ytRedeemPYMultiSchema", () => {
  it("validates event with sufficient keys and data", () => {
    const event = {
      address: YT_ADDR,
      keys: [SELECTOR, "0xcaller", "0xexpiry"],
      data: Array.from({ length: 6 }, (_, i) => `0x${(i + 1).toString(16)}`),
      transactionHash: TX_HASH,
    };

    const result = ytRedeemPYMultiSchema.safeParse(event);
    expect(result.success).toBe(true);
  });

  it("rejects event with insufficient keys", () => {
    const event = {
      address: YT_ADDR,
      keys: [SELECTOR, "0xcaller"], // Missing expiry
      data: Array.from({ length: 6 }, (_, i) => `0x${(i + 1).toString(16)}`),
      transactionHash: TX_HASH,
    };

    const result = ytRedeemPYMultiSchema.safeParse(event);
    expect(result.success).toBe(false);
  });

  it("rejects event with insufficient data", () => {
    const event = {
      address: YT_ADDR,
      keys: [SELECTOR, "0xcaller", "0xexpiry"],
      data: Array.from({ length: 3 }, (_, i) => `0x${(i + 1).toString(16)}`), // Need 6
      transactionHash: TX_HASH,
    };

    const result = ytRedeemPYMultiSchema.safeParse(event);
    expect(result.success).toBe(false);
  });
});

describe("ytRedeemPYWithInterestSchema", () => {
  it("validates event with sufficient keys and data", () => {
    const event = {
      address: YT_ADDR,
      keys: [SELECTOR, "0xcaller", "0xreceiver", "0xexpiry"],
      data: Array.from({ length: 7 }, (_, i) => `0x${(i + 1).toString(16)}`),
      transactionHash: TX_HASH,
    };

    const result = ytRedeemPYWithInterestSchema.safeParse(event);
    expect(result.success).toBe(true);
  });

  it("rejects event with insufficient keys", () => {
    const event = {
      address: YT_ADDR,
      keys: [SELECTOR, "0xcaller", "0xreceiver"], // Missing expiry
      data: Array.from({ length: 7 }, (_, i) => `0x${(i + 1).toString(16)}`),
      transactionHash: TX_HASH,
    };

    const result = ytRedeemPYWithInterestSchema.safeParse(event);
    expect(result.success).toBe(false);
  });

  it("rejects event with insufficient data", () => {
    const event = {
      address: YT_ADDR,
      keys: [SELECTOR, "0xcaller", "0xreceiver", "0xexpiry"],
      data: Array.from({ length: 4 }, (_, i) => `0x${(i + 1).toString(16)}`), // Need 7
      transactionHash: TX_HASH,
    };

    const result = ytRedeemPYWithInterestSchema.safeParse(event);
    expect(result.success).toBe(false);
  });
});

describe("ytPostExpiryDataSetSchema", () => {
  it("validates event with sufficient keys and data", () => {
    const event = {
      address: YT_ADDR,
      keys: [SELECTOR, "0xyt", "0xpt"],
      data: Array.from({ length: 11 }, (_, i) => `0x${(i + 1).toString(16)}`),
      transactionHash: TX_HASH,
    };

    const result = ytPostExpiryDataSetSchema.safeParse(event);
    expect(result.success).toBe(true);
  });

  it("rejects event with insufficient keys", () => {
    const event = {
      address: YT_ADDR,
      keys: [SELECTOR, "0xyt"], // Missing pt
      data: Array.from({ length: 11 }, (_, i) => `0x${(i + 1).toString(16)}`),
      transactionHash: TX_HASH,
    };

    const result = ytPostExpiryDataSetSchema.safeParse(event);
    expect(result.success).toBe(false);
  });

  it("rejects event with insufficient data", () => {
    const event = {
      address: YT_ADDR,
      keys: [SELECTOR, "0xyt", "0xpt"],
      data: Array.from({ length: 6 }, (_, i) => `0x${(i + 1).toString(16)}`), // Need 11
      transactionHash: TX_HASH,
    };

    const result = ytPostExpiryDataSetSchema.safeParse(event);
    expect(result.success).toBe(false);
  });
});

describe("ytPyIndexUpdatedSchema", () => {
  it("validates event with sufficient keys and data", () => {
    const event = {
      address: YT_ADDR,
      keys: [SELECTOR, "0xyt"],
      data: Array.from({ length: 8 }, (_, i) => `0x${(i + 1).toString(16)}`),
      transactionHash: TX_HASH,
    };

    const result = ytPyIndexUpdatedSchema.safeParse(event);
    expect(result.success).toBe(true);
  });

  it("rejects event with insufficient keys", () => {
    const event = {
      address: YT_ADDR,
      keys: [SELECTOR], // Missing yt
      data: Array.from({ length: 8 }, (_, i) => `0x${(i + 1).toString(16)}`),
      transactionHash: TX_HASH,
    };

    const result = ytPyIndexUpdatedSchema.safeParse(event);
    expect(result.success).toBe(false);
  });

  it("rejects event with insufficient data", () => {
    const event = {
      address: YT_ADDR,
      keys: [SELECTOR, "0xyt"],
      data: Array.from({ length: 4 }, (_, i) => `0x${(i + 1).toString(16)}`), // Need 8
      transactionHash: TX_HASH,
    };

    const result = ytPyIndexUpdatedSchema.safeParse(event);
    expect(result.success).toBe(false);
  });
});

describe("ytFlashMintPYSchema", () => {
  it("validates event with sufficient keys and data", () => {
    const event = {
      address: YT_ADDR,
      keys: [SELECTOR, "0xcaller", "0xreceiver"],
      data: Array.from({ length: 7 }, (_, i) => `0x${(i + 1).toString(16)}`),
      transactionHash: TX_HASH,
    };

    const result = ytFlashMintPYSchema.safeParse(event);
    expect(result.success).toBe(true);
  });

  it("rejects event with insufficient keys", () => {
    const event = {
      address: YT_ADDR,
      keys: [SELECTOR, "0xcaller"], // Missing receiver
      data: Array.from({ length: 7 }, (_, i) => `0x${(i + 1).toString(16)}`),
      transactionHash: TX_HASH,
    };

    const result = ytFlashMintPYSchema.safeParse(event);
    expect(result.success).toBe(false);
  });

  it("rejects event with insufficient data", () => {
    const event = {
      address: YT_ADDR,
      keys: [SELECTOR, "0xcaller", "0xreceiver"],
      data: Array.from({ length: 4 }, (_, i) => `0x${(i + 1).toString(16)}`), // Need 7
      transactionHash: TX_HASH,
    };

    const result = ytFlashMintPYSchema.safeParse(event);
    expect(result.success).toBe(false);
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

describe("marketReserveFeeTransferredSchema", () => {
  it("validates event with sufficient keys and data", () => {
    const event = {
      address: MARKET_ADDR,
      keys: [SELECTOR, "0xaaa111", "0xbbb222", "0xccc333"],
      data: ["0x1", "0x0", "0x12345678", "0x12345678"], // amount(u256), expiry, timestamp
      transactionHash: TX_HASH,
    };

    const result = marketReserveFeeTransferredSchema.safeParse(event);
    expect(result.success).toBe(true);
  });

  it("rejects event with insufficient keys", () => {
    const event = {
      address: MARKET_ADDR,
      keys: [SELECTOR, "0xaaa111", "0xbbb222"], // Missing caller
      data: ["0x1", "0x0", "0x12345678", "0x12345678"],
      transactionHash: TX_HASH,
    };

    const result = marketReserveFeeTransferredSchema.safeParse(event);
    expect(result.success).toBe(false);
  });

  it("rejects event with insufficient data", () => {
    const event = {
      address: MARKET_ADDR,
      keys: [SELECTOR, "0xaaa111", "0xbbb222", "0xccc333"],
      data: ["0x1", "0x0", "0x12345678"], // Only 3, need 4
      transactionHash: TX_HASH,
    };

    const result = marketReserveFeeTransferredSchema.safeParse(event);
    expect(result.success).toBe(false);
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
