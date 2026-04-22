/**
 * Zod validation schemas for Starknet event data
 *
 * Provides runtime validation for all event types indexed by Horizon Protocol.
 * Validation catches malformed events early, preventing silent data corruption.
 *
 * Schema naming convention: {Contract}{EventName}Schema
 * E.g., factoryYieldContractsCreatedSchema for Factory.YieldContractsCreated
 */

import { z } from "zod";

import { logger } from "./logger";

// ============================================================
// BASE SCHEMAS
// ============================================================

/**
 * Hex string validation - matches Starknet felt252 format
 */
const hexString = z
  .string()
  .regex(/^0x[a-fA-F0-9]+$/, "Invalid hex string format");

/**
 * Base event schema - common fields for all Starknet events
 */
export const baseEventSchema = z.object({
  address: hexString,
  keys: z.array(z.string()).min(1, "Events must have at least one key"),
  data: z.array(z.string()),
  transactionHash: hexString,
  eventIndex: z.number().nonnegative().optional(),
});

export type BaseEvent = z.infer<typeof baseEventSchema>;

// ============================================================
// FACTORY EVENTS (7 schemas)
// ============================================================

/**
 * Factory.YieldContractsCreated event
 * keys: [selector, sy, expiry]
 * data: [pt, yt, creator, underlying, symbol(ByteArray), initial_exchange_rate(u256), timestamp, market_index]
 *
 * Note: symbol is a variable-length ByteArray (3 + arrayLen felts).
 * Minimum 11 elements assumes arrayLen=0 (symbol ≤31 chars). Longer symbols add more felts.
 */
export const factoryYieldContractsCreatedSchema = baseEventSchema.extend({
  keys: z
    .array(z.string())
    .min(3, "YieldContractsCreated requires at least 3 keys"),
  data: z
    .array(z.string())
    .min(11, "YieldContractsCreated requires at least 11 data elements"),
});

/**
 * Factory.ClassHashesUpdated event
 * keys: [selector]
 * data: [yt_class_hash, pt_class_hash]
 */
export const factoryClassHashesUpdatedSchema = baseEventSchema.extend({
  keys: z.array(z.string()).min(1),
  data: z
    .array(z.string())
    .min(2, "ClassHashesUpdated requires at least 2 data elements"),
});

/**
 * Factory.RewardFeeRateSet event
 * keys: [selector]
 * data: [old_fee_rate(u256), new_fee_rate(u256)]
 */
export const factoryRewardFeeRateSetSchema = baseEventSchema.extend({
  keys: z.array(z.string()).min(1),
  data: z
    .array(z.string())
    .min(4, "RewardFeeRateSet requires at least 4 data elements"),
});

/**
 * Factory.DefaultInterestFeeRateSet event
 * keys: [selector]
 * data: [old_fee_rate(u256), new_fee_rate(u256)]
 */
export const factoryDefaultInterestFeeRateSetSchema = baseEventSchema.extend({
  keys: z.array(z.string()).min(1),
  data: z
    .array(z.string())
    .min(4, "DefaultInterestFeeRateSet requires at least 4 data elements"),
});

/**
 * Factory.ExpiryDivisorSet event
 * keys: [selector]
 * data: [old_expiry_divisor, new_expiry_divisor]
 */
export const factoryExpiryDivisorSetSchema = baseEventSchema.extend({
  keys: z.array(z.string()).min(1),
  data: z
    .array(z.string())
    .min(2, "ExpiryDivisorSet requires at least 2 data elements"),
});

/**
 * Factory.SYWithRewardsDeployed event
 * keys: [selector, sy]
 * data: [name(ByteArray), symbol(ByteArray), underlying, deployer, timestamp]
 *
 * Note: name and symbol are variable-length ByteArrays (3 + arrayLen felts each).
 * Minimum 9 elements assumes arrayLen=0 for both (name/symbol ≤31 chars).
 */
export const factorySYWithRewardsDeployedSchema = baseEventSchema.extend({
  keys: z
    .array(z.string())
    .min(2, "SYWithRewardsDeployed requires at least 2 keys"),
  data: z
    .array(z.string())
    .min(9, "SYWithRewardsDeployed requires at least 9 data elements"),
});

/**
 * Factory.SYWithRewardsClassHashUpdated event
 * keys: [selector]
 * data: [old_class_hash, new_class_hash]
 */
