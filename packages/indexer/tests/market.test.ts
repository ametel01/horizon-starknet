/**
 * Market (AMM) Indexer Unit Test
 *
 * Tests the transform logic for Mint, Burn, Swap, ImpliedRateUpdated,
 * FeesCollected events
 */

import { hash } from "starknet";
import { describe, expect, it } from "vitest";

import { matchSelector, readU256 } from "../src/lib/utils";

// Event selectors
const MINT = hash.getSelectorFromName("Mint");
const BURN = hash.getSelectorFromName("Burn");
const SWAP = hash.getSelectorFromName("Swap");
const IMPLIED_RATE_UPDATED = hash.getSelectorFromName("ImpliedRateUpdated");
const FEES_COLLECTED = hash.getSelectorFromName("FeesCollected");

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

// Event-specific handlers
function handleMint(ctx: EventContext) {
  const { keys, data, address } = ctx;
  return {
    event_type: "Mint" as const,
    ...baseFields(ctx),
    sender: keys[1] ?? "",
    receiver: keys[2] ?? "",
    expiry: Number(BigInt(keys[3] ?? "0")),
    market: address,
    sy: data[0] ?? "",
    pt: data[1] ?? "",
    sy_amount: readU256(data, 2),
    pt_amount: readU256(data, 4),
    lp_amount: readU256(data, 6),
    exchange_rate: readU256(data, 8),
    implied_rate: readU256(data, 10),
    sy_reserve_after: readU256(data, 12),
    pt_reserve_after: readU256(data, 14),
    total_lp_after: readU256(data, 16),
  };
}

function handleBurn(ctx: EventContext) {
  const { keys, data, address } = ctx;
  return {
    event_type: "Burn" as const,
    ...baseFields(ctx),
    sender: keys[1] ?? "",
    receiver: keys[2] ?? "",
    expiry: Number(BigInt(keys[3] ?? "0")),
    market: address,
    sy: data[0] ?? "",
    pt: data[1] ?? "",
    lp_amount: readU256(data, 2),
    sy_amount: readU256(data, 4),
    pt_amount: readU256(data, 6),
    exchange_rate: readU256(data, 8),
    implied_rate: readU256(data, 10),
    sy_reserve_after: readU256(data, 12),
    pt_reserve_after: readU256(data, 14),
    total_lp_after: readU256(data, 16),
  };
}

function handleSwap(ctx: EventContext) {
  const { keys, data, address } = ctx;
  return {
    event_type: "Swap" as const,
    ...baseFields(ctx),
    sender: keys[1] ?? "",
    receiver: keys[2] ?? "",
    expiry: Number(BigInt(keys[3] ?? "0")),
    market: address,
    sy: data[0] ?? "",
    pt: data[1] ?? "",
    pt_in: readU256(data, 2),
    sy_in: readU256(data, 4),
    pt_out: readU256(data, 6),
    sy_out: readU256(data, 8),
    fee: readU256(data, 10),
    implied_rate_before: readU256(data, 12),
    implied_rate_after: readU256(data, 14),
    exchange_rate: readU256(data, 16),
    sy_reserve_after: readU256(data, 18),
    pt_reserve_after: readU256(data, 20),
  };
}

function handleImpliedRateUpdated(ctx: EventContext) {
  const { keys, data, address } = ctx;
  return {
    event_type: "ImpliedRateUpdated" as const,
    ...baseFields(ctx),
    market: keys[1] ?? address,
    expiry: Number(BigInt(keys[2] ?? "0")),
    old_rate: readU256(data, 0),
    new_rate: readU256(data, 2),
    time_to_expiry: Number(BigInt(data[4] ?? "0")),
    exchange_rate: readU256(data, 5),
    sy_reserve: readU256(data, 7),
    pt_reserve: readU256(data, 9),
    total_lp: readU256(data, 11),
  };
}

function handleFeesCollected(ctx: EventContext) {
  const { keys, data, address } = ctx;
  return {
    event_type: "FeesCollected" as const,
    ...baseFields(ctx),
    collector: keys[1] ?? "",
    receiver: keys[2] ?? "",
    market: keys[3] ?? address,
    amount: readU256(data, 0),
    expiry: Number(BigInt(data[2] ?? "0")),
    fee_rate: readU256(data, 3),
  };
}

// Handler return types
type MarketEventResult =
  | ReturnType<typeof handleMint>
  | ReturnType<typeof handleBurn>
  | ReturnType<typeof handleSwap>
  | ReturnType<typeof handleImpliedRateUpdated>
  | ReturnType<typeof handleFeesCollected>;

