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
const RESERVE_FEE_TRANSFERRED = hash.getSelectorFromName(
  "ReserveFeeTransferred"
);
const SCALAR_ROOT_UPDATED = hash.getSelectorFromName("ScalarRootUpdated");

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
    // Fee fields (3 u256 = 6 data positions)
    total_fee: readU256(data, 10),
    lp_fee: readU256(data, 12),
    reserve_fee: readU256(data, 14),
    // Remaining fields shifted by 4 positions (2 new u256 fields)
    implied_rate_before: readU256(data, 16),
    implied_rate_after: readU256(data, 18),
    exchange_rate: readU256(data, 20),
    sy_reserve_after: readU256(data, 22),
    pt_reserve_after: readU256(data, 24),
  };
}

function handleImpliedRateUpdated(ctx: EventContext) {
  const { keys, data, address } = ctx;
  // Event data layout:
  // data[0-1]: old_rate (u256)
  // data[2-3]: new_rate (u256)
  // data[4]: timestamp (u64)
  // data[5]: time_to_expiry (u64)
  // data[6-7]: exchange_rate (u256)
  // data[8-9]: sy_reserve (u256)
  // data[10-11]: pt_reserve (u256)
  // data[12-13]: total_lp (u256)
  return {
    event_type: "ImpliedRateUpdated" as const,
    ...baseFields(ctx),
    market: keys[1] ?? address,
    expiry: Number(BigInt(keys[2] ?? "0")),
    old_rate: readU256(data, 0),
    new_rate: readU256(data, 2),
    time_to_expiry: Number(BigInt(data[5] ?? "0")),
    exchange_rate: readU256(data, 6),
    sy_reserve: readU256(data, 8),
    pt_reserve: readU256(data, 10),
    total_lp: readU256(data, 12),
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
    ln_fee_rate_root: readU256(data, 3),
    // Note: data[5] is timestamp, not used in test but present in event
  };
}

function handleReserveFeeTransferred(ctx: EventContext) {
  const { keys, data, address } = ctx;
  // ReserveFeeTransferred: keys = [selector, market, treasury, caller]
  // data = [amount(u256), expiry, timestamp]
  return {
    event_type: "ReserveFeeTransferred" as const,
    ...baseFields(ctx),
    market: keys[1] ?? address,
    treasury: keys[2] ?? "",
    caller: keys[3] ?? "",
    amount: readU256(data, 0),
    expiry: Number(BigInt(data[2] ?? "0")),
    timestamp: Number(BigInt(data[3] ?? "0")),
  };
}

function handleScalarRootUpdated(ctx: EventContext) {
  const { keys, data, address } = ctx;
  // ScalarRootUpdated: keys = [selector, market]
  // data = [old_value(u256), new_value(u256), timestamp]
  return {
    event_type: "ScalarRootUpdated" as const,
    ...baseFields(ctx),
    market: keys[1] ?? address,
    old_value: readU256(data, 0),
    new_value: readU256(data, 2),
  };
}

// Handler return types
type MarketEventResult =
  | ReturnType<typeof handleMint>
  | ReturnType<typeof handleBurn>
  | ReturnType<typeof handleSwap>
  | ReturnType<typeof handleImpliedRateUpdated>
  | ReturnType<typeof handleFeesCollected>
  | ReturnType<typeof handleReserveFeeTransferred>
  | ReturnType<typeof handleScalarRootUpdated>;