export const factorySYWithRewardsClassHashUpdatedSchema =
  baseEventSchema.extend({
    keys: z.array(z.string()).min(1),
    data: z
      .array(z.string())
      .min(
        2,
        "SYWithRewardsClassHashUpdated requires at least 2 data elements"
      ),
  });

// ============================================================
// MARKET FACTORY EVENTS (7 schemas)
// ============================================================

/**
 * MarketFactory.MarketCreated event
 * keys: [selector, pt, expiry]
 * data: [market, creator, scalar_root(u256), initial_anchor(u256), ln_fee_rate_root(u256),
 *        reserve_fee_percent, sy, yt, underlying, underlying_symbol(ByteArray),
 *        initial_exchange_rate(u256), timestamp, market_index]
 *
 * Note: underlying_symbol is a variable-length ByteArray (3 + arrayLen felts).
 * Minimum 19 elements assumes arrayLen=0 (symbol ≤31 chars). Longer symbols add more felts.
 */
export const marketFactoryMarketCreatedSchema = baseEventSchema.extend({
  keys: z.array(z.string()).min(3, "MarketCreated requires at least 3 keys"),
  data: z
    .array(z.string())
    .min(19, "MarketCreated requires at least 19 data elements"),
});

/**
 * MarketFactory.MarketClassHashUpdated event
 * keys: [selector]
 * data: [old_class_hash, new_class_hash]
 */
export const marketFactoryClassHashUpdatedSchema = baseEventSchema.extend({
  keys: z.array(z.string()).min(1),
  data: z
    .array(z.string())
    .min(2, "MarketClassHashUpdated requires at least 2 data elements"),
});

/**
 * MarketFactory.TreasuryUpdated event
 * keys: [selector]
 * data: [old_treasury, new_treasury]
 */
export const marketFactoryTreasuryUpdatedSchema = baseEventSchema.extend({
  keys: z.array(z.string()).min(1),
  data: z
    .array(z.string())
    .min(2, "TreasuryUpdated requires at least 2 data elements"),
});

/**
 * MarketFactory.DefaultReserveFeeUpdated event
 * keys: [selector]
 * data: [old_percent, new_percent]
 */
export const marketFactoryDefaultReserveFeeUpdatedSchema =
  baseEventSchema.extend({
    keys: z.array(z.string()).min(1),
    data: z
      .array(z.string())
      .min(2, "DefaultReserveFeeUpdated requires at least 2 data elements"),
  });

/**
 * MarketFactory.OverrideFeeSet event
 * keys: [selector, router, market]
 * data: [ln_fee_rate_root(u256)]
 */
export const marketFactoryOverrideFeeSetSchema = baseEventSchema.extend({
  keys: z.array(z.string()).min(3, "OverrideFeeSet requires at least 3 keys"),
  data: z
    .array(z.string())
    .min(2, "OverrideFeeSet requires at least 2 data elements"),
});

/**
 * MarketFactory.DefaultRateImpactSensitivityUpdated event
 * keys: [selector]
 * data: [old_sensitivity(u256), new_sensitivity(u256)]
 */
export const marketFactoryDefaultRateImpactSensitivityUpdatedSchema =
  baseEventSchema.extend({
    keys: z.array(z.string()).min(1),
    data: z
      .array(z.string())
      .min(
        4,
        "DefaultRateImpactSensitivityUpdated requires at least 4 data elements"
      ),
  });

/**
 * MarketFactory.YieldContractFactoryUpdated event
 * keys: [selector]
 * data: [old_factory, new_factory]
 */
export const marketFactoryYieldContractFactoryUpdatedSchema =
  baseEventSchema.extend({
    keys: z.array(z.string()).min(1),
    data: z
      .array(z.string())
      .min(2, "YieldContractFactoryUpdated requires at least 2 data elements"),
  });

// ============================================================
// SY EVENTS (3 core + 6 Phase 4 monitoring schemas)
// ============================================================

/**
 * SY.Deposit event
 * keys: [selector, caller, receiver, underlying]
 * data: [amount_deposited(u256), amount_sy_minted(u256), exchange_rate(u256), total_supply_after(u256)]
 */
export const syDepositSchema = baseEventSchema.extend({
  keys: z.array(z.string()).min(4, "Deposit requires at least 4 keys"),
  data: z.array(z.string()).min(8, "Deposit requires at least 8 data elements"),
});

/**
 * SY.Redeem event
 * keys: [selector, caller, receiver, underlying]
 * data: [amount_sy_burned(u256), amount_redeemed(u256), exchange_rate(u256), total_supply_after(u256)]
 */
