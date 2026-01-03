/**
 * YT (Yield Token) Indexer Unit Test
 *
 * Tests the transform logic for MintPY, RedeemPY, RedeemPYPostExpiry,
 * InterestClaimed, ExpiryReached events
 */

import { hash } from "starknet";
import { describe, expect, it } from "vitest";

import { matchSelector, readU256 } from "../src/lib/utils";

// Event selectors
const MINT_PY = hash.getSelectorFromName("MintPY");
const REDEEM_PY = hash.getSelectorFromName("RedeemPY");
const REDEEM_PY_POST_EXPIRY = hash.getSelectorFromName("RedeemPYPostExpiry");
const INTEREST_CLAIMED = hash.getSelectorFromName("InterestClaimed");
const EXPIRY_REACHED = hash.getSelectorFromName("ExpiryReached");

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
function handleMintPY(ctx: EventContext) {
  const { keys, data, address } = ctx;
  return {
    event_type: "MintPY" as const,
    ...baseFields(ctx),
    caller: keys[1] ?? "",
    receiver: keys[2] ?? "",
    expiry: Number(BigInt(keys[3] ?? "0")),
    yt: address,
    sy: data[5] ?? "",
    pt: data[4] ?? "",
    amount_sy_deposited: readU256(data, 0),
    amount_py_minted: readU256(data, 2),
    py_index: readU256(data, 6),
    exchange_rate: readU256(data, 8),
    total_pt_supply_after: readU256(data, 10),
    total_yt_supply_after: readU256(data, 12),
  };
}

function handleRedeemPY(ctx: EventContext) {
  const { keys, data, address } = ctx;
  return {
    event_type: "RedeemPY" as const,
    ...baseFields(ctx),
    caller: keys[1] ?? "",
    receiver: keys[2] ?? "",
    expiry: Number(BigInt(keys[3] ?? "0")),
    yt: address,
    sy: data[0] ?? "",
    pt: data[1] ?? "",
    amount_py_redeemed: readU256(data, 2),
    amount_sy_returned: readU256(data, 4),
    py_index: readU256(data, 6),
    exchange_rate: readU256(data, 8),
  };
}

function handleRedeemPYPostExpiry(ctx: EventContext) {
  const { keys, data, address } = ctx;
  return {
    event_type: "RedeemPYPostExpiry" as const,
    ...baseFields(ctx),
    caller: keys[1] ?? "",
    receiver: keys[2] ?? "",
    expiry: Number(BigInt(keys[3] ?? "0")),
    yt: address,
    sy: data[5] ?? "",
    pt: data[4] ?? "",
    amount_pt_redeemed: readU256(data, 0),
    amount_sy_returned: readU256(data, 2),
    final_py_index: readU256(data, 6),
    final_exchange_rate: readU256(data, 8),
  };
}

function handleInterestClaimed(ctx: EventContext) {
  const { keys, data, address } = ctx;
  return {
    event_type: "InterestClaimed" as const,
    ...baseFields(ctx),
    user: keys[1] ?? "",
    yt: keys[2] ?? address,
    expiry: Number(BigInt(keys[3] ?? "0")),
    sy: data[2] ?? "",
    amount_sy: readU256(data, 0),
    yt_balance: readU256(data, 3),
    py_index_at_claim: readU256(data, 5),
    exchange_rate: readU256(data, 7),
  };
}

function handleExpiryReached(ctx: EventContext) {
  const { keys, data, address } = ctx;
  return {
    event_type: "ExpiryReached" as const,
    ...baseFields(ctx),
    market: keys[1] ?? "",
    yt: keys[2] ?? address,
    pt: keys[3] ?? "",
    sy: data[0] ?? "",
    expiry: Number(BigInt(data[1] ?? "0")),
    final_exchange_rate: readU256(data, 2),
    final_py_index: readU256(data, 4),
    total_pt_supply: readU256(data, 6),
    total_yt_supply: readU256(data, 8),
    sy_reserve: readU256(data, 10),
    pt_reserve: readU256(data, 12),
  };
}

// Handler return types
type YTEventResult =
  | ReturnType<typeof handleMintPY>
  | ReturnType<typeof handleRedeemPY>
  | ReturnType<typeof handleRedeemPYPostExpiry>
  | ReturnType<typeof handleInterestClaimed>
  | ReturnType<typeof handleExpiryReached>;

