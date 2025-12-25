/**
 * Market (AMM) Indexer Unit Test
 *
 * Tests the transform logic for Mint, Burn, Swap, ImpliedRateUpdated,
 * FeesCollected events
 */

import { describe, expect, it } from "vitest";
import { hash } from "starknet";
import { matchSelector, readU256 } from "../src/lib/utils";

// Event selectors
const MINT = hash.getSelectorFromName("Mint");
const BURN = hash.getSelectorFromName("Burn");
const SWAP = hash.getSelectorFromName("Swap");
const IMPLIED_RATE_UPDATED = hash.getSelectorFromName("ImpliedRateUpdated");
const FEES_COLLECTED = hash.getSelectorFromName("FeesCollected");

// Transform function (extracted from indexer logic)
function transformMarketEvent(event: {
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
  const marketAddress = address;

  if (matchSelector(eventKey, MINT)) {
    const sender = keys[1] ?? "";
    const receiver = keys[2] ?? "";
    const expiry = Number(BigInt(keys[3] ?? "0"));

    const sy = data[0] ?? "";
    const pt = data[1] ?? "";
    const syAmount = readU256(data, 2);
    const ptAmount = readU256(data, 4);
    const lpAmount = readU256(data, 6);
    const exchangeRate = readU256(data, 8);
    const impliedRate = readU256(data, 10);
    const syReserve = readU256(data, 12);
    const ptReserve = readU256(data, 14);
    const totalLp = readU256(data, 16);

    return {
      event_type: "Mint",
      block_number: blockNumber,
      block_timestamp: blockTimestamp,
      transaction_hash: transactionHash,
      sender,
      receiver,
      expiry,
      market: marketAddress,
      sy,
      pt,
      sy_amount: syAmount,
      pt_amount: ptAmount,
      lp_amount: lpAmount,
      exchange_rate: exchangeRate,
      implied_rate: impliedRate,
      sy_reserve_after: syReserve,
      pt_reserve_after: ptReserve,
      total_lp_after: totalLp,
    };
  } else if (matchSelector(eventKey, BURN)) {
    const sender = keys[1] ?? "";
    const receiver = keys[2] ?? "";
    const expiry = Number(BigInt(keys[3] ?? "0"));

    const sy = data[0] ?? "";
    const pt = data[1] ?? "";
    const lpAmount = readU256(data, 2);
    const syAmount = readU256(data, 4);
    const ptAmount = readU256(data, 6);
    const exchangeRate = readU256(data, 8);
    const impliedRate = readU256(data, 10);
    const syReserve = readU256(data, 12);
    const ptReserve = readU256(data, 14);
    const totalLp = readU256(data, 16);

    return {
      event_type: "Burn",
      block_number: blockNumber,
      block_timestamp: blockTimestamp,
      transaction_hash: transactionHash,
      sender,
      receiver,
      expiry,
      market: marketAddress,
      sy,
      pt,
      lp_amount: lpAmount,
      sy_amount: syAmount,
      pt_amount: ptAmount,
      exchange_rate: exchangeRate,
      implied_rate: impliedRate,
      sy_reserve_after: syReserve,
      pt_reserve_after: ptReserve,
      total_lp_after: totalLp,
    };
  } else if (matchSelector(eventKey, SWAP)) {
    const sender = keys[1] ?? "";
    const receiver = keys[2] ?? "";
    const expiry = Number(BigInt(keys[3] ?? "0"));

    const sy = data[0] ?? "";
    const pt = data[1] ?? "";
    const ptIn = readU256(data, 2);
    const syIn = readU256(data, 4);
    const ptOut = readU256(data, 6);
    const syOut = readU256(data, 8);
    const fee = readU256(data, 10);
    const impliedRateBefore = readU256(data, 12);
    const impliedRateAfter = readU256(data, 14);
    const exchangeRate = readU256(data, 16);
    const syReserve = readU256(data, 18);
    const ptReserve = readU256(data, 20);

    return {
      event_type: "Swap",
      block_number: blockNumber,
      block_timestamp: blockTimestamp,
      transaction_hash: transactionHash,
      sender,
      receiver,
      expiry,
      market: marketAddress,
      sy,
      pt,
      pt_in: ptIn,
      sy_in: syIn,
      pt_out: ptOut,
      sy_out: syOut,
      fee,
      implied_rate_before: impliedRateBefore,
      implied_rate_after: impliedRateAfter,
      exchange_rate: exchangeRate,
      sy_reserve_after: syReserve,
      pt_reserve_after: ptReserve,
    };
  } else if (matchSelector(eventKey, IMPLIED_RATE_UPDATED)) {
    const market = keys[1] ?? marketAddress;
    const expiry = Number(BigInt(keys[2] ?? "0"));

    const oldRate = readU256(data, 0);
    const newRate = readU256(data, 2);
    const timeToExpiry = Number(BigInt(data[4] ?? "0"));
    const exchangeRate = readU256(data, 5);
    const syReserve = readU256(data, 7);
    const ptReserve = readU256(data, 9);
    const totalLp = readU256(data, 11);

    return {
      event_type: "ImpliedRateUpdated",
      block_number: blockNumber,
      block_timestamp: blockTimestamp,
      transaction_hash: transactionHash,
      market,
      expiry,
      old_rate: oldRate,
      new_rate: newRate,
      time_to_expiry: timeToExpiry,
      exchange_rate: exchangeRate,
      sy_reserve: syReserve,
      pt_reserve: ptReserve,
      total_lp: totalLp,
    };
  } else if (matchSelector(eventKey, FEES_COLLECTED)) {
    const collector = keys[1] ?? "";
    const receiver = keys[2] ?? "";
    const market = keys[3] ?? marketAddress;

    const amount = readU256(data, 0);
    const expiry = Number(BigInt(data[2] ?? "0"));
    const feeRate = readU256(data, 3);

    return {
      event_type: "FeesCollected",
      block_number: blockNumber,
      block_timestamp: blockTimestamp,
      transaction_hash: transactionHash,
      collector,
      receiver,
      market,
      amount,
      expiry,
      fee_rate: feeRate,
    };
  }

  return null;
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
      keys: [
        FEES_COLLECTED,
        "0xcollector",
        "0xreceiver",
        "0xmarket_address",
      ],
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