export const syRedeemSchema = baseEventSchema.extend({
  keys: z.array(z.string()).min(4, "Redeem requires at least 4 keys"),
  data: z.array(z.string()).min(8, "Redeem requires at least 8 data elements"),
});

/**
 * SY.OracleRateUpdated event
 * keys: [selector, sy, underlying]
 * data: [old_rate(u256), new_rate(u256), rate_change_bps(u256)]
 */
export const syOracleRateUpdatedSchema = baseEventSchema.extend({
  keys: z
    .array(z.string())
    .min(3, "OracleRateUpdated requires at least 3 keys"),
  data: z
    .array(z.string())
    .min(6, "OracleRateUpdated requires at least 6 data elements"),
});

// ============================================================
// PHASE 4: SY MONITORING EVENTS (6 schemas)
// ============================================================

/**
 * SYComponent.NegativeYieldDetected event
 * keys: [selector, sy, underlying]
 * data: [watermark_rate(u256), current_rate(u256), rate_drop_bps(u256), timestamp]
 */
export const syNegativeYieldDetectedSchema = baseEventSchema.extend({
  keys: z
    .array(z.string())
    .min(3, "NegativeYieldDetected requires at least 3 keys"),
  data: z
    .array(z.string())
    .min(7, "NegativeYieldDetected requires at least 7 data elements"),
});

/**
 * OpenZeppelin Pausable.Paused event
 * keys: [selector]
 * data: [account]
 */
export const syPausedSchema = baseEventSchema.extend({
  keys: z.array(z.string()).min(1, "Paused requires at least 1 key"),
  data: z.array(z.string()).min(1, "Paused requires at least 1 data element"),
});

/**
 * OpenZeppelin Pausable.Unpaused event
 * keys: [selector]
 * data: [account]
 */
export const syUnpausedSchema = baseEventSchema.extend({
  keys: z.array(z.string()).min(1, "Unpaused requires at least 1 key"),
  data: z.array(z.string()).min(1, "Unpaused requires at least 1 data element"),
});

/**
 * RewardManager.RewardsClaimed event
 * keys: [selector, user, reward_token]
 * data: [amount(u256), timestamp]
 */
export const syRewardsClaimedSchema = baseEventSchema.extend({
  keys: z.array(z.string()).min(3, "RewardsClaimed requires at least 3 keys"),
  data: z
    .array(z.string())
    .min(3, "RewardsClaimed requires at least 3 data elements"),
});

/**
 * RewardManager.RewardIndexUpdated event
 * keys: [selector, reward_token]
 * data: [old_index(u256), new_index(u256), rewards_added(u256), total_supply(u256), timestamp]
 */
export const syRewardIndexUpdatedSchema = baseEventSchema.extend({
  keys: z
    .array(z.string())
    .min(2, "RewardIndexUpdated requires at least 2 keys"),
  data: z
    .array(z.string())
    .min(9, "RewardIndexUpdated requires at least 9 data elements"),
});

/**
 * RewardManager.RewardTokenAdded event
 * keys: [selector, reward_token]
 * data: [index, timestamp]
 */
export const syRewardTokenAddedSchema = baseEventSchema.extend({
  keys: z.array(z.string()).min(2, "RewardTokenAdded requires at least 2 keys"),
  data: z
    .array(z.string())
    .min(2, "RewardTokenAdded requires at least 2 data elements"),
});

// ============================================================
// YT EVENTS (5 schemas)
// ============================================================

/**
 * YT.MintPY event (updated for split receivers)
 * keys: [selector, caller, receiver_pt, receiver_yt]
 * data: [expiry, amount_sy_deposited(u256), amount_py_minted(u256), pt, sy, py_index(u256),
 *        exchange_rate(u256), total_pt_supply(u256), total_yt_supply(u256), timestamp]
 */
export const ytMintPYSchema = baseEventSchema.extend({
  keys: z.array(z.string()).min(4, "MintPY requires at least 4 keys"),
  data: z
    .array(z.string())
    .min(16, "MintPY requires at least 16 data elements"),
});

/**
 * YT.RedeemPY event
 * keys: [selector, caller, receiver, expiry]
 * data: [sy, pt, amount_py_redeemed(u256), amount_sy_returned(u256), py_index(u256), exchange_rate(u256)]
 */
export const ytRedeemPYSchema = baseEventSchema.extend({
  keys: z.array(z.string()).min(4, "RedeemPY requires at least 4 keys"),
  data: z
    .array(z.string())
    .min(10, "RedeemPY requires at least 10 data elements"),
});

