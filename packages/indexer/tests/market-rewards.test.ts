/**
 * Market LP Rewards Indexer Unit Test
 *
 * Tests the transform logic for Market LP reward events:
 * - RewardsClaimed: LP rewards claimed by users
 * - RewardIndexUpdated: LP reward index updates (for APY calculation)
 * - RewardTokenAdded: New reward tokens added to market
 */

import { hash } from "starknet";
import { describe, expect, it } from "vitest";

import { matchSelector, readFeltAsNumber, readU256 } from "../src/lib/utils";

// Event selectors - Market LP Reward events
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
// Market LP Reward Event Handlers
// ============================================================

function handleRewardsClaimed(ctx: EventContext) {
  const { keys, data, address } = ctx;
  // RewardsClaimed: keys = [selector, user, reward_token]
  // data = [amount(u256), timestamp]
  return {
    event_type: "RewardsClaimed" as const,
    ...baseFields(ctx),
    market: address,
    user: keys[1] ?? "",
    reward_token: keys[2] ?? "",
    amount: readU256(data, 0),
    event_timestamp: readFeltAsNumber(data, 2),
  };
}

function handleRewardIndexUpdated(ctx: EventContext) {
  const { keys, data, address } = ctx;
  // RewardIndexUpdated: keys = [selector, reward_token]
  // data = [old_index(u256), new_index(u256), rewards_added(u256), total_supply(u256), timestamp]
  return {
    event_type: "RewardIndexUpdated" as const,
    ...baseFields(ctx),
    market: address,
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
  // RewardTokenAdded: keys = [selector, reward_token]
  // data = [index, timestamp]
  return {
    event_type: "RewardTokenAdded" as const,
    ...baseFields(ctx),
    market: address,
    reward_token: keys[1] ?? "",
    token_index: readFeltAsNumber(data, 0),
    event_timestamp: readFeltAsNumber(data, 1),
  };
}

// Handler return types
type MarketRewardEventResult =
  | ReturnType<typeof handleRewardsClaimed>
  | ReturnType<typeof handleRewardIndexUpdated>
  | ReturnType<typeof handleRewardTokenAdded>;

// Dispatch table: [selector, handler] pairs
const EVENT_HANDLERS: [
  string,
  (ctx: EventContext) => MarketRewardEventResult,
][] = [
  [REWARDS_CLAIMED, handleRewardsClaimed],
  [REWARD_INDEX_UPDATED, handleRewardIndexUpdated],
  [REWARD_TOKEN_ADDED, handleRewardTokenAdded],
];

// Transform function using dispatch table
function transformMarketRewardEvent(event: EventContext) {
  const eventKey = event.keys[0];
  const handler = EVENT_HANDLERS.find(([selector]) =>
    matchSelector(eventKey, selector)
  );
  return handler ? handler[1](event) : null;
}

describe("Market LP Rewards Indexer", () => {
  it("should transform RewardsClaimed event", () => {
    const event = {
      keys: [REWARDS_CLAIMED, "0xuser_address", "0xreward_token"],
      data: [
        "0x8ac7230489e80000", // amount low (10e18)
        "0x0", // amount high
        "0x12345678", // timestamp
      ],
      address: "0xmarket_address",
      transactionHash: "0xclaimed123",
      blockNumber: 4643700,
      blockTimestamp: "1234568200",
    };

    const result = transformMarketRewardEvent(event);

    expect(result).toEqual({
      event_type: "RewardsClaimed",
      block_number: 4643700,
      block_timestamp: "1234568200",
      transaction_hash: "0xclaimed123",
      market: "0xmarket_address",
      user: "0xuser_address",
      reward_token: "0xreward_token",
      amount: "10000000000000000000",
      event_timestamp: 305419896,
    });
  });

  it("should transform RewardsClaimed event with large amount", () => {
    const event = {
      keys: [REWARDS_CLAIMED, "0xlp_holder", "0xstrk_token"],
      data: [
        "0x3635c9adc5dea00000", // amount low (1000e18)
        "0x0", // amount high
        "0x65432100", // timestamp
      ],
      address: "0xmarket_pt_steth",
      transactionHash: "0xclaimed_large",
      blockNumber: 5000000,
      blockTimestamp: "1700000000",
    };

    const result = transformMarketRewardEvent(event);

    expect(result).toEqual({
      event_type: "RewardsClaimed",
      block_number: 5000000,
      block_timestamp: "1700000000",
      transaction_hash: "0xclaimed_large",
      market: "0xmarket_pt_steth",
      user: "0xlp_holder",
      reward_token: "0xstrk_token",
      amount: "1000000000000000000000",
      event_timestamp: 1698898176,
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
      address: "0xmarket_address",
      transactionHash: "0xindex123",
      blockNumber: 4643750,
      blockTimestamp: "1234568250",
    };

    const result = transformMarketRewardEvent(event);

    expect(result).toEqual({
      event_type: "RewardIndexUpdated",
      block_number: 4643750,
      block_timestamp: "1234568250",
      transaction_hash: "0xindex123",
      market: "0xmarket_address",
      reward_token: "0xreward_token",
      old_index: "1000000000000000000",
      new_index: "1001349930194173952",
      rewards_added: "10000000000000000000",
      total_supply: "1000000000000000000000",
      event_timestamp: 305419896,
    });
  });

  it("should transform RewardIndexUpdated event with zero old_index (first update)", () => {
    const event = {
      keys: [REWARD_INDEX_UPDATED, "0xnew_reward_token"],
      data: [
        "0x0", // old_index low (0 - first update)
        "0x0", // old_index high
        "0xde0b6b3a7640000", // new_index low (1e18)
        "0x0", // new_index high
        "0x56bc75e2d63100000", // rewards_added low (100e18)
        "0x0", // rewards_added high
        "0x6c6b935b8bbd400000", // total_supply low (2000e18)
        "0x0", // total_supply high
        "0x65000000", // timestamp
      ],
      address: "0xmarket_pt_usdc",
      transactionHash: "0xfirst_index",
      blockNumber: 4700000,
      blockTimestamp: "1694649600",
    };

    const result = transformMarketRewardEvent(event);

    expect(result).toEqual({
      event_type: "RewardIndexUpdated",
      block_number: 4700000,
      block_timestamp: "1694649600",
      transaction_hash: "0xfirst_index",
      market: "0xmarket_pt_usdc",
      reward_token: "0xnew_reward_token",
      old_index: "0",
      new_index: "1000000000000000000",
      rewards_added: "100000000000000000000",
      total_supply: "2000000000000000000000",
      event_timestamp: 1694498816,
    });
  });

  it("should transform RewardTokenAdded event", () => {
    const event = {
      keys: [REWARD_TOKEN_ADDED, "0xnew_reward_token"],
      data: [
        "0x0", // token_index (0 = first reward token)
        "0x12345678", // timestamp
      ],
      address: "0xmarket_address",
      transactionHash: "0xtoken_added123",
      blockNumber: 4643800,
      blockTimestamp: "1234568300",
    };

    const result = transformMarketRewardEvent(event);

    expect(result).toEqual({
      event_type: "RewardTokenAdded",
      block_number: 4643800,
      block_timestamp: "1234568300",
      transaction_hash: "0xtoken_added123",
      market: "0xmarket_address",
      reward_token: "0xnew_reward_token",
      token_index: 0,
      event_timestamp: 305419896,
    });
  });

  it("should transform RewardTokenAdded event with non-zero index", () => {
    const event = {
      keys: [REWARD_TOKEN_ADDED, "0xsecond_reward_token"],
      data: [
        "0x1", // token_index (1 = second reward token)
        "0x65432100", // timestamp
      ],
      address: "0xmarket_pt_eth",
      transactionHash: "0xsecond_token",
      blockNumber: 4800000,
      blockTimestamp: "1700000000",
    };

    const result = transformMarketRewardEvent(event);

    expect(result).toEqual({
      event_type: "RewardTokenAdded",
      block_number: 4800000,
      block_timestamp: "1700000000",
      transaction_hash: "0xsecond_token",
      market: "0xmarket_pt_eth",
      reward_token: "0xsecond_reward_token",
      token_index: 1,
      event_timestamp: 1698898176,
    });
  });

  it("should return null for unknown events", () => {
    const event = {
      keys: ["0xunknown"],
      data: [],
      address: "0xmarket_address",
      transactionHash: "0x123",
      blockNumber: 1,
      blockTimestamp: "0",
    };

    const result = transformMarketRewardEvent(event);
    expect(result).toBeNull();
  });

  it("should handle events with missing optional keys gracefully", () => {
    const event = {
      keys: [REWARDS_CLAIMED], // Missing user and reward_token keys
      data: [
        "0xde0b6b3a7640000", // amount low
        "0x0", // amount high
        "0x12345678", // timestamp
      ],
      address: "0xmarket_address",
      transactionHash: "0xmissing_keys",
      blockNumber: 4643850,
      blockTimestamp: "1234568350",
    };

    const result = transformMarketRewardEvent(event);

    expect(result).toEqual({
      event_type: "RewardsClaimed",
      block_number: 4643850,
      block_timestamp: "1234568350",
      transaction_hash: "0xmissing_keys",
      market: "0xmarket_address",
      user: "",
      reward_token: "",
      amount: "1000000000000000000",
      event_timestamp: 305419896,
    });
  });
});
