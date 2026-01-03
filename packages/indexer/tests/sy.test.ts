/**
 * SY (Standardized Yield) Indexer Unit Test
 *
 * Tests the transform logic for Deposit, Redeem, OracleRateUpdated events
 * and Phase 4 events: NegativeYieldDetected, Paused, Unpaused,
 * RewardsClaimed, RewardIndexUpdated, RewardTokenAdded
 */

import { hash } from "starknet";
import { describe, expect, it } from "vitest";

import { matchSelector, readFeltAsNumber, readU256 } from "../src/lib/utils";

// Event selectors - Core SY events
const DEPOSIT = hash.getSelectorFromName("Deposit");
const REDEEM = hash.getSelectorFromName("Redeem");
const ORACLE_RATE_UPDATED = hash.getSelectorFromName("OracleRateUpdated");

// Event selectors - Phase 4 Monitoring events
const NEGATIVE_YIELD_DETECTED = hash.getSelectorFromName(
  "NegativeYieldDetected"
);
const PAUSED = hash.getSelectorFromName("Paused");
const UNPAUSED = hash.getSelectorFromName("Unpaused");

// Event selectors - Phase 4 Reward events
const REWARDS_CLAIMED = hash.getSelectorFromName("RewardsClaimed");
const REWARD_INDEX_UPDATED = hash.getSelectorFromName("RewardIndexUpdated");
const REWARD_TOKEN_ADDED = hash.getSelectorFromName("RewardTokenAdded");

// Shared event context type
interface EventContext {
  keys: string[];
  data: string[];
  address: string;
  transactionHash: string;
  blockNumber: number;
  blockTimestamp: string;
}

// Base fields shared by all event results
function baseFields(ctx: EventContext) {
  return {
    block_number: ctx.blockNumber,
    block_timestamp: ctx.blockTimestamp,
    transaction_hash: ctx.transactionHash,
  };
}

// ============================================================
// Core SY Event Handlers
// ============================================================

function handleDeposit(ctx: EventContext) {
  const { keys, data, address } = ctx;
  return {
    event_type: "Deposit" as const,
    ...baseFields(ctx),
    caller: keys[1] ?? "",
    receiver: keys[2] ?? "",
    underlying: keys[3] ?? "",
    sy: address,
    amount_deposited: readU256(data, 0),
    amount_sy_minted: readU256(data, 2),
    exchange_rate: readU256(data, 4),
    total_supply_after: readU256(data, 6),
  };
}

function handleRedeem(ctx: EventContext) {
  const { keys, data, address } = ctx;
  return {
    event_type: "Redeem" as const,
    ...baseFields(ctx),
    caller: keys[1] ?? "",
    receiver: keys[2] ?? "",
    underlying: keys[3] ?? "",
    sy: address,
    amount_sy_burned: readU256(data, 0),
    amount_redeemed: readU256(data, 2),
    exchange_rate: readU256(data, 4),
    total_supply_after: readU256(data, 6),
  };
}

function handleOracleRateUpdated(ctx: EventContext) {
  const { keys, data, address } = ctx;
  return {
    event_type: "OracleRateUpdated" as const,
    ...baseFields(ctx),
    sy: keys[1] ?? address,
    underlying: keys[2] ?? "",
    old_rate: readU256(data, 0),
    new_rate: readU256(data, 2),
    rate_change_bps: readU256(data, 4),
  };
}

// ============================================================
// Phase 4: Monitoring Event Handlers
// ============================================================

function handleNegativeYieldDetected(ctx: EventContext) {
  const { keys, data, address } = ctx;
  return {
    event_type: "NegativeYieldDetected" as const,
    ...baseFields(ctx),
    sy: keys[1] ?? address,
    underlying: keys[2] ?? "",
    watermark_rate: readU256(data, 0),
    current_rate: readU256(data, 2),
    rate_drop_bps: readU256(data, 4),
    event_timestamp: readFeltAsNumber(data, 6),
  };
}

function handlePaused(ctx: EventContext) {
  const { data, address } = ctx;
  return {
    event_type: "Paused" as const,
    ...baseFields(ctx),
    sy: address,
    account: data[0] ?? "",
    is_paused: true,
  };
}