/**
 * YT.RedeemPYPostExpiry event
 * keys: [selector, caller, receiver, expiry]
 * data: [amount_pt_redeemed(u256), amount_sy_returned(u256), pt, sy, final_py_index(u256), final_exchange_rate(u256)]
 */
export const ytRedeemPYPostExpirySchema = baseEventSchema.extend({
  keys: z
    .array(z.string())
    .min(4, "RedeemPYPostExpiry requires at least 4 keys"),
  data: z
    .array(z.string())
    .min(10, "RedeemPYPostExpiry requires at least 10 data elements"),
});

/**
 * YT.InterestClaimed event
 * keys: [selector, user, yt, expiry]
 * data: [amount_sy(u256), sy, yt_balance(u256), py_index_at_claim(u256), exchange_rate(u256)]
 */
export const ytInterestClaimedSchema = baseEventSchema.extend({
  keys: z.array(z.string()).min(4, "InterestClaimed requires at least 4 keys"),
  data: z
    .array(z.string())
    .min(9, "InterestClaimed requires at least 9 data elements"),
});

/**
 * YT.ExpiryReached event
 * keys: [selector, market, yt, pt]
 * data: [sy, expiry, final_exchange_rate(u256), final_py_index(u256),
 *        total_pt_supply(u256), total_yt_supply(u256), sy_reserve(u256), pt_reserve(u256)]
 */
export const ytExpiryReachedSchema = baseEventSchema.extend({
  keys: z.array(z.string()).min(4, "ExpiryReached requires at least 4 keys"),
  data: z
    .array(z.string())
    .min(14, "ExpiryReached requires at least 14 data elements"),
});

// ============================================================
// YT NEW EVENTS (8 schemas) - Pendle-style interest system
// ============================================================

/**
 * YT.TreasuryInterestRedeemed event
 * keys: [selector, yt, treasury]
 * data: [amount_sy(u256), sy, expiry_index(u256), current_index(u256), total_yt_supply(u256), timestamp]
 */
export const ytTreasuryInterestRedeemedSchema = baseEventSchema.extend({
  keys: z
    .array(z.string())
    .min(3, "TreasuryInterestRedeemed requires at least 3 keys"),
  data: z
    .array(z.string())
    .min(10, "TreasuryInterestRedeemed requires at least 10 data elements"),
});

/**
 * YT.InterestFeeRateSet event
 * keys: [selector, yt]
 * data: [old_rate(u256), new_rate(u256), timestamp]
 */
export const ytInterestFeeRateSetSchema = baseEventSchema.extend({
  keys: z
    .array(z.string())
    .min(2, "InterestFeeRateSet requires at least 2 keys"),
  data: z
    .array(z.string())
    .min(5, "InterestFeeRateSet requires at least 5 data elements"),
});

/**
 * YT.MintPYMulti event
 * keys: [selector, caller, expiry]
 * data: [total_sy_deposited(u256), total_py_minted(u256), receiver_count, timestamp]
 */
export const ytMintPYMultiSchema = baseEventSchema.extend({
  keys: z.array(z.string()).min(3, "MintPYMulti requires at least 3 keys"),
  data: z
    .array(z.string())
    .min(6, "MintPYMulti requires at least 6 data elements"),
});

/**
 * YT.RedeemPYMulti event
 * keys: [selector, caller, expiry]
 * data: [total_py_redeemed(u256), total_sy_returned(u256), receiver_count, timestamp]
 */
export const ytRedeemPYMultiSchema = baseEventSchema.extend({
  keys: z.array(z.string()).min(3, "RedeemPYMulti requires at least 3 keys"),
  data: z
    .array(z.string())
    .min(6, "RedeemPYMulti requires at least 6 data elements"),
});

/**
 * YT.RedeemPYWithInterest event
 * keys: [selector, caller, receiver, expiry]
 * data: [amount_py_redeemed(u256), amount_sy_from_redeem(u256), amount_interest_claimed(u256), timestamp]
 */
export const ytRedeemPYWithInterestSchema = baseEventSchema.extend({
  keys: z
    .array(z.string())
    .min(4, "RedeemPYWithInterest requires at least 4 keys"),
  data: z
    .array(z.string())
    .min(7, "RedeemPYWithInterest requires at least 7 data elements"),
});

