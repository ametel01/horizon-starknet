/**
 * YT (Yield Token) Indexer Unit Test
 *
 * Tests the transform logic for MintPY, RedeemPY, RedeemPYPostExpiry,
 * InterestClaimed, ExpiryReached events
 *
 * Also tests Pendle-style interest system events:
 * TreasuryInterestRedeemed, InterestFeeRateSet, MintPYMulti,
 * RedeemPYMulti, RedeemPYWithInterest, PostExpiryDataSet, PyIndexUpdated
 */

import { hash } from "starknet";
import { describe, expect, it } from "vitest";

import { matchSelector, readU256 } from "../src/lib/utils";

// Event selectors - Core YT events
const MINT_PY = hash.getSelectorFromName("MintPY");
const REDEEM_PY = hash.getSelectorFromName("RedeemPY");
const REDEEM_PY_POST_EXPIRY = hash.getSelectorFromName("RedeemPYPostExpiry");
const INTEREST_CLAIMED = hash.getSelectorFromName("InterestClaimed");
const EXPIRY_REACHED = hash.getSelectorFromName("ExpiryReached");

// Event selectors - Pendle-style interest system events
const TREASURY_INTEREST_REDEEMED = hash.getSelectorFromName(
  "TreasuryInterestRedeemed"
);
const INTEREST_FEE_RATE_SET = hash.getSelectorFromName("InterestFeeRateSet");
const MINT_PY_MULTI = hash.getSelectorFromName("MintPYMulti");
const REDEEM_PY_MULTI = hash.getSelectorFromName("RedeemPYMulti");
const REDEEM_PY_WITH_INTEREST = hash.getSelectorFromName(
  "RedeemPYWithInterest"
);
const POST_EXPIRY_DATA_SET = hash.getSelectorFromName("PostExpiryDataSet");
const PY_INDEX_UPDATED = hash.getSelectorFromName("PyIndexUpdated");

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
  // NEW Pendle-style layout:
  // keys = [selector, caller, receiver_pt, receiver_yt]
  // data = [expiry, amount_sy_deposited(u256), amount_py_minted(u256), pt, sy, py_index(u256),
  //         exchange_rate(u256), total_pt_supply(u256), total_yt_supply(u256), timestamp]
  return {
    event_type: "MintPY" as const,
    ...baseFields(ctx),
    caller: keys[1] ?? "",
    receiver_pt: keys[2] ?? "",
    receiver_yt: keys[3] ?? "",
    expiry: Number(BigInt(data[0] ?? "0")),
    yt: address,
    sy: data[6] ?? "",
    pt: data[5] ?? "",
    amount_sy_deposited: readU256(data, 1),
    amount_py_minted: readU256(data, 3),
    py_index: readU256(data, 7),
    exchange_rate: readU256(data, 9),
    total_pt_supply_after: readU256(data, 11),
    total_yt_supply_after: readU256(data, 13),
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

// Pendle-style interest system event handlers
function handleTreasuryInterestRedeemed(ctx: EventContext) {
  const { keys, data, address } = ctx;
  return {
    event_type: "TreasuryInterestRedeemed" as const,
    ...baseFields(ctx),
    yt: keys[1] ?? address,
    treasury: keys[2] ?? "",
    amount_sy: readU256(data, 0),
    sy: data[2] ?? "",
    expiry_index: readU256(data, 3),
    current_index: readU256(data, 5),
    total_yt_supply: readU256(data, 7),
  };
}

function handleInterestFeeRateSet(ctx: EventContext) {
  const { keys, data, address } = ctx;
  return {
    event_type: "InterestFeeRateSet" as const,
    ...baseFields(ctx),
    yt: keys[1] ?? address,
    old_rate: readU256(data, 0),
    new_rate: readU256(data, 2),
  };
}

function handleMintPYMulti(ctx: EventContext) {
  const { keys, data, address } = ctx;
  return {
    event_type: "MintPYMulti" as const,
    ...baseFields(ctx),
    caller: keys[1] ?? "",
    expiry: Number(BigInt(keys[2] ?? "0")),
    yt: address,
    total_sy_deposited: readU256(data, 0),
    total_py_minted: readU256(data, 2),
    receiver_count: Number(BigInt(data[4] ?? "0")),
  };
}

function handleRedeemPYMulti(ctx: EventContext) {
  const { keys, data, address } = ctx;
  return {
    event_type: "RedeemPYMulti" as const,
    ...baseFields(ctx),
    caller: keys[1] ?? "",
    expiry: Number(BigInt(keys[2] ?? "0")),
    yt: address,
    total_py_redeemed: readU256(data, 0),
    total_sy_returned: readU256(data, 2),
    receiver_count: Number(BigInt(data[4] ?? "0")),
  };
}

function handleRedeemPYWithInterest(ctx: EventContext) {
  const { keys, data, address } = ctx;
  return {
    event_type: "RedeemPYWithInterest" as const,
    ...baseFields(ctx),
    caller: keys[1] ?? "",
    receiver: keys[2] ?? "",
    expiry: Number(BigInt(keys[3] ?? "0")),
    yt: address,
    amount_py_redeemed: readU256(data, 0),
    amount_sy_from_redeem: readU256(data, 2),
    amount_interest_claimed: readU256(data, 4),
  };
}

function handlePostExpiryDataSet(ctx: EventContext) {
  const { keys, data, address } = ctx;
  return {
    event_type: "PostExpiryDataSet" as const,
    ...baseFields(ctx),
    yt: keys[1] ?? address,
    pt: keys[2] ?? "",
    sy: data[0] ?? "",
    expiry: Number(BigInt(data[1] ?? "0")),
    first_py_index: readU256(data, 2),
    exchange_rate_at_init: readU256(data, 4),
    total_pt_supply: readU256(data, 6),
    total_yt_supply: readU256(data, 8),
  };
}

function handlePyIndexUpdated(ctx: EventContext) {
  const { keys, data, address } = ctx;
  return {
    event_type: "PyIndexUpdated" as const,
    ...baseFields(ctx),
    yt: keys[1] ?? address,
    old_index: readU256(data, 0),
    new_index: readU256(data, 2),
    exchange_rate: readU256(data, 4),
    index_block_number: Number(BigInt(data[6] ?? "0")),
  };
}

// Handler return types
type YTEventResult =
  | ReturnType<typeof handleMintPY>
  | ReturnType<typeof handleRedeemPY>
  | ReturnType<typeof handleRedeemPYPostExpiry>
  | ReturnType<typeof handleInterestClaimed>
  | ReturnType<typeof handleExpiryReached>
  | ReturnType<typeof handleTreasuryInterestRedeemed>
  | ReturnType<typeof handleInterestFeeRateSet>
  | ReturnType<typeof handleMintPYMulti>
  | ReturnType<typeof handleRedeemPYMulti>
  | ReturnType<typeof handleRedeemPYWithInterest>
  | ReturnType<typeof handlePostExpiryDataSet>
  | ReturnType<typeof handlePyIndexUpdated>;

// Dispatch table: [selector, handler] pairs
const EVENT_HANDLERS: [string, (ctx: EventContext) => YTEventResult][] = [
  [MINT_PY, handleMintPY],
  [REDEEM_PY, handleRedeemPY],
  [REDEEM_PY_POST_EXPIRY, handleRedeemPYPostExpiry],
  [INTEREST_CLAIMED, handleInterestClaimed],
  [EXPIRY_REACHED, handleExpiryReached],
  // Pendle-style interest system events
  [TREASURY_INTEREST_REDEEMED, handleTreasuryInterestRedeemed],
  [INTEREST_FEE_RATE_SET, handleInterestFeeRateSet],
  [MINT_PY_MULTI, handleMintPYMulti],
  [REDEEM_PY_MULTI, handleRedeemPYMulti],
  [REDEEM_PY_WITH_INTEREST, handleRedeemPYWithInterest],
  [POST_EXPIRY_DATA_SET, handlePostExpiryDataSet],
  [PY_INDEX_UPDATED, handlePyIndexUpdated],
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
    // NEW Pendle-style layout:
    // keys = [selector, caller, receiver_pt, receiver_yt]
    // data = [expiry, amount_sy_deposited(u256), amount_py_minted(u256), pt, sy, py_index(u256),
    //         exchange_rate(u256), total_pt_supply(u256), total_yt_supply(u256), timestamp]
    const event = {
      keys: [MINT_PY, "0xcaller", "0xreceiver_pt", "0xreceiver_yt"],
      data: [
        "0x6774a5d5", // expiry (1735697877)
        "0xde0b6b3a7640000", // amount_sy_deposited low (1e18)
        "0x0", // amount_sy_deposited high
        "0xde0b6b3a7640000", // amount_py_minted low (1e18)
        "0x0", // amount_py_minted high
        "0xpt_address", // pt
        "0xsy_address", // sy
        "0xde0b6b3a7640000", // py_index low (1e18)
        "0x0", // py_index high
        "0xde0b6b3a7640000", // exchange_rate low (1e18)
        "0x0", // exchange_rate high
        "0xde0b6b3a7640000", // total_pt_supply low (1e18)
        "0x0", // total_pt_supply high
        "0xde0b6b3a7640000", // total_yt_supply low (1e18)
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
      receiver_pt: "0xreceiver_pt",
      receiver_yt: "0xreceiver_yt",
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

  // ============================================================
  // PENDLE-STYLE INTEREST SYSTEM EVENTS
  // ============================================================

  it("should transform TreasuryInterestRedeemed event", () => {
    const event = {
      keys: [TREASURY_INTEREST_REDEEMED, "0xyt_address", "0xtreasury"],
      data: [
        "0x6f05b59d3b20000", // amount_sy low (0.5e18)
        "0x0", // amount_sy high
        "0xsy_address", // sy
        "0xde0b6b3a7640000", // expiry_index low
        "0x0", // expiry_index high
        "0x1bc16d674ec80000", // current_index low (2e18)
        "0x0", // current_index high
        "0x1bc16d674ec80000", // total_yt_supply low (2e18)
        "0x0", // total_yt_supply high
        "0x12345678", // timestamp
      ],
      address: "0xyt_address",
      transactionHash: "0xtreasury123",
      blockNumber: 4650000,
      blockTimestamp: "1234600000",
    };

    const result = transformYTEvent(event);

    expect(result).toEqual({
      event_type: "TreasuryInterestRedeemed",
      block_number: 4650000,
      block_timestamp: "1234600000",
      transaction_hash: "0xtreasury123",
      yt: "0xyt_address",
      treasury: "0xtreasury",
      amount_sy: "500000000000000000",
      sy: "0xsy_address",
      expiry_index: "1000000000000000000",
      current_index: "2000000000000000000",
      total_yt_supply: "2000000000000000000",
    });
  });

  it("should transform InterestFeeRateSet event", () => {
    const event = {
      keys: [INTEREST_FEE_RATE_SET, "0xyt_address"],
      data: [
        "0x16345785d8a0000", // old_rate low (0.1e18 = 10%)
        "0x0", // old_rate high
        "0x2c68af0bb140000", // new_rate low (0.2e18 = 20%)
        "0x0", // new_rate high
        "0x12345678", // timestamp
      ],
      address: "0xyt_address",
      transactionHash: "0xfeerate123",
      blockNumber: 4650100,
      blockTimestamp: "1234600100",
    };

    const result = transformYTEvent(event);

    expect(result).toEqual({
      event_type: "InterestFeeRateSet",
      block_number: 4650100,
      block_timestamp: "1234600100",
      transaction_hash: "0xfeerate123",
      yt: "0xyt_address",
      old_rate: "100000000000000000",
      new_rate: "200000000000000000",
    });
  });

  it("should transform MintPYMulti event", () => {
    const event = {
      keys: [MINT_PY_MULTI, "0xcaller", "0x6774a5d5"], // expiry
      data: [
        "0x1bc16d674ec80000", // total_sy_deposited low (2e18)
        "0x0", // total_sy_deposited high
        "0x1bc16d674ec80000", // total_py_minted low (2e18)
        "0x0", // total_py_minted high
        "0x3", // receiver_count (3)
        "0x12345678", // timestamp
      ],
      address: "0xyt_address",
      transactionHash: "0xmintmulti123",
      blockNumber: 4650200,
      blockTimestamp: "1234600200",
    };

    const result = transformYTEvent(event);

    expect(result).toEqual({
      event_type: "MintPYMulti",
      block_number: 4650200,
      block_timestamp: "1234600200",
      transaction_hash: "0xmintmulti123",
      caller: "0xcaller",
      expiry: 1735697877,
      yt: "0xyt_address",
      total_sy_deposited: "2000000000000000000",
      total_py_minted: "2000000000000000000",
      receiver_count: 3,
    });
  });

  it("should transform RedeemPYMulti event", () => {
    const event = {
      keys: [REDEEM_PY_MULTI, "0xcaller", "0x6774a5d5"], // expiry
      data: [
        "0x1bc16d674ec80000", // total_py_redeemed low (2e18)
        "0x0", // total_py_redeemed high
        "0x1bc16d674ec80000", // total_sy_returned low (2e18)
        "0x0", // total_sy_returned high
        "0x5", // receiver_count (5)
        "0x12345678", // timestamp
      ],
      address: "0xyt_address",
      transactionHash: "0xredeemmulti123",
      blockNumber: 4650300,
      blockTimestamp: "1234600300",
    };

    const result = transformYTEvent(event);

    expect(result).toEqual({
      event_type: "RedeemPYMulti",
      block_number: 4650300,
      block_timestamp: "1234600300",
      transaction_hash: "0xredeemmulti123",
      caller: "0xcaller",
      expiry: 1735697877,
      yt: "0xyt_address",
      total_py_redeemed: "2000000000000000000",
      total_sy_returned: "2000000000000000000",
      receiver_count: 5,
    });
  });

  it("should transform RedeemPYWithInterest event", () => {
    const event = {
      keys: [
        REDEEM_PY_WITH_INTEREST,
        "0xcaller",
        "0xreceiver",
        "0x6774a5d5", // expiry
      ],
      data: [
        "0xde0b6b3a7640000", // amount_py_redeemed low (1e18)
        "0x0", // amount_py_redeemed high
        "0xde0b6b3a7640000", // amount_sy_from_redeem low (1e18)
        "0x0", // amount_sy_from_redeem high
        "0x6f05b59d3b20000", // amount_interest_claimed low (0.5e18)
        "0x0", // amount_interest_claimed high
        "0x12345678", // timestamp
      ],
      address: "0xyt_address",
      transactionHash: "0xredeemwithint123",
      blockNumber: 4650400,
      blockTimestamp: "1234600400",
    };

    const result = transformYTEvent(event);

    expect(result).toEqual({
      event_type: "RedeemPYWithInterest",
      block_number: 4650400,
      block_timestamp: "1234600400",
      transaction_hash: "0xredeemwithint123",
      caller: "0xcaller",
      receiver: "0xreceiver",
      expiry: 1735697877,
      yt: "0xyt_address",
      amount_py_redeemed: "1000000000000000000",
      amount_sy_from_redeem: "1000000000000000000",
      amount_interest_claimed: "500000000000000000",
    });
  });

  it("should transform PostExpiryDataSet event", () => {
    const event = {
      keys: [POST_EXPIRY_DATA_SET, "0xyt_address", "0xpt_address"],
      data: [
        "0xsy_address", // sy
        "0x6774a5d5", // expiry
        "0xde0b6b3a7640000", // first_py_index low (1e18)
        "0x0", // first_py_index high
        "0xde0b6b3a7640000", // exchange_rate_at_init low (1e18)
        "0x0", // exchange_rate_at_init high
        "0x1bc16d674ec80000", // total_pt_supply low (2e18)
        "0x0", // total_pt_supply high
        "0x1bc16d674ec80000", // total_yt_supply low (2e18)
        "0x0", // total_yt_supply high
        "0x12345678", // timestamp
      ],
      address: "0xyt_address",
      transactionHash: "0xpostexpiry456",
      blockNumber: 4700100,
      blockTimestamp: "1735600100",
    };

    const result = transformYTEvent(event);

    expect(result).toEqual({
      event_type: "PostExpiryDataSet",
      block_number: 4700100,
      block_timestamp: "1735600100",
      transaction_hash: "0xpostexpiry456",
      yt: "0xyt_address",
      pt: "0xpt_address",
      sy: "0xsy_address",
      expiry: 1735697877,
      first_py_index: "1000000000000000000",
      exchange_rate_at_init: "1000000000000000000",
      total_pt_supply: "2000000000000000000",
      total_yt_supply: "2000000000000000000",
    });
  });

  it("should transform PyIndexUpdated event", () => {
    const event = {
      keys: [PY_INDEX_UPDATED, "0xyt_address"],
      data: [
        "0xde0b6b3a7640000", // old_index low (1e18)
        "0x0", // old_index high
        "0x1bc16d674ec80000", // new_index low (2e18)
        "0x0", // new_index high
        "0x1bc16d674ec80000", // exchange_rate low (2e18)
        "0x0", // exchange_rate high
        "0x46d5e8", // block_number (4642280)
        "0x12345678", // timestamp
      ],
      address: "0xyt_address",
      transactionHash: "0xpyindex123",
      blockNumber: 4650500,
      blockTimestamp: "1234600500",
    };

    const result = transformYTEvent(event);

    expect(result).toEqual({
      event_type: "PyIndexUpdated",
      block_number: 4650500,
      block_timestamp: "1234600500",
      transaction_hash: "0xpyindex123",
      yt: "0xyt_address",
      old_index: "1000000000000000000",
      new_index: "2000000000000000000",
      exchange_rate: "2000000000000000000",
      index_block_number: 4642280,
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
