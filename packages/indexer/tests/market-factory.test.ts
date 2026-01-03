/**
 * MarketFactory Indexer Unit Test
 *
 * Tests the transform logic for MarketCreated, MarketClassHashUpdated,
 * TreasuryUpdated, DefaultReserveFeeUpdated, and OverrideFeeSet events
 */

import { hash } from "starknet";
import { describe, expect, it } from "vitest";

import { decodeByteArray, matchSelector, readU256 } from "../src/lib/utils";

// Event selectors
const MARKET_CREATED = hash.getSelectorFromName("MarketCreated");
const MARKET_CLASS_HASH_UPDATED = hash.getSelectorFromName(
  "MarketClassHashUpdated"
);
const TREASURY_UPDATED = hash.getSelectorFromName("TreasuryUpdated");
const DEFAULT_RESERVE_FEE_UPDATED = hash.getSelectorFromName(
  "DefaultReserveFeeUpdated"
);
const OVERRIDE_FEE_SET = hash.getSelectorFromName("OverrideFeeSet");

// Shared event context type
interface EventContext {
  keys: string[];
  data: string[];
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
function handleMarketCreated(ctx: EventContext) {
  const { keys, data } = ctx;
  const pt = keys[1];
  const expiry = Number(BigInt(keys[2] ?? "0"));
  const market = data[0];
  const creator = data[1];
  const scalarRoot = readU256(data, 2);
  const initialAnchor = readU256(data, 4);
  const lnFeeRateRoot = readU256(data, 6);
  const reserveFeePercent = Number(data[8] ?? "0");
  const sy = data[9];
  const yt = data[10];
  const underlying = data[11];
  const underlyingSymbol = decodeByteArray(data, 12);
  const initialExchangeRate = readU256(data, 15);
  const marketIndex = Number(data[18] ?? "0");

  return {
    event_type: "MarketCreated" as const,
    ...baseFields(ctx),
    pt: pt ?? "",
    expiry,
    market: market ?? "",
    creator: creator ?? "",
    scalar_root: scalarRoot,
    initial_anchor: initialAnchor,
    ln_fee_rate_root: lnFeeRateRoot,
    reserve_fee_percent: reserveFeePercent,
    sy: sy ?? "",
    yt: yt ?? "",
    underlying: underlying ?? "",
    underlying_symbol: underlyingSymbol,
    initial_exchange_rate: initialExchangeRate,
    market_index: marketIndex,
  };
}

function handleMarketClassHashUpdated(ctx: EventContext) {
  const { data } = ctx;
  return {
    event_type: "MarketClassHashUpdated" as const,
    ...baseFields(ctx),
    old_class_hash: data[0] ?? "",
    new_class_hash: data[1] ?? "",
  };
}

function handleTreasuryUpdated(ctx: EventContext) {
  const { data } = ctx;
  return {
    event_type: "TreasuryUpdated" as const,
    ...baseFields(ctx),
    old_treasury: data[0] ?? "",
    new_treasury: data[1] ?? "",
  };
}

function handleDefaultReserveFeeUpdated(ctx: EventContext) {
  const { data } = ctx;
  return {
    event_type: "DefaultReserveFeeUpdated" as const,
    ...baseFields(ctx),
    old_percent: Number(data[0] ?? "0"),
    new_percent: Number(data[1] ?? "0"),
  };
}

function handleOverrideFeeSet(ctx: EventContext) {
  const { keys, data } = ctx;
  return {
    event_type: "OverrideFeeSet" as const,
    ...baseFields(ctx),
    router: keys[1] ?? "",
    market: keys[2] ?? "",
    ln_fee_rate_root: readU256(data, 0),
  };
}

// Handler return types
type MarketFactoryEventResult =
  | ReturnType<typeof handleMarketCreated>
  | ReturnType<typeof handleMarketClassHashUpdated>
  | ReturnType<typeof handleTreasuryUpdated>
  | ReturnType<typeof handleDefaultReserveFeeUpdated>
  | ReturnType<typeof handleOverrideFeeSet>;

// Dispatch table: [selector, handler] pairs
const EVENT_HANDLERS: [
  string,
  (ctx: EventContext) => MarketFactoryEventResult,
][] = [
  [MARKET_CREATED, handleMarketCreated],
  [MARKET_CLASS_HASH_UPDATED, handleMarketClassHashUpdated],
  [TREASURY_UPDATED, handleTreasuryUpdated],
  [DEFAULT_RESERVE_FEE_UPDATED, handleDefaultReserveFeeUpdated],
  [OVERRIDE_FEE_SET, handleOverrideFeeSet],
];

// Transform function using dispatch table
function transformMarketFactoryEvent(event: EventContext) {
  const eventKey = event.keys[0];
  const handler = EVENT_HANDLERS.find(([selector]) =>
    matchSelector(eventKey, selector)
  );
  return handler ? handler[1](event) : null;
}

describe("MarketFactory Indexer", () => {
  it("should transform MarketCreated event", () => {
    const event = {
      keys: [
        MARKET_CREATED,
        "0x123456", // pt
        "0x6774a5d5", // expiry
      ],
      data: [
        "0xmarket_address", // market (data[0])
        "0xcreator", // creator (data[1])
        "0xde0b6b3a7640000", // scalar_root low (data[2])
        "0x0", // scalar_root high (data[3])
        "0xde0b6b3a7640000", // initial_anchor low (data[4])
        "0x0", // initial_anchor high (data[5])
        "0x5f5e100", // ln_fee_rate_root low (data[6])
        "0x0", // ln_fee_rate_root high (data[7])
        "0x5", // reserve_fee_percent (5%) (data[8])
        "0xsy_address", // sy (data[9])
        "0xyt_address", // yt (data[10])
        "0xunderlying", // underlying (data[11])
        // ByteArray for "ETH": [array_len, pending_word, pending_word_len]
        "0x0", // array_len (data[12])
        "0x455448", // pending_word "ETH" (data[13])
        "0x3", // pending_word_len (data[14])
        "0xde0b6b3a7640000", // initial_exchange_rate low (data[15])
        "0x0", // initial_exchange_rate high (data[16])
        "0x12345678", // timestamp (data[17])
        "0x1", // market_index (data[18])
      ],
      transactionHash: "0xabc123",
      blockNumber: 4643359,
      blockTimestamp: "1234567890",
    };

    const result = transformMarketFactoryEvent(event);

    expect(result).toEqual({
      event_type: "MarketCreated",
      block_number: 4643359,
      block_timestamp: "1234567890",
      transaction_hash: "0xabc123",
      pt: "0x123456",
      expiry: 1735697877, // 0x6774a5d5
      market: "0xmarket_address",
      creator: "0xcreator",
      scalar_root: "1000000000000000000",
      initial_anchor: "1000000000000000000",
      ln_fee_rate_root: "100000000",
      reserve_fee_percent: 5,
      sy: "0xsy_address",
      yt: "0xyt_address",
      underlying: "0xunderlying",
      underlying_symbol: "ETH",
      initial_exchange_rate: "1000000000000000000",
      market_index: 1,
    });
  });

  it("should transform MarketClassHashUpdated event", () => {
    const event = {
      keys: [MARKET_CLASS_HASH_UPDATED],
      data: ["0xold_class_hash", "0xnew_class_hash"],
      transactionHash: "0xdef456",
      blockNumber: 4643400,
      blockTimestamp: "1234567900",
    };

    const result = transformMarketFactoryEvent(event);

    expect(result).toEqual({
      event_type: "MarketClassHashUpdated",
      block_number: 4643400,
      block_timestamp: "1234567900",
      transaction_hash: "0xdef456",
      old_class_hash: "0xold_class_hash",
      new_class_hash: "0xnew_class_hash",
    });
  });

  it("should transform TreasuryUpdated event", () => {
    const event = {
      keys: [TREASURY_UPDATED],
      data: ["0xold_treasury_address", "0xnew_treasury_address"],
      transactionHash: "0xtreasury123",
      blockNumber: 4643450,
      blockTimestamp: "1234567950",
    };

    const result = transformMarketFactoryEvent(event);

    expect(result).toEqual({
      event_type: "TreasuryUpdated",
      block_number: 4643450,
      block_timestamp: "1234567950",
      transaction_hash: "0xtreasury123",
      old_treasury: "0xold_treasury_address",
      new_treasury: "0xnew_treasury_address",
    });
  });

  it("should transform DefaultReserveFeeUpdated event", () => {
    const event = {
      keys: [DEFAULT_RESERVE_FEE_UPDATED],
      data: [
        "0x14", // old_percent (20 decimal)
        "0x1e", // new_percent (30 decimal)
      ],
      transactionHash: "0xfee123",
      blockNumber: 4643500,
      blockTimestamp: "1234568000",
    };

    const result = transformMarketFactoryEvent(event);

    expect(result).toEqual({
      event_type: "DefaultReserveFeeUpdated",
      block_number: 4643500,
      block_timestamp: "1234568000",
      transaction_hash: "0xfee123",
      old_percent: 20,
      new_percent: 30,
    });
  });

  it("should transform OverrideFeeSet event", () => {
    const event = {
      keys: [OVERRIDE_FEE_SET, "0xrouter_address", "0xmarket_address"],
      data: [
        "0x5f5e100", // ln_fee_rate_root low (100_000_000)
        "0x0", // ln_fee_rate_root high
      ],
      transactionHash: "0xoverride123",
      blockNumber: 4643550,
      blockTimestamp: "1234568050",
    };

    const result = transformMarketFactoryEvent(event);

    expect(result).toEqual({
      event_type: "OverrideFeeSet",
      block_number: 4643550,
      block_timestamp: "1234568050",
      transaction_hash: "0xoverride123",
      router: "0xrouter_address",
      market: "0xmarket_address",
      ln_fee_rate_root: "100000000",
    });
  });

  it("should return null for unknown events", () => {
    const event = {
      keys: ["0xunknown_selector"],
      data: [],
      transactionHash: "0x123",
      blockNumber: 1,
      blockTimestamp: "0",
    };

    const result = transformMarketFactoryEvent(event);
    expect(result).toBeNull();
  });
});