/**
 * YT.PostExpiryDataSet event
 * keys: [selector, yt, pt]
 * data: [sy, expiry, first_py_index(u256), exchange_rate_at_init(u256), total_pt_supply(u256), total_yt_supply(u256), timestamp]
 */
export const ytPostExpiryDataSetSchema = baseEventSchema.extend({
  keys: z
    .array(z.string())
    .min(3, "PostExpiryDataSet requires at least 3 keys"),
  data: z
    .array(z.string())
    .min(11, "PostExpiryDataSet requires at least 11 data elements"),
});

/**
 * YT.PyIndexUpdated event
 * keys: [selector, yt]
 * data: [old_index(u256), new_index(u256), exchange_rate(u256), block_number, timestamp]
 */
export const ytPyIndexUpdatedSchema = baseEventSchema.extend({
  keys: z.array(z.string()).min(2, "PyIndexUpdated requires at least 2 keys"),
  data: z
    .array(z.string())
    .min(8, "PyIndexUpdated requires at least 8 data elements"),
});

/**
 * YT.FlashMintPY event
 * keys: [selector, caller, receiver]
 * data: [amount_py(u256), fee_sy(u256), sy, pt, timestamp]
 */
export const ytFlashMintPYSchema = baseEventSchema.extend({
  keys: z.array(z.string()).min(3, "FlashMintPY requires at least 3 keys"),
  data: z
    .array(z.string())
    .min(7, "FlashMintPY requires at least 7 data elements"),
});

// ============================================================
// MARKET EVENTS (8 schemas)
// ============================================================

/**
 * Market.Mint event
 * keys: [selector, sender, receiver, expiry]
 * data: [sy, pt, sy_amount(u256), pt_amount(u256), lp_amount(u256), exchange_rate(u256),
 *        implied_rate(u256), sy_reserve(u256), pt_reserve(u256), total_lp(u256)]
 */
export const marketMintSchema = baseEventSchema.extend({
  keys: z.array(z.string()).min(4, "Mint requires at least 4 keys"),
  data: z.array(z.string()).min(18, "Mint requires at least 18 data elements"),
});

/**
 * Market.Burn event
 * keys: [selector, sender, receiver, expiry]
 * data: [sy, pt, lp_amount(u256), sy_amount(u256), pt_amount(u256), exchange_rate(u256),
 *        implied_rate(u256), sy_reserve(u256), pt_reserve(u256), total_lp(u256)]
 */
export const marketBurnSchema = baseEventSchema.extend({
  keys: z.array(z.string()).min(4, "Burn requires at least 4 keys"),
  data: z.array(z.string()).min(18, "Burn requires at least 18 data elements"),
});

/**
 * Market.BurnWithReceivers event
 * keys: [selector, sender, receiver_sy, receiver_pt]
 * data: [expiry, sy, pt, lp_amount(u256), sy_amount(u256), pt_amount(u256), exchange_rate(u256),
 *        implied_rate(u256), sy_reserve_after(u256), pt_reserve_after(u256), total_lp_after(u256), timestamp]
 * Total: 3 + (8 * 2) + 1 = 20 data elements
 */
export const marketBurnWithReceiversSchema = baseEventSchema.extend({
  keys: z
    .array(z.string())
    .min(4, "BurnWithReceivers requires at least 4 keys"),
  data: z
    .array(z.string())
    .min(20, "BurnWithReceivers requires at least 20 data elements"),
});

/**
 * Market.Swap event
 * keys: [selector, sender, receiver, expiry]
 * data: [sy, pt, pt_in(u256), sy_in(u256), pt_out(u256), sy_out(u256),
 *        total_fee(u256), lp_fee(u256), reserve_fee(u256),
 *        implied_rate_before(u256), implied_rate_after(u256), exchange_rate(u256),
 *        sy_reserve_after(u256), pt_reserve_after(u256), timestamp]
 * Total: 2 + (7 * 2) + (5 * 2) + 1 = 27 data elements
 */
export const marketSwapSchema = baseEventSchema.extend({
  keys: z.array(z.string()).min(4, "Swap requires at least 4 keys"),
  data: z.array(z.string()).min(27, "Swap requires at least 27 data elements"),
});

/**
 * Market.ImpliedRateUpdated event
 * keys: [selector, market, expiry]
 * data: [old_rate(u256), new_rate(u256), timestamp, time_to_expiry, exchange_rate(u256),
 *        sy_reserve(u256), pt_reserve(u256), total_lp(u256)]
 */
