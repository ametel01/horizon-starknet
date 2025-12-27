/**
 * Router Indexer Unit Test
 *
 * Tests the transform logic for router events
 */

import { hash } from "starknet";
import { describe, expect, it } from "vitest";

import { matchSelector, readU256 } from "../src/lib/utils";

// Event selectors
const MINT_PY = hash.getSelectorFromName("MintPY");
const REDEEM_PY = hash.getSelectorFromName("RedeemPY");
const ADD_LIQUIDITY = hash.getSelectorFromName("AddLiquidity");
const REMOVE_LIQUIDITY = hash.getSelectorFromName("RemoveLiquidity");
const SWAP = hash.getSelectorFromName("Swap");
const SWAP_YT = hash.getSelectorFromName("SwapYT");

// Transform function (extracted from indexer logic)
function transformRouterEvent(event: {
  keys: string[];
  data: string[];
  transactionHash: string;
  blockNumber: number;
  blockTimestamp: string;
}) {
  const { keys, data, transactionHash, blockNumber, blockTimestamp } = event;
  const eventKey = keys[0];
  const sender = keys[1] ?? "";
  const receiver = keys[2] ?? "";

  if (matchSelector(eventKey, MINT_PY)) {
    return {
      event_type: "MintPY",
      block_number: blockNumber,
      block_timestamp: blockTimestamp,
      transaction_hash: transactionHash,
      sender,
      receiver,
      yt: data[0],
      sy_in: readU256(data, 1),
      pt_out: readU256(data, 3),
      yt_out: readU256(data, 5),
    };
  } else if (matchSelector(eventKey, REDEEM_PY)) {
    return {
      event_type: "RedeemPY",
      block_number: blockNumber,
      block_timestamp: blockTimestamp,
      transaction_hash: transactionHash,
      sender,
      receiver,
      yt: data[0],
      py_in: readU256(data, 1),
      sy_out: readU256(data, 3),
    };
  } else if (matchSelector(eventKey, ADD_LIQUIDITY)) {
    return {
      event_type: "AddLiquidity",
      block_number: blockNumber,
      block_timestamp: blockTimestamp,
      transaction_hash: transactionHash,
      sender,
      receiver,
      market: data[0],
      sy_used: readU256(data, 1),
      pt_used: readU256(data, 3),
      lp_out: readU256(data, 5),
    };
  } else if (matchSelector(eventKey, REMOVE_LIQUIDITY)) {
    return {
      event_type: "RemoveLiquidity",
      block_number: blockNumber,
      block_timestamp: blockTimestamp,
      transaction_hash: transactionHash,
      sender,
      receiver,
      market: data[0],
      lp_in: readU256(data, 1),
      sy_out: readU256(data, 3),
      pt_out: readU256(data, 5),
    };
  } else if (matchSelector(eventKey, SWAP)) {
    return {
      event_type: "Swap",
      block_number: blockNumber,
      block_timestamp: blockTimestamp,
      transaction_hash: transactionHash,
      sender,
      receiver,
      market: data[0],
      sy_in: readU256(data, 1),
      pt_in: readU256(data, 3),
      sy_out: readU256(data, 5),
      pt_out: readU256(data, 7),
    };
  } else if (matchSelector(eventKey, SWAP_YT)) {
    return {
      event_type: "SwapYT",
      block_number: blockNumber,
      block_timestamp: blockTimestamp,
      transaction_hash: transactionHash,
      sender,
      receiver,
      yt: data[0],
      market: data[1],
      sy_in: readU256(data, 2),
      yt_in: readU256(data, 4),
      sy_out: readU256(data, 6),
      yt_out: readU256(data, 8),
    };
  }

  return null;
}

describe("Router Indexer", () => {
  it("should transform MintPY event", () => {
    const event = {
      keys: [MINT_PY, "0xsender", "0xreceiver"],
      data: [
        "0xyt_address",
        "0xde0b6b3a7640000", // sy_in low (1e18)
        "0x0", // sy_in high
        "0xde0b6b3a7640000", // pt_out low
        "0x0", // pt_out high
        "0xde0b6b3a7640000", // yt_out low
        "0x0", // yt_out high
      ],
      transactionHash: "0xabc123",
      blockNumber: 4643400,
      blockTimestamp: "1234567890",
    };

    const result = transformRouterEvent(event);

    expect(result).toEqual({
      event_type: "MintPY",
      block_number: 4643400,
      block_timestamp: "1234567890",
      transaction_hash: "0xabc123",
      sender: "0xsender",
      receiver: "0xreceiver",
      yt: "0xyt_address",
      sy_in: "1000000000000000000",
      pt_out: "1000000000000000000",
      yt_out: "1000000000000000000",
    });
  });

  it("should transform Swap event", () => {
    const event = {
      keys: [SWAP, "0xsender", "0xreceiver"],
      data: [
        "0xmarket_address",
        "0x0", // sy_in low
        "0x0", // sy_in high
        "0xde0b6b3a7640000", // pt_in low (1e18)
        "0x0", // pt_in high
        "0xde0b6b3a7640000", // sy_out low
        "0x0", // sy_out high
        "0x0", // pt_out low
        "0x0", // pt_out high
      ],
      transactionHash: "0xswap123",
      blockNumber: 4643500,
      blockTimestamp: "1234567900",
    };

    const result = transformRouterEvent(event);

    expect(result).toEqual({
      event_type: "Swap",
      block_number: 4643500,
      block_timestamp: "1234567900",
      transaction_hash: "0xswap123",
      sender: "0xsender",
      receiver: "0xreceiver",
      market: "0xmarket_address",
      sy_in: "0",
      pt_in: "1000000000000000000",
      sy_out: "1000000000000000000",
      pt_out: "0",
    });
  });

  it("should return null for unknown events", () => {
    const event = {
      keys: ["0xunknown"],
      data: [],
      transactionHash: "0x123",
      blockNumber: 1,
      blockTimestamp: "0",
    };

    const result = transformRouterEvent(event);
    expect(result).toBeNull();
  });
});