function handleUnpaused(ctx: EventContext) {
  const { data, address } = ctx;
  return {
    event_type: "Unpaused" as const,
    ...baseFields(ctx),
    sy: address,
    account: data[0] ?? "",
    is_paused: false,
  };
}

// ============================================================
// Phase 4: Reward Manager Event Handlers
// ============================================================

function handleRewardsClaimed(ctx: EventContext) {
  const { keys, data, address } = ctx;
  return {
    event_type: "RewardsClaimed" as const,
    ...baseFields(ctx),
    sy: address,
    user: keys[1] ?? "",
    reward_token: keys[2] ?? "",
    amount: readU256(data, 0),
    event_timestamp: readFeltAsNumber(data, 2),
  };
}

function handleRewardIndexUpdated(ctx: EventContext) {
  const { keys, data, address } = ctx;
  return {
    event_type: "RewardIndexUpdated" as const,
    ...baseFields(ctx),
    sy: address,
    reward_token: keys[1] ?? "",
    old_index: readU256(data, 0),
    new_index: readU256(data, 2),
    rewards_added: readU256(data, 4),
    total_supply: readU256(data, 6),
    event_timestamp: readFeltAsNumber(data, 8),
  };
}

function handleRewardTokenAdded(ctx: EventContext) {
  const { keys, data, address } = ctx;
  return {
    event_type: "RewardTokenAdded" as const,
    ...baseFields(ctx),
    sy: address,
    reward_token: keys[1] ?? "",
    token_index: readFeltAsNumber(data, 0),
    event_timestamp: readFeltAsNumber(data, 1),
  };
}

// Handler return types
type SYEventResult =
  | ReturnType<typeof handleDeposit>
  | ReturnType<typeof handleRedeem>
  | ReturnType<typeof handleOracleRateUpdated>
  | ReturnType<typeof handleNegativeYieldDetected>
  | ReturnType<typeof handlePaused>
  | ReturnType<typeof handleUnpaused>
  | ReturnType<typeof handleRewardsClaimed>
  | ReturnType<typeof handleRewardIndexUpdated>
  | ReturnType<typeof handleRewardTokenAdded>;

// Dispatch table: [selector, handler] pairs
const EVENT_HANDLERS: [string, (ctx: EventContext) => SYEventResult][] = [
  [DEPOSIT, handleDeposit],
  [REDEEM, handleRedeem],
  [ORACLE_RATE_UPDATED, handleOracleRateUpdated],
  [NEGATIVE_YIELD_DETECTED, handleNegativeYieldDetected],
  [PAUSED, handlePaused],
  [UNPAUSED, handleUnpaused],
  [REWARDS_CLAIMED, handleRewardsClaimed],
  [REWARD_INDEX_UPDATED, handleRewardIndexUpdated],
  [REWARD_TOKEN_ADDED, handleRewardTokenAdded],
];

// Transform function using dispatch table
function transformSYEvent(event: EventContext) {
  const eventKey = event.keys[0];
  const handler = EVENT_HANDLERS.find(([selector]) =>
    matchSelector(eventKey, selector)
  );
  return handler ? handler[1](event) : null;
}