export const marketImpliedRateUpdatedSchema = baseEventSchema.extend({
  keys: z
    .array(z.string())
    .min(3, "ImpliedRateUpdated requires at least 3 keys"),
  data: z
    .array(z.string())
    .min(14, "ImpliedRateUpdated requires at least 14 data elements"),
});

/**
 * Market.FeesCollected event
 * keys: [selector, collector, receiver, market]
 * data: [amount(u256), expiry, ln_fee_rate_root(u256), timestamp]
 */
export const marketFeesCollectedSchema = baseEventSchema.extend({
  keys: z.array(z.string()).min(4, "FeesCollected requires at least 4 keys"),
  data: z
    .array(z.string())
    .min(6, "FeesCollected requires at least 6 data elements"),
});

/**
 * Market.ScalarRootUpdated event
 * keys: [selector, market]
 * data: [old_value(u256), new_value(u256), timestamp]
 */
export const marketScalarRootUpdatedSchema = baseEventSchema.extend({
  keys: z
    .array(z.string())
    .min(2, "ScalarRootUpdated requires at least 2 keys"),
  data: z
    .array(z.string())
    .min(4, "ScalarRootUpdated requires at least 4 data elements"),
});

/**
 * Market.ReserveFeeTransferred event
 * keys: [selector, market, treasury, caller]
 * data: [amount(u256), expiry, timestamp]
 */
export const marketReserveFeeTransferredSchema = baseEventSchema.extend({
  keys: z
    .array(z.string())
    .min(4, "ReserveFeeTransferred requires at least 4 keys"),
  data: z
    .array(z.string())
    .min(4, "ReserveFeeTransferred requires at least 4 data elements"),
});

// ============================================================
// MARKET LP REWARD EVENTS (3 schemas)
// ============================================================

/**
 * Market LP RewardsClaimed event (from RewardManager component)
 * keys: [selector, user, reward_token]
 * data: [amount(u256), timestamp]
 */
export const marketRewardsClaimedSchema = baseEventSchema.extend({
  keys: z
    .array(z.string())
    .min(3, "Market RewardsClaimed requires at least 3 keys"),
  data: z
    .array(z.string())
    .min(3, "Market RewardsClaimed requires at least 3 data elements"),
});

/**
 * Market LP RewardIndexUpdated event (from RewardManager component)
 * keys: [selector, reward_token]
 * data: [old_index(u256), new_index(u256), rewards_added(u256), total_supply(u256), timestamp]
 */
export const marketRewardIndexUpdatedSchema = baseEventSchema.extend({
  keys: z
    .array(z.string())
    .min(2, "Market RewardIndexUpdated requires at least 2 keys"),
  data: z
    .array(z.string())
    .min(9, "Market RewardIndexUpdated requires at least 9 data elements"),
});

/**
 * Market LP RewardTokenAdded event (from RewardManager component)
 * keys: [selector, reward_token]
 * data: [index, timestamp]
 */
export const marketRewardTokenAddedSchema = baseEventSchema.extend({
  keys: z
    .array(z.string())
    .min(2, "Market RewardTokenAdded requires at least 2 keys"),
  data: z
    .array(z.string())
    .min(2, "Market RewardTokenAdded requires at least 2 data elements"),
});

/**
 * Market.Skim event
 * keys: [selector, market, caller]
 * data: [sy_excess(u256), pt_excess(u256), sy_reserve_after(u256), pt_reserve_after(u256), timestamp]
 * Total: (4 * 2) + 1 = 9 data elements
 */
export const marketSkimSchema = baseEventSchema.extend({
  keys: z.array(z.string()).min(3, "Skim requires at least 3 keys"),
  data: z.array(z.string()).min(9, "Skim requires at least 9 data elements"),
});

// ============================================================
// ROUTER EVENTS (7 schemas)
// ============================================================

/**
 * Router.MintPY event
 * keys: [selector, sender, receiver]
 * data: [yt, sy_in(u256), pt_out(u256), yt_out(u256)]
 */
export const routerMintPYSchema = baseEventSchema.extend({
  keys: z.array(z.string()).min(3, "MintPY requires at least 3 keys"),
  data: z.array(z.string()).min(7, "MintPY requires at least 7 data elements"),
});

/**
 * Router.RedeemPY event
 * keys: [selector, sender, receiver]
 * data: [yt, py_in(u256), sy_out(u256)]
 */
export const routerRedeemPYSchema = baseEventSchema.extend({
  keys: z.array(z.string()).min(3, "RedeemPY requires at least 3 keys"),
  data: z
    .array(z.string())
    .min(5, "RedeemPY requires at least 5 data elements"),
});

