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

// Transform function (extracted from indexer logic)
function transformYTEvent(event: {
  keys: string[];
  data: string[];
  address: string;
  transactionHash: string;
  blockNumber: number;
  blockTimestamp: string;
}) {
  const { keys, data, address, transactionHash, blockNumber, blockTimestamp } =
    event;
  const eventKey = keys[0];
  const ytAddress = address;

  if (matchSelector(eventKey, MINT_PY)) {
    const caller = keys[1] ?? "";
    const receiver = keys[2] ?? "";
    const expiry = Number(BigInt(keys[3] ?? "0"));

    const amountSyDeposited = readU256(data, 0);
    const amountPyMinted = readU256(data, 2);
    const pt = data[4] ?? "";
    const sy = data[5] ?? "";
    const pyIndex = readU256(data, 6);
    const exchangeRate = readU256(data, 8);
    const totalPtSupply = readU256(data, 10);
    const totalYtSupply = readU256(data, 12);

    return {
      event_type: "MintPY",
      block_number: blockNumber,
      block_timestamp: blockTimestamp,
      transaction_hash: transactionHash,
      caller,
      receiver,
      expiry,
      yt: ytAddress,
      sy,
      pt,
      amount_sy_deposited: amountSyDeposited,
      amount_py_minted: amountPyMinted,
      py_index: pyIndex,
      exchange_rate: exchangeRate,
      total_pt_supply_after: totalPtSupply,
      total_yt_supply_after: totalYtSupply,
    };
  } else if (matchSelector(eventKey, REDEEM_PY)) {
    const caller = keys[1] ?? "";
    const receiver = keys[2] ?? "";
    const expiry = Number(BigInt(keys[3] ?? "0"));

    const sy = data[0] ?? "";
    const pt = data[1] ?? "";
    const amountPyRedeemed = readU256(data, 2);
    const amountSyReturned = readU256(data, 4);
    const pyIndex = readU256(data, 6);
    const exchangeRate = readU256(data, 8);

    return {
      event_type: "RedeemPY",
      block_number: blockNumber,
      block_timestamp: blockTimestamp,
      transaction_hash: transactionHash,
      caller,
      receiver,
      expiry,
      yt: ytAddress,
      sy,
      pt,
      amount_py_redeemed: amountPyRedeemed,
      amount_sy_returned: amountSyReturned,
      py_index: pyIndex,
      exchange_rate: exchangeRate,
    };
  } else if (matchSelector(eventKey, REDEEM_PY_POST_EXPIRY)) {
    const caller = keys[1] ?? "";
    const receiver = keys[2] ?? "";
    const expiry = Number(BigInt(keys[3] ?? "0"));

    const amountPtRedeemed = readU256(data, 0);
    const amountSyReturned = readU256(data, 2);
    const pt = data[4] ?? "";
    const sy = data[5] ?? "";
    const finalPyIndex = readU256(data, 6);
    const finalExchangeRate = readU256(data, 8);

    return {
      event_type: "RedeemPYPostExpiry",
      block_number: blockNumber,
      block_timestamp: blockTimestamp,
      transaction_hash: transactionHash,
      caller,
      receiver,
      expiry,
      yt: ytAddress,
      sy,
      pt,
      amount_pt_redeemed: amountPtRedeemed,
      amount_sy_returned: amountSyReturned,
      final_py_index: finalPyIndex,
      final_exchange_rate: finalExchangeRate,
    };
  } else if (matchSelector(eventKey, INTEREST_CLAIMED)) {
    const user = keys[1] ?? "";
    const yt = keys[2] ?? ytAddress;
    const expiry = Number(BigInt(keys[3] ?? "0"));

    const amountSy = readU256(data, 0);
    const sy = data[2] ?? "";
    const ytBalance = readU256(data, 3);
    const pyIndexAtClaim = readU256(data, 5);
    const exchangeRate = readU256(data, 7);

    return {
      event_type: "InterestClaimed",
      block_number: blockNumber,
      block_timestamp: blockTimestamp,
      transaction_hash: transactionHash,
      user,
      yt,
      expiry,
      sy,
      amount_sy: amountSy,
      yt_balance: ytBalance,
      py_index_at_claim: pyIndexAtClaim,
      exchange_rate: exchangeRate,
    };
  } else if (matchSelector(eventKey, EXPIRY_REACHED)) {
    const market = keys[1] ?? "";
    const yt = keys[2] ?? ytAddress;
    const pt = keys[3] ?? "";

    const sy = data[0] ?? "";
    const expiry = Number(BigInt(data[1] ?? "0"));
    const finalExchangeRate = readU256(data, 2);
    const finalPyIndex = readU256(data, 4);
    const totalPtSupply = readU256(data, 6);
    const totalYtSupply = readU256(data, 8);
    const syReserve = readU256(data, 10);
    const ptReserve = readU256(data, 12);

    return {
      event_type: "ExpiryReached",
      block_number: blockNumber,
      block_timestamp: blockTimestamp,
      transaction_hash: transactionHash,
      market,
      yt,
      pt,
      sy,
      expiry,
      final_exchange_rate: finalExchangeRate,
      final_py_index: finalPyIndex,
      total_pt_supply: totalPtSupply,
      total_yt_supply: totalYtSupply,
      sy_reserve: syReserve,
      pt_reserve: ptReserve,
    };
  }

  return null;
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