// Dispatch table: [selector, handler] pairs
const EVENT_HANDLERS: [string, (ctx: EventContext) => MarketEventResult][] = [
  [MINT, handleMint],
  [BURN, handleBurn],
  [SWAP, handleSwap],
  [IMPLIED_RATE_UPDATED, handleImpliedRateUpdated],
  [FEES_COLLECTED, handleFeesCollected],
  [RESERVE_FEE_TRANSFERRED, handleReserveFeeTransferred],
  [SCALAR_ROOT_UPDATED, handleScalarRootUpdated],
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
        "0xsy_address", // sy (data[0])
        "0xpt_address", // pt (data[1])
        "0xde0b6b3a7640000", // pt_in low (data[2])
        "0x0", // pt_in high (data[3])
        "0x0", // sy_in low (data[4])
        "0x0", // sy_in high (data[5])
        "0x0", // pt_out low (data[6])
        "0x0", // pt_out high (data[7])
        "0xde0b6b3a7640000", // sy_out low (data[8])
        "0x0", // sy_out high (data[9])
        // Fee breakdown: total_fee, lp_fee, reserve_fee (3 u256 = 6 felts)
        "0x2386f26fc10000", // total_fee low (0.01e18) (data[10])
        "0x0", // total_fee high (data[11])
        "0x1c6bf526340000", // lp_fee low (0.008e18 = 80% of fee) (data[12])
        "0x0", // lp_fee high (data[13])
        "0x71afd498d0000", // reserve_fee low (0.002e18 = 20% of fee) (data[14])
        "0x0", // reserve_fee high (data[15])
        // Remaining fields shifted by 4 positions
        "0x6f05b59d3b20000", // implied_rate_before low (data[16])
        "0x0", // implied_rate_before high (data[17])
        "0x6f05b59d3b20000", // implied_rate_after low (data[18])
        "0x0", // implied_rate_after high (data[19])
        "0xde0b6b3a7640000", // exchange_rate low (data[20])
        "0x0", // exchange_rate high (data[21])
        "0xde0b6b3a7640000", // sy_reserve low (data[22])
        "0x0", // sy_reserve high (data[23])
        "0xde0b6b3a7640000", // pt_reserve low (data[24])
        "0x0", // pt_reserve high (data[25])
        "0x12345678", // timestamp (data[26])
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
      total_fee: "10000000000000000",
      lp_fee: "8000000000000000",
      reserve_fee: "2000000000000000",
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
        "0x6f05b59d3b20000", // old_rate low (data[0])
        "0x0", // old_rate high (data[1])
        "0x8ac7230489e80000", // new_rate low (10e18) (data[2])
        "0x0", // new_rate high (data[3])
        "0x12345678", // timestamp (data[4])
        "0x278d00", // time_to_expiry (2592000 = 30 days) (data[5])
        "0xde0b6b3a7640000", // exchange_rate low (data[6])
        "0x0", // exchange_rate high (data[7])
        "0xde0b6b3a7640000", // sy_reserve low (data[8])
        "0x0", // sy_reserve high (data[9])
        "0xde0b6b3a7640000", // pt_reserve low (data[10])
        "0x0", // pt_reserve high (data[11])
        "0x1bc16d674ec80000", // total_lp low (data[12])
        "0x0", // total_lp high (data[13])
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
        "0x2386f26fc10000", // amount low (0.01e18) (data[0])
        "0x0", // amount high (data[1])
        "0x6774a5d5", // expiry (data[2])
        "0x5f5e100", // ln_fee_rate_root low (100_000_000) (data[3])
        "0x0", // ln_fee_rate_root high (data[4])
        "0x12345678", // timestamp (data[5])
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
      ln_fee_rate_root: "100000000",
    });
  });

  it("should transform ReserveFeeTransferred event", () => {
    const event = {
      keys: [
        RESERVE_FEE_TRANSFERRED,
        "0xmarket_address",
        "0xtreasury_address",
        "0xcaller_address",
      ],
      data: [
        "0x2386f26fc10000", // amount low (0.01e18) (data[0])
        "0x0", // amount high (data[1])
        "0x6774a5d5", // expiry (data[2])
        "0x12345678", // timestamp (data[3])
      ],
      address: "0xmarket_address",
      transactionHash: "0xreserve123",
      blockNumber: 4643650,
      blockTimestamp: "1234568150",
    };

    const result = transformMarketEvent(event);

    expect(result).toEqual({
      event_type: "ReserveFeeTransferred",
      block_number: 4643650,
      block_timestamp: "1234568150",
      transaction_hash: "0xreserve123",
      market: "0xmarket_address",
      treasury: "0xtreasury_address",
      caller: "0xcaller_address",
      amount: "10000000000000000",
      expiry: 1735697877,
      timestamp: 305419896,
    });
  });

  it("should transform ScalarRootUpdated event", () => {
    const event = {
      keys: [SCALAR_ROOT_UPDATED, "0xmarket_address"],
      data: [
        "0xde0b6b3a7640000", // old_value low (1e18) (data[0])
        "0x0", // old_value high (data[1])
        "0x1bc16d674ec80000", // new_value low (2e18) (data[2])
        "0x0", // new_value high (data[3])
        "0x12345678", // timestamp (data[4])
      ],
      address: "0xmarket_address",
      transactionHash: "0xscalar123",
      blockNumber: 4643700,
      blockTimestamp: "1234568200",
    };

    const result = transformMarketEvent(event);

    expect(result).toEqual({
      event_type: "ScalarRootUpdated",
      block_number: 4643700,
      block_timestamp: "1234568200",
      transaction_hash: "0xscalar123",
      market: "0xmarket_address",
      old_value: "1000000000000000000",
      new_value: "2000000000000000000",
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
