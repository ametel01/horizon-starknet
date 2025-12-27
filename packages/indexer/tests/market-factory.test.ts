/**
 * MarketFactory Indexer Unit Test
 *
 * Tests the transform logic for MarketCreated and MarketClassHashUpdated events
 */

import { describe, expect, it } from "vitest";
import { hash } from "starknet";
import { matchSelector, decodeByteArray, readU256 } from "../src/lib/utils";

// Event selectors
const MARKET_CREATED = hash.getSelectorFromName("MarketCreated");
const MARKET_CLASS_HASH_UPDATED = hash.getSelectorFromName(
  "MarketClassHashUpdated",
);

// Transform function (extracted from indexer logic)
function transformMarketFactoryEvent(event: {
  keys: string[];
  data: string[];
  transactionHash: string;
  blockNumber: number;
  blockTimestamp: string;
}) {
  const { keys, data, transactionHash, blockNumber, blockTimestamp } = event;
  const eventKey = keys[0];

  if (matchSelector(eventKey, MARKET_CREATED)) {
    const pt = keys[1];
    const expiry = Number(BigInt(keys[2] ?? "0"));
    const market = data[0];
    const creator = data[1];
    // u256 fields use 2 felts each (low, high)
    const scalarRoot = readU256(data, 2);
    const initialAnchor = readU256(data, 4);
    const feeRate = readU256(data, 6);
    const sy = data[8];
    const yt = data[9];
    const underlying = data[10];
    const underlyingSymbol = decodeByteArray(data, 11);
    const initialExchangeRate = readU256(data, 14);
    const marketIndex = Number(data[17] ?? "0");

    return {
      event_type: "MarketCreated",
      block_number: blockNumber,
      block_timestamp: blockTimestamp,
      transaction_hash: transactionHash,
      pt: pt ?? "",
      expiry,
      market: market ?? "",
      creator: creator ?? "",
      scalar_root: scalarRoot,
      initial_anchor: initialAnchor,
      fee_rate: feeRate,
      sy: sy ?? "",
      yt: yt ?? "",
      underlying: underlying ?? "",
      underlying_symbol: underlyingSymbol,
      initial_exchange_rate: initialExchangeRate,
      market_index: marketIndex,
    };
  } else if (matchSelector(eventKey, MARKET_CLASS_HASH_UPDATED)) {
    const oldClassHash = data[0];
    const newClassHash = data[1];

    return {
      event_type: "MarketClassHashUpdated",
      block_number: blockNumber,
      block_timestamp: blockTimestamp,
      transaction_hash: transactionHash,
      old_class_hash: oldClassHash ?? "",
      new_class_hash: newClassHash ?? "",
    };
  }

  return null;
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
        "0xmarket_address", // market
        "0xcreator", // creator
        "0xde0b6b3a7640000", // scalar_root (1e18)
        "0x0",
        "0xde0b6b3a7640000", // initial_anchor
        "0x0",
        "0x5f5e100", // fee_rate (100_000_000 = 1%)
        "0x0",
        "0xsy_address", // sy
        "0xyt_address", // yt
        "0xunderlying", // underlying
        // ByteArray for "ETH": [array_len, pending_word, pending_word_len]
        "0x0", // array_len (no full 31-byte chunks)
        "0x455448", // pending_word "ETH"
        "0x3", // pending_word_len (3 bytes)
        "0xde0b6b3a7640000", // initial_exchange_rate (low)
        "0x0", // initial_exchange_rate (high)
        "0x12345678", // timestamp
        "0x1", // market_index
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
      fee_rate: "100000000",
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