// Dispatch table: [selector, handler] pairs
const EVENT_HANDLERS: [string, (ctx: EventContext) => YTEventResult][] = [
  [MINT_PY, handleMintPY],
  [REDEEM_PY, handleRedeemPY],
  [REDEEM_PY_POST_EXPIRY, handleRedeemPYPostExpiry],
  [INTEREST_CLAIMED, handleInterestClaimed],
  [EXPIRY_REACHED, handleExpiryReached],
];

// Transform function using dispatch table
function transformYTEvent(event: EventContext) {
  const eventKey = event.keys[0];
  const handler = EVENT_HANDLERS.find(([selector]) =>
    matchSelector(eventKey, selector)
  );
  return handler ? handler[1](event) : null;
}

describe("YT Indexer", () => {
  it("should transform MintPY event", () => {
    const event = {
      keys: [MINT_PY, "0xcaller", "0xreceiver", "0x6774a5d5"],
      data: [
        "0xde0b6b3a7640000", // amount_sy_deposited low
        "0x0", // amount_sy_deposited high
        "0xde0b6b3a7640000", // amount_py_minted low
        "0x0", // amount_py_minted high
        "0xpt_address", // pt
        "0xsy_address", // sy
        "0xde0b6b3a7640000", // py_index low
        "0x0", // py_index high
        "0xde0b6b3a7640000", // exchange_rate low
        "0x0", // exchange_rate high
        "0xde0b6b3a7640000", // total_pt_supply low
        "0x0", // total_pt_supply high
        "0xde0b6b3a7640000", // total_yt_supply low
        "0x0", // total_yt_supply high
      ],
      address: "0xyt_address",
      transactionHash: "0xmint123",
      blockNumber: 4643400,
      blockTimestamp: "1234567890",
    };

    const result = transformYTEvent(event);

    expect(result).toEqual({
      event_type: "MintPY",
      block_number: 4643400,
      block_timestamp: "1234567890",
      transaction_hash: "0xmint123",
      caller: "0xcaller",
      receiver: "0xreceiver",
      expiry: 1735697877,
      yt: "0xyt_address",
      sy: "0xsy_address",
      pt: "0xpt_address",
      amount_sy_deposited: "1000000000000000000",
      amount_py_minted: "1000000000000000000",
      py_index: "1000000000000000000",
      exchange_rate: "1000000000000000000",
      total_pt_supply_after: "1000000000000000000",
      total_yt_supply_after: "1000000000000000000",
    });
  });

  it("should transform RedeemPY event", () => {
    const event = {
      keys: [REDEEM_PY, "0xcaller", "0xreceiver", "0x6774a5d5"],
      data: [
        "0xsy_address", // sy
        "0xpt_address", // pt
        "0xde0b6b3a7640000", // amount_py_redeemed low
        "0x0", // amount_py_redeemed high
        "0xde0b6b3a7640000", // amount_sy_returned low
        "0x0", // amount_sy_returned high
        "0xde0b6b3a7640000", // py_index low
        "0x0", // py_index high
        "0xde0b6b3a7640000", // exchange_rate low
        "0x0", // exchange_rate high
      ],
      address: "0xyt_address",
      transactionHash: "0xredeem123",
      blockNumber: 4643450,
      blockTimestamp: "1234567950",
    };

    const result = transformYTEvent(event);

    expect(result).toEqual({
      event_type: "RedeemPY",
      block_number: 4643450,
      block_timestamp: "1234567950",
      transaction_hash: "0xredeem123",
      caller: "0xcaller",
      receiver: "0xreceiver",
      expiry: 1735697877,
      yt: "0xyt_address",
      sy: "0xsy_address",
      pt: "0xpt_address",
      amount_py_redeemed: "1000000000000000000",
      amount_sy_returned: "1000000000000000000",
      py_index: "1000000000000000000",
      exchange_rate: "1000000000000000000",
    });
  });

  it("should transform RedeemPYPostExpiry event", () => {
    const event = {
      keys: [REDEEM_PY_POST_EXPIRY, "0xcaller", "0xreceiver", "0x6774a5d5"],
      data: [
        "0xde0b6b3a7640000", // amount_pt_redeemed low
        "0x0", // amount_pt_redeemed high
        "0xde0b6b3a7640000", // amount_sy_returned low
        "0x0", // amount_sy_returned high
        "0xpt_address", // pt
        "0xsy_address", // sy
        "0xde0b6b3a7640000", // final_py_index low
        "0x0", // final_py_index high
        "0xde0b6b3a7640000", // final_exchange_rate low
        "0x0", // final_exchange_rate high
      ],
      address: "0xyt_address",
      transactionHash: "0xpostexpiry123",
      blockNumber: 4700000,
      blockTimestamp: "1735600000",
    };

    const result = transformYTEvent(event);

    expect(result).toEqual({
      event_type: "RedeemPYPostExpiry",
      block_number: 4700000,
      block_timestamp: "1735600000",
      transaction_hash: "0xpostexpiry123",
      caller: "0xcaller",
      receiver: "0xreceiver",
      expiry: 1735697877,
      yt: "0xyt_address",
      sy: "0xsy_address",
      pt: "0xpt_address",
      amount_pt_redeemed: "1000000000000000000",
      amount_sy_returned: "1000000000000000000",
      final_py_index: "1000000000000000000",
      final_exchange_rate: "1000000000000000000",
    });
  });

  it("should transform InterestClaimed event", () => {
    const event = {
      keys: [INTEREST_CLAIMED, "0xuser", "0xyt_address", "0x6774a5d5"],
      data: [
        "0x6f05b59d3b20000", // amount_sy low (0.5e18)
        "0x0", // amount_sy high
        "0xsy_address", // sy
        "0xde0b6b3a7640000", // yt_balance low
        "0x0", // yt_balance high
        "0xde0b6b3a7640000", // py_index_at_claim low
        "0x0", // py_index_at_claim high
        "0xde0b6b3a7640000", // exchange_rate low
        "0x0", // exchange_rate high
      ],
      address: "0xyt_address",
      transactionHash: "0xinterest123",
      blockNumber: 4650000,
      blockTimestamp: "1234600000",
    };

    const result = transformYTEvent(event);

    expect(result).toEqual({
      event_type: "InterestClaimed",
      block_number: 4650000,
      block_timestamp: "1234600000",
      transaction_hash: "0xinterest123",
      user: "0xuser",
      yt: "0xyt_address",
      expiry: 1735697877,
      sy: "0xsy_address",
      amount_sy: "500000000000000000",
      yt_balance: "1000000000000000000",
      py_index_at_claim: "1000000000000000000",
      exchange_rate: "1000000000000000000",
    });
  });

  it("should transform ExpiryReached event", () => {
    const event = {
      keys: [EXPIRY_REACHED, "0xmarket", "0xyt_address", "0xpt_address"],
      data: [
        "0xsy_address", // sy
        "0x6774a5d5", // expiry
        "0xde0b6b3a7640000", // final_exchange_rate low
        "0x0", // final_exchange_rate high
        "0xde0b6b3a7640000", // final_py_index low
        "0x0", // final_py_index high
        "0xde0b6b3a7640000", // total_pt_supply low
        "0x0", // total_pt_supply high
        "0xde0b6b3a7640000", // total_yt_supply low
        "0x0", // total_yt_supply high
        "0xde0b6b3a7640000", // sy_reserve low
        "0x0", // sy_reserve high
        "0xde0b6b3a7640000", // pt_reserve low
        "0x0", // pt_reserve high
      ],
      address: "0xyt_address",
      transactionHash: "0xexpiry123",
      blockNumber: 4700000,
      blockTimestamp: "1735600000",
    };

    const result = transformYTEvent(event);

    expect(result).toEqual({
      event_type: "ExpiryReached",
      block_number: 4700000,
      block_timestamp: "1735600000",
      transaction_hash: "0xexpiry123",
      market: "0xmarket",
      yt: "0xyt_address",
      pt: "0xpt_address",
      sy: "0xsy_address",
      expiry: 1735697877,
      final_exchange_rate: "1000000000000000000",
      final_py_index: "1000000000000000000",
      total_pt_supply: "1000000000000000000",
      total_yt_supply: "1000000000000000000",
      sy_reserve: "1000000000000000000",
      pt_reserve: "1000000000000000000",
    });
  });

  it("should return null for unknown events", () => {
    const event = {
      keys: ["0xunknown"],
      data: [],
      address: "0xyt_address",
      transactionHash: "0x123",
      blockNumber: 1,
      blockTimestamp: "0",
    };

    const result = transformYTEvent(event);
    expect(result).toBeNull();
  });
});