// Dispatch table: [selector, handler] pairs
const EVENT_HANDLERS: [string, (ctx: EventContext) => MarketEventResult][] = [
  [MINT, handleMint],
  [BURN, handleBurn],
  [SWAP, handleSwap],
  [IMPLIED_RATE_UPDATED, handleImpliedRateUpdated],
  [FEES_COLLECTED, handleFeesCollected],
];

// Transform function using dispatch table
function transformMarketEvent(event: EventContext) {
  const eventKey = event.keys[0];
  const handler = EVENT_HANDLERS.find(([selector]) =>
    matchSelector(eventKey, selector)
  );
  return handler ? handler[1](event) : null;
}

describe("Market Indexer", () => {
  it("should transform Mint event", () => {
    const event = {
      keys: [MINT, "0xsender", "0xreceiver", "0x6774a5d5"],
      data: [
        "0xsy_address", // sy
        "0xpt_address", // pt
        "0xde0b6b3a7640000", // sy_amount low
        "0x0", // sy_amount high
        "0xde0b6b3a7640000", // pt_amount low
        "0x0", // pt_amount high
        "0x1bc16d674ec80000", // lp_amount low (2e18)
        "0x0", // lp_amount high
        "0xde0b6b3a7640000", // exchange_rate low
        "0x0", // exchange_rate high
        "0x6f05b59d3b20000", // implied_rate low (0.5e18)
        "0x0", // implied_rate high
        "0xde0b6b3a7640000", // sy_reserve low
        "0x0", // sy_reserve high
        "0xde0b6b3a7640000", // pt_reserve low
        "0x0", // pt_reserve high
        "0x1bc16d674ec80000", // total_lp low
        "0x0", // total_lp high
      ],
      address: "0xmarket_address",
      transactionHash: "0xmint123",
      blockNumber: 4643400,
      blockTimestamp: "1234567890",
    };

    const result = transformMarketEvent(event);

    expect(result).toEqual({
      event_type: "Mint",
      block_number: 4643400,
      block_timestamp: "1234567890",
      transaction_hash: "0xmint123",
      sender: "0xsender",
      receiver: "0xreceiver",
      expiry: 1735697877,
      market: "0xmarket_address",
      sy: "0xsy_address",
      pt: "0xpt_address",
      sy_amount: "1000000000000000000",
      pt_amount: "1000000000000000000",
      lp_amount: "2000000000000000000",
      exchange_rate: "1000000000000000000",
      implied_rate: "500000000000000000",
      sy_reserve_after: "1000000000000000000",
      pt_reserve_after: "1000000000000000000",
      total_lp_after: "2000000000000000000",
    });
  });

  it("should transform Burn event", () => {
    const event = {
      keys: [BURN, "0xsender", "0xreceiver", "0x6774a5d5"],
      data: [
        "0xsy_address", // sy
        "0xpt_address", // pt
        "0xde0b6b3a7640000", // lp_amount low
        "0x0", // lp_amount high
        "0x6f05b59d3b20000", // sy_amount low (0.5e18)
        "0x0", // sy_amount high
        "0x6f05b59d3b20000", // pt_amount low
        "0x0", // pt_amount high
        "0xde0b6b3a7640000", // exchange_rate low
        "0x0", // exchange_rate high
        "0x6f05b59d3b20000", // implied_rate low
        "0x0", // implied_rate high
        "0x6f05b59d3b20000", // sy_reserve low
        "0x0", // sy_reserve high
        "0x6f05b59d3b20000", // pt_reserve low
        "0x0", // pt_reserve high
        "0xde0b6b3a7640000", // total_lp low
        "0x0", // total_lp high
      ],
      address: "0xmarket_address",
      transactionHash: "0xburn123",
      blockNumber: 4643450,
      blockTimestamp: "1234567950",
    };

    const result = transformMarketEvent(event);

    expect(result).toEqual({
      event_type: "Burn",
      block_number: 4643450,
      block_timestamp: "1234567950",
      transaction_hash: "0xburn123",
      sender: "0xsender",
      receiver: "0xreceiver",
      expiry: 1735697877,
      market: "0xmarket_address",
      sy: "0xsy_address",
      pt: "0xpt_address",
      lp_amount: "1000000000000000000",
      sy_amount: "500000000000000000",
      pt_amount: "500000000000000000",
      exchange_rate: "1000000000000000000",
      implied_rate: "500000000000000000",
      sy_reserve_after: "500000000000000000",
      pt_reserve_after: "500000000000000000",
      total_lp_after: "1000000000000000000",
    });
  });

  it("should transform Swap event", () => {
    const event = {
      keys: [SWAP, "0xsender", "0xreceiver", "0x6774a5d5"],
      data: [
        "0xsy_address", // sy
        "0xpt_address", // pt
        "0xde0b6b3a7640000", // pt_in low
        "0x0", // pt_in high
        "0x0", // sy_in low
        "0x0", // sy_in high
        "0x0", // pt_out low
        "0x0", // pt_out high
        "0xde0b6b3a7640000", // sy_out low
        "0x0", // sy_out high
        "0x2386f26fc10000", // fee low (0.01e18 = 1%)
        "0x0", // fee high
        "0x6f05b59d3b20000", // implied_rate_before low
        "0x0", // implied_rate_before high
        "0x6f05b59d3b20000", // implied_rate_after low
        "0x0", // implied_rate_after high
        "0xde0b6b3a7640000", // exchange_rate low
        "0x0", // exchange_rate high
        "0xde0b6b3a7640000", // sy_reserve low
        "0x0", // sy_reserve high
        "0xde0b6b3a7640000", // pt_reserve low
        "0x0", // pt_reserve high
      ],
      address: "0xmarket_address",
      transactionHash: "0xswap123",
      blockNumber: 4643500,
      blockTimestamp: "1234568000",
    };

    const result = transformMarketEvent(event);

    expect(result).toEqual({
      event_type: "Swap",
      block_number: 4643500,
      block_timestamp: "1234568000",
      transaction_hash: "0xswap123",
      sender: "0xsender",
      receiver: "0xreceiver",
      expiry: 1735697877,
      market: "0xmarket_address",
      sy: "0xsy_address",
      pt: "0xpt_address",
      pt_in: "1000000000000000000",
      sy_in: "0",
      pt_out: "0",
      sy_out: "1000000000000000000",
      fee: "10000000000000000",
      implied_rate_before: "500000000000000000",
      implied_rate_after: "500000000000000000",
      exchange_rate: "1000000000000000000",
      sy_reserve_after: "1000000000000000000",
      pt_reserve_after: "1000000000000000000",
    });
  });

  it("should transform ImpliedRateUpdated event", () => {
    const event = {
      keys: [IMPLIED_RATE_UPDATED, "0xmarket_address", "0x6774a5d5"],
      data: [
        "0x6f05b59d3b20000", // old_rate low
        "0x0", // old_rate high
        "0x8ac7230489e80000", // new_rate low (10e18)
        "0x0", // new_rate high
        "0x278d00", // time_to_expiry (2592000 = 30 days)
        "0xde0b6b3a7640000", // exchange_rate low
        "0x0", // exchange_rate high
        "0xde0b6b3a7640000", // sy_reserve low
        "0x0", // sy_reserve high
        "0xde0b6b3a7640000", // pt_reserve low
        "0x0", // pt_reserve high
        "0x1bc16d674ec80000", // total_lp low
        "0x0", // total_lp high
      ],
      address: "0xmarket_address",
      transactionHash: "0xrate123",
      blockNumber: 4643550,
      blockTimestamp: "1234568050",
    };

    const result = transformMarketEvent(event);

    expect(result).toEqual({
      event_type: "ImpliedRateUpdated",
      block_number: 4643550,
      block_timestamp: "1234568050",
      transaction_hash: "0xrate123",
      market: "0xmarket_address",
      expiry: 1735697877,
      old_rate: "500000000000000000",
      new_rate: "10000000000000000000",
      time_to_expiry: 2592000,
      exchange_rate: "1000000000000000000",
      sy_reserve: "1000000000000000000",
      pt_reserve: "1000000000000000000",
      total_lp: "2000000000000000000",
    });
  });

  it("should transform FeesCollected event", () => {
    const event = {
      keys: [FEES_COLLECTED, "0xcollector", "0xreceiver", "0xmarket_address"],
      data: [
        "0x2386f26fc10000", // amount low (0.01e18)
        "0x0", // amount high
        "0x6774a5d5", // expiry
        "0x5f5e100", // fee_rate low (100_000_000)
        "0x0", // fee_rate high
      ],
      address: "0xmarket_address",
      transactionHash: "0xfees123",
      blockNumber: 4643600,
      blockTimestamp: "1234568100",
    };

    const result = transformMarketEvent(event);

    expect(result).toEqual({
      event_type: "FeesCollected",
      block_number: 4643600,
      block_timestamp: "1234568100",
      transaction_hash: "0xfees123",
      collector: "0xcollector",
      receiver: "0xreceiver",
      market: "0xmarket_address",
      amount: "10000000000000000",
      expiry: 1735697877,
      fee_rate: "100000000",
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

    const result = transformMarketEvent(event);
    expect(result).toBeNull();
  });
});