/**
 * Router.AddLiquidity event
 * keys: [selector, sender, receiver]
 * data: [market, sy_used(u256), pt_used(u256), lp_out(u256)]
 */
export const routerAddLiquiditySchema = baseEventSchema.extend({
  keys: z.array(z.string()).min(3, "AddLiquidity requires at least 3 keys"),
  data: z
    .array(z.string())
    .min(7, "AddLiquidity requires at least 7 data elements"),
});

/**
 * Router.RemoveLiquidity event
 * keys: [selector, sender, receiver]
 * data: [market, lp_in(u256), sy_out(u256), pt_out(u256)]
 */
export const routerRemoveLiquiditySchema = baseEventSchema.extend({
  keys: z.array(z.string()).min(3, "RemoveLiquidity requires at least 3 keys"),
  data: z
    .array(z.string())
    .min(7, "RemoveLiquidity requires at least 7 data elements"),
});

/**
 * Router.Swap event
 * keys: [selector, sender, receiver]
 * data: [market, sy_in(u256), pt_in(u256), sy_out(u256), pt_out(u256)]
 */
export const routerSwapSchema = baseEventSchema.extend({
  keys: z.array(z.string()).min(3, "Swap requires at least 3 keys"),
  data: z.array(z.string()).min(9, "Swap requires at least 9 data elements"),
});

/**
 * Router.SwapYT event
 * keys: [selector, sender, receiver]
 * data: [yt, market, sy_in(u256), yt_in(u256), sy_out(u256), yt_out(u256)]
 */
export const routerSwapYTSchema = baseEventSchema.extend({
  keys: z.array(z.string()).min(3, "SwapYT requires at least 3 keys"),
  data: z
    .array(z.string())
    .min(10, "SwapYT requires at least 10 data elements"),
});

/**
 * Router.RolloverLP event
 * keys: [selector, sender, receiver]
 * data: [market_old, market_new, lp_burned(u256), lp_minted(u256)]
 */
export const routerRolloverLPSchema = baseEventSchema.extend({
  keys: z.array(z.string()).min(3, "RolloverLP requires at least 3 keys"),
  data: z
    .array(z.string())
    .min(6, "RolloverLP requires at least 6 data elements"),
});

// ============================================================
// VALIDATION HELPERS
// ============================================================

/**
 * Context for validation errors
 */
export interface ValidationContext {
  indexer: string;
  eventName: string;
  blockNumber?: number;
  transactionHash?: string;
}

/**
 * Validate an event against a schema, returning null on failure
 *
 * This is the recommended way to validate events - it logs errors
 * but returns null instead of throwing, allowing the indexer to
 * continue processing other events.
 *
 * @param schema - Zod schema to validate against
 * @param event - Raw event data from Apibara
 * @param context - Context for error logging
 * @returns Validated event or null if validation failed
 *
 * @example
 * const validated = validateEvent(marketSwapSchema, event, {
 *   indexer: "market",
 *   eventName: "Swap",
 *   blockNumber,
 * });
 * if (!validated) continue; // Skip this event
 */
export function validateEvent<T>(
  schema: z.ZodType<T>,
  event: unknown,
  context: ValidationContext
): T | null {
  const result = schema.safeParse(event);

  if (!result.success) {
    logger.error(
      {
        indexer: context.indexer,
        eventName: context.eventName,
        blockNumber: context.blockNumber,
        transactionHash: context.transactionHash,
        errors: result.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
          code: issue.code,
        })),
        event:
          typeof event === "object" && event !== null
            ? {
                keysLength: (event as Record<string, unknown>)["keys"]
                  ? ((event as Record<string, unknown>)["keys"] as unknown[])
                      .length
                  : 0,
                dataLength: (event as Record<string, unknown>)["data"]
                  ? ((event as Record<string, unknown>)["data"] as unknown[])
                      .length
                  : 0,
              }
            : "unknown",
      },
      "Event validation failed"
    );
    return null;
  }

  return result.data;
}

/**
 * Validate an event against a schema, throwing on failure
 *
 * Use this when you want validation errors to bubble up.
 *
 * @param schema - Zod schema to validate against
 * @param event - Raw event data from Apibara
 * @param context - Context for error messages
 * @returns Validated event
 * @throws ZodError if validation fails
 */