describe("SY Indexer", () => {
  it("should transform Deposit event", () => {
    const event = {
      keys: [DEPOSIT, "0xcaller", "0xreceiver", "0xunderlying"],
      data: [
        "0xde0b6b3a7640000", // amount_deposited low (1e18)
        "0x0", // amount_deposited high
        "0xde0b6b3a7640000", // amount_sy_minted low
        "0x0", // amount_sy_minted high
        "0xde0b6b3a7640000", // exchange_rate low
        "0x0", // exchange_rate high
        "0x1bc16d674ec80000", // total_supply_after low (2e18)
        "0x0", // total_supply_after high
      ],
      address: "0xsy_address",
      transactionHash: "0xdeposit123",
      blockNumber: 4643400,
      blockTimestamp: "1234567890",
    };

    const result = transformSYEvent(event);

    expect(result).toEqual({
      event_type: "Deposit",
      block_number: 4643400,
      block_timestamp: "1234567890",
      transaction_hash: "0xdeposit123",
      caller: "0xcaller",
      receiver: "0xreceiver",
      underlying: "0xunderlying",
      sy: "0xsy_address",
      amount_deposited: "1000000000000000000",
      amount_sy_minted: "1000000000000000000",
      exchange_rate: "1000000000000000000",
      total_supply_after: "2000000000000000000",
    });
  });

  it("should transform Redeem event", () => {
    const event = {
      keys: [REDEEM, "0xcaller", "0xreceiver", "0xunderlying"],
      data: [
        "0xde0b6b3a7640000", // amount_sy_burned low
        "0x0", // amount_sy_burned high
        "0xde0b6b3a7640000", // amount_redeemed low
        "0x0", // amount_redeemed high
        "0xde0b6b3a7640000", // exchange_rate low
        "0x0", // exchange_rate high
        "0xde0b6b3a7640000", // total_supply_after low
        "0x0", // total_supply_after high
      ],
      address: "0xsy_address",
      transactionHash: "0xredeem123",
      blockNumber: 4643450,
      blockTimestamp: "1234567950",
    };

    const result = transformSYEvent(event);

    expect(result).toEqual({
      event_type: "Redeem",
      block_number: 4643450,
      block_timestamp: "1234567950",
      transaction_hash: "0xredeem123",
      caller: "0xcaller",
      receiver: "0xreceiver",
      underlying: "0xunderlying",
      sy: "0xsy_address",
      amount_sy_burned: "1000000000000000000",
      amount_redeemed: "1000000000000000000",
      exchange_rate: "1000000000000000000",
      total_supply_after: "1000000000000000000",
    });
  });

  it("should transform OracleRateUpdated event", () => {
    const event = {
      keys: [ORACLE_RATE_UPDATED, "0xsy_address", "0xunderlying"],
      data: [
        "0xde0b6b3a7640000", // old_rate low
        "0x0", // old_rate high
        "0xde58274c5160000", // new_rate low (1.01e18)
        "0x0", // new_rate high
        "0x64", // rate_change_bps low (100 = 1%)
        "0x0", // rate_change_bps high
      ],
      address: "0xsy_address",
      transactionHash: "0xoracle123",
      blockNumber: 4643500,
      blockTimestamp: "1234568000",
    };

    const result = transformSYEvent(event);

    expect(result).toEqual({
      event_type: "OracleRateUpdated",
      block_number: 4643500,
      block_timestamp: "1234568000",
      transaction_hash: "0xoracle123",
      sy: "0xsy_address",
      underlying: "0xunderlying",
      old_rate: "1000000000000000000",
      new_rate: "1001349930194173952",
      rate_change_bps: "100",
    });
  });

  it("should return null for unknown events", () => {
    const event = {
      keys: ["0xunknown"],
      data: [],
      address: "0xsy_address",
      transactionHash: "0x123",
      blockNumber: 1,
      blockTimestamp: "0",
    };

    const result = transformSYEvent(event);
    expect(result).toBeNull();
  });

  // ============================================================
  // Phase 4: Monitoring Events
  // ============================================================

  it("should transform NegativeYieldDetected event", () => {
    const event = {
      keys: [NEGATIVE_YIELD_DETECTED, "0xsy_address", "0xunderlying"],
      data: [
        "0xde0b6b3a7640000", // watermark_rate low (1e18)
        "0x0", // watermark_rate high
        "0xd8d726b7177a800", // current_rate low (0.98e18 - 2% drop)
        "0x0", // current_rate high
        "0xc8", // rate_drop_bps low (200 = 2%)
        "0x0", // rate_drop_bps high
        "0x12345678", // timestamp
      ],
      address: "0xsy_address",
      transactionHash: "0xnegative123",
      blockNumber: 4643550,
      blockTimestamp: "1234568050",
    };

    const result = transformSYEvent(event);

    expect(result).toEqual({
      event_type: "NegativeYieldDetected",
      block_number: 4643550,
      block_timestamp: "1234568050",
      transaction_hash: "0xnegative123",
      sy: "0xsy_address",
      underlying: "0xunderlying",
      watermark_rate: "1000000000000000000",
      current_rate: "976562500000000000",
      rate_drop_bps: "200",
      event_timestamp: 305419896, // 0x12345678
    });
  });

  it("should transform Paused event", () => {
    const event = {
      keys: [PAUSED],
      data: ["0xadmin_account"],
      address: "0xsy_address",
      transactionHash: "0xpaused123",
      blockNumber: 4643600,
      blockTimestamp: "1234568100",
    };

    const result = transformSYEvent(event);

    expect(result).toEqual({
      event_type: "Paused",
      block_number: 4643600,
      block_timestamp: "1234568100",
      transaction_hash: "0xpaused123",
      sy: "0xsy_address",
      account: "0xadmin_account",
      is_paused: true,
    });
  });

  it("should transform Unpaused event", () => {
    const event = {
      keys: [UNPAUSED],
      data: ["0xadmin_account"],
      address: "0xsy_address",
      transactionHash: "0xunpaused123",
      blockNumber: 4643650,
      blockTimestamp: "1234568150",
    };

    const result = transformSYEvent(event);

    expect(result).toEqual({
      event_type: "Unpaused",
      block_number: 4643650,
      block_timestamp: "1234568150",
      transaction_hash: "0xunpaused123",
      sy: "0xsy_address",
      account: "0xadmin_account",
      is_paused: false,
    });
  });

  // ============================================================
  // Phase 4: Reward Manager Events (SYWithRewards only)
  // ============================================================

  it("should transform RewardsClaimed event", () => {
    const event = {
      keys: [REWARDS_CLAIMED, "0xuser_address", "0xreward_token"],
      data: [
        "0x8ac7230489e80000", // amount low (10e18)
        "0x0", // amount high
        "0x12345678", // timestamp
      ],
      address: "0xsy_with_rewards",
      transactionHash: "0xclaimed123",
      blockNumber: 4643700,
      blockTimestamp: "1234568200",
    };

    const result = transformSYEvent(event);

    expect(result).toEqual({
      event_type: "RewardsClaimed",
      block_number: 4643700,
      block_timestamp: "1234568200",
      transaction_hash: "0xclaimed123",
      sy: "0xsy_with_rewards",
      user: "0xuser_address",
      reward_token: "0xreward_token",
      amount: "10000000000000000000",
      event_timestamp: 305419896,
    });
  });

  it("should transform RewardIndexUpdated event", () => {
    const event = {
      keys: [REWARD_INDEX_UPDATED, "0xreward_token"],
      data: [
        "0xde0b6b3a7640000", // old_index low (1e18)
        "0x0", // old_index high
        "0xde58274c5160000", // new_index low (1.01e18)
        "0x0", // new_index high
        "0x8ac7230489e80000", // rewards_added low (10e18)
        "0x0", // rewards_added high
        "0x3635c9adc5dea00000", // total_supply low (1000e18)
        "0x0", // total_supply high
        "0x12345678", // timestamp
      ],
      address: "0xsy_with_rewards",
      transactionHash: "0xindex123",
      blockNumber: 4643750,
      blockTimestamp: "1234568250",
    };

    const result = transformSYEvent(event);

    expect(result).toEqual({
      event_type: "RewardIndexUpdated",
      block_number: 4643750,
      block_timestamp: "1234568250",
      transaction_hash: "0xindex123",
      sy: "0xsy_with_rewards",
      reward_token: "0xreward_token",
      old_index: "1000000000000000000",
      new_index: "1001349930194173952",
      rewards_added: "10000000000000000000",
      total_supply: "1000000000000000000000",
      event_timestamp: 305419896,
    });
  });

  it("should transform RewardTokenAdded event", () => {
    const event = {
      keys: [REWARD_TOKEN_ADDED, "0xnew_reward_token"],
      data: [
        "0x2", // token_index (2 = third reward token)
        "0x12345678", // timestamp
      ],
      address: "0xsy_with_rewards",
      transactionHash: "0xtoken_added123",
      blockNumber: 4643800,
      blockTimestamp: "1234568300",
    };

    const result = transformSYEvent(event);

    expect(result).toEqual({
      event_type: "RewardTokenAdded",
      block_number: 4643800,
      block_timestamp: "1234568300",
      transaction_hash: "0xtoken_added123",
      sy: "0xsy_with_rewards",
      reward_token: "0xnew_reward_token",
      token_index: 2,
      event_timestamp: 305419896,
    });
  });
});
