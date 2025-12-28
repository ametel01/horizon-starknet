/**
 * Factory Indexer Unit Test
 *
 * Tests the transform logic for YieldContractsCreated and ClassHashesUpdated events
 */

import { hash } from "starknet";
import { describe, expect, it } from "vitest";

import { matchSelector, decodeByteArray, readU256 } from "../src/lib/utils";

// Event selectors
const YIELD_CONTRACTS_CREATED = hash.getSelectorFromName(
  "YieldContractsCreated",
);
const CLASS_HASHES_UPDATED = hash.getSelectorFromName("ClassHashesUpdated");

// Transform function (extracted from indexer logic)
function transformFactoryEvent(event: {
  keys: string[];
  data: string[];
  transactionHash: string;
  blockNumber: number;
  blockTimestamp: string;
}) {
  const { keys, data, transactionHash, blockNumber, blockTimestamp } = event;
  const eventKey = keys[0];

  if (matchSelector(eventKey, YIELD_CONTRACTS_CREATED)) {
    const sy = keys[1];
    const expiry = keys[2];
    const pt = data[0];
    const yt = data[1];
    const creator = data[2];
    const underlying = data[3];
    const underlyingSymbol = decodeByteArray(data, 4);
    // data[7-8] = initial_exchange_rate (u256), data[9] = timestamp, data[10] = market_index
    const initialExchangeRate = readU256(data, 7);
    const marketIndex = data[10] ?? "0";

    return {
      event_type: "YieldContractsCreated",
      block_number: blockNumber,
      block_timestamp: blockTimestamp,
      transaction_hash: transactionHash,
      sy,
      expiry,
      pt,
      yt,
      creator,
      underlying,
      underlying_symbol: underlyingSymbol,
      initial_exchange_rate: initialExchangeRate,
      market_index: Number(marketIndex),
    };
  } else if (matchSelector(eventKey, CLASS_HASHES_UPDATED)) {
    const ytClassHash = data[0];
    const ptClassHash = data[1];

    return {
      event_type: "ClassHashesUpdated",
      block_number: blockNumber,
      block_timestamp: blockTimestamp,
      transaction_hash: transactionHash,
      yt_class_hash: ytClassHash,
      pt_class_hash: ptClassHash,
    };
  }

  return null;
}

describe("Factory Indexer", () => {
  it("should transform YieldContractsCreated event", () => {
    const event = {
      keys: [
        YIELD_CONTRACTS_CREATED,
        "0x0601a6717bedf8010f68ec2e4993ea12c208ed949ed76b33b616add725dbc15c", // sy
        "0x6774a5d5", // expiry
      ],
      data: [
        "0x123456", // pt
        "0x789abc", // yt
        "0xdef012", // creator
        "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7", // underlying (ETH)
        // ByteArray for "ETH": [array_len, pending_word, pending_word_len]
        "0x0", // array_len (no full 31-byte chunks)
        "0x455448", // pending_word "ETH"
        "0x3", // pending_word_len (3 bytes)
        "0xde0b6b3a7640000", // initial_exchange_rate (1e18)
        "0x0",
        "0x0",
        "0x1", // market_index
      ],
      transactionHash: "0xabc123",
      blockNumber: 4643353,
      blockTimestamp: "1234567890",
    };

    const result = transformFactoryEvent(event);

    expect(result).toEqual({
      event_type: "YieldContractsCreated",
      block_number: 4643353,
      block_timestamp: "1234567890",
      transaction_hash: "0xabc123",
      sy: "0x0601a6717bedf8010f68ec2e4993ea12c208ed949ed76b33b616add725dbc15c",
      expiry: "0x6774a5d5",
      pt: "0x123456",
      yt: "0x789abc",
      creator: "0xdef012",
      underlying:
        "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7",
      underlying_symbol: "ETH",
      initial_exchange_rate: "1000000000000000000",
      market_index: 1,
    });
  });

  it("should transform ClassHashesUpdated event", () => {
    const event = {
      keys: [CLASS_HASHES_UPDATED],
      data: ["0xyt_class_hash", "0xpt_class_hash"],
      transactionHash: "0xdef456",
      blockNumber: 4643400,
      blockTimestamp: "1234567900",
    };

    const result = transformFactoryEvent(event);

    expect(result).toEqual({
      event_type: "ClassHashesUpdated",
      block_number: 4643400,
      block_timestamp: "1234567900",
      transaction_hash: "0xdef456",
      yt_class_hash: "0xyt_class_hash",
      pt_class_hash: "0xpt_class_hash",
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

    const result = transformFactoryEvent(event);

    expect(result).toBeNull();
  });
});