export function validateEventStrict<T>(
  schema: z.ZodType<T>,
  event: unknown,
  context: ValidationContext
): T {
  try {
    return schema.parse(event);
  } catch (err) {
    if (err instanceof z.ZodError) {
      const errorDetails = err.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join(", ");
      throw new Error(
        `[${context.indexer}] ${context.eventName} validation failed: ${errorDetails}`
      );
    }
    throw err;
  }
}

// ============================================================
// SCHEMA EXPORTS MAP
// ============================================================

/**
 * Map of all event schemas by name for dynamic access
 */
export const eventSchemas = {
  // Factory
  YieldContractsCreated: factoryYieldContractsCreatedSchema,
  ClassHashesUpdated: factoryClassHashesUpdatedSchema,
  RewardFeeRateSet: factoryRewardFeeRateSetSchema,
  DefaultInterestFeeRateSet: factoryDefaultInterestFeeRateSetSchema,
  ExpiryDivisorSet: factoryExpiryDivisorSetSchema,
  SYWithRewardsDeployed: factorySYWithRewardsDeployedSchema,
  SYWithRewardsClassHashUpdated: factorySYWithRewardsClassHashUpdatedSchema,

  // MarketFactory
  MarketCreated: marketFactoryMarketCreatedSchema,
  MarketClassHashUpdated: marketFactoryClassHashUpdatedSchema,
  TreasuryUpdated: marketFactoryTreasuryUpdatedSchema,
  DefaultReserveFeeUpdated: marketFactoryDefaultReserveFeeUpdatedSchema,
  OverrideFeeSet: marketFactoryOverrideFeeSetSchema,
  DefaultRateImpactSensitivityUpdated:
    marketFactoryDefaultRateImpactSensitivityUpdatedSchema,
  YieldContractFactoryUpdated: marketFactoryYieldContractFactoryUpdatedSchema,

  // SY (core)
  Deposit: syDepositSchema,
  Redeem: syRedeemSchema,
  OracleRateUpdated: syOracleRateUpdatedSchema,

  // SY (Phase 4 monitoring)
  NegativeYieldDetected: syNegativeYieldDetectedSchema,
  Paused: syPausedSchema,
  Unpaused: syUnpausedSchema,
  RewardsClaimed: syRewardsClaimedSchema,
  RewardIndexUpdated: syRewardIndexUpdatedSchema,
  RewardTokenAdded: syRewardTokenAddedSchema,

  // YT (core)
  "YT.MintPY": ytMintPYSchema,
  "YT.RedeemPY": ytRedeemPYSchema,
  RedeemPYPostExpiry: ytRedeemPYPostExpirySchema,
  InterestClaimed: ytInterestClaimedSchema,
  ExpiryReached: ytExpiryReachedSchema,

  // YT (new events - Pendle-style interest system)
  TreasuryInterestRedeemed: ytTreasuryInterestRedeemedSchema,
  InterestFeeRateSet: ytInterestFeeRateSetSchema,
  MintPYMulti: ytMintPYMultiSchema,
  RedeemPYMulti: ytRedeemPYMultiSchema,
  RedeemPYWithInterest: ytRedeemPYWithInterestSchema,
  PostExpiryDataSet: ytPostExpiryDataSetSchema,
  PyIndexUpdated: ytPyIndexUpdatedSchema,
  FlashMintPY: ytFlashMintPYSchema,

  // Market
  Mint: marketMintSchema,
  Burn: marketBurnSchema,
  BurnWithReceivers: marketBurnWithReceiversSchema,
  "Market.Swap": marketSwapSchema,
  ImpliedRateUpdated: marketImpliedRateUpdatedSchema,
  FeesCollected: marketFeesCollectedSchema,
  ScalarRootUpdated: marketScalarRootUpdatedSchema,
  ReserveFeeTransferred: marketReserveFeeTransferredSchema,

  // Market LP Rewards
  "Market.RewardsClaimed": marketRewardsClaimedSchema,
  "Market.RewardIndexUpdated": marketRewardIndexUpdatedSchema,
  "Market.RewardTokenAdded": marketRewardTokenAddedSchema,
  "Market.Skim": marketSkimSchema,

  // Router
  "Router.MintPY": routerMintPYSchema,
  "Router.RedeemPY": routerRedeemPYSchema,
  AddLiquidity: routerAddLiquiditySchema,
  RemoveLiquidity: routerRemoveLiquiditySchema,
  "Router.Swap": routerSwapSchema,
  SwapYT: routerSwapYTSchema,
  RolloverLP: routerRolloverLPSchema,
} as const;
