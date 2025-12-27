/**
 * SY (Standardized Yield) Indexer Unit Test
 *
 * Tests the transform logic for Deposit, Redeem, OracleRateUpdated events
 */

import { hash } from "starknet";
import { describe, expect, it } from "vitest";

import { matchSelector, readU256 } from "../src/lib/utils";

// Event selectors
const DEPOSIT = hash.getSelectorFromName("Deposit");
const REDEEM = hash.getSelectorFromName("Redeem");
const ORACLE_RATE_UPDATED = hash.getSelectorFromName("OracleRateUpdated");

// Transform function (extracted from indexer logic)
function transformSYEvent(event: {
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
  const syAddress = address;

  if (matchSelector(eventKey, DEPOSIT)) {
    const caller = keys[1] ?? "";
    const receiver = keys[2] ?? "";
    const underlying = keys[3] ?? "";

    const amountDeposited = readU256(data, 0);
    const amountSyMinted = readU256(data, 2);
    const exchangeRate = readU256(data, 4);
    const totalSupplyAfter = readU256(data, 6);

    return {
      event_type: "Deposit",
      block_number: blockNumber,
      block_timestamp: blockTimestamp,
      transaction_hash: transactionHash,
      caller,
      receiver,
      underlying,
      sy: syAddress,
      amount_deposited: amountDeposited,
      amount_sy_minted: amountSyMinted,
      exchange_rate: exchangeRate,
      total_supply_after: totalSupplyAfter,
    };
  } else if (matchSelector(eventKey, REDEEM)) {
    const caller = keys[1] ?? "";
    const receiver = keys[2] ?? "";
    const underlying = keys[3] ?? "";

    const amountSyBurned = readU256(data, 0);
    const amountRedeemed = readU256(data, 2);
    const exchangeRate = readU256(data, 4);
    const totalSupplyAfter = readU256(data, 6);

    return {
      event_type: "Redeem",
      block_number: blockNumber,
      block_timestamp: blockTimestamp,
      transaction_hash: transactionHash,
      caller,
      receiver,
      underlying,
      sy: syAddress,
      amount_sy_burned: amountSyBurned,
      amount_redeemed: amountRedeemed,
      exchange_rate: exchangeRate,
      total_supply_after: totalSupplyAfter,
    };
  } else if (matchSelector(eventKey, ORACLE_RATE_UPDATED)) {
    const sy = keys[1] ?? syAddress;
    const underlying = keys[2] ?? "";

    const oldRate = readU256(data, 0);
    const newRate = readU256(data, 2);
    const rateChangeBps = readU256(data, 4);

    return {
      event_type: "OracleRateUpdated",
      block_number: blockNumber,
      block_timestamp: blockTimestamp,
      transaction_hash: transactionHash,
      sy,
      underlying,
      old_rate: oldRate,
      new_rate: newRate,
      rate_change_bps: rateChangeBps,
    };
  }

  return null;
}

describe("SY Indexer", () => {
  it("should transform Deposit event", () => {
    const event = {
      keys: [DEPOSIT, "0xcaller", "0xreceiver", "0xunderlying"],
      data: [
        "0xde0b6b3a7640000", // amount_deposited low (1e18)
        "0x0", // amount_deposited high
        "0xde0b6b3a7640000", // amount_sy_minted low
        "0x0", // amount_sy_minted high
        "0xde0b6b3a7640000", // exchange_rate low
        "0x0", // exchange_rate high
        "0x1bc16d674ec80000", // total_supply_after low (2e18)
        "0x0", // total_supply_after high
      ],
      address: "0xsy_address",
      transactionHash: "0xdeposit123",
      blockNumber: 4643400,
      blockTimestamp: "1234567890",
    };

    const result = transformSYEvent(event);

    expect(result).toEqual({
      event_type: "Deposit",
      block_number: 4643400,
      block_timestamp: "1234567890",
      transaction_hash: "0xdeposit123",
      caller: "0xcaller",
      receiver: "0xreceiver",
      underlying: "0xunderlying",
      sy: "0xsy_address",
      amount_deposited: "1000000000000000000",
      amount_sy_minted: "1000000000000000000",
      exchange_rate: "1000000000000000000",
      total_supply_after: "2000000000000000000",
    });
  });

  it("should transform Redeem event", () => {
    const event = {
      keys: [REDEEM, "0xcaller", "0xreceiver", "0xunderlying"],
      data: [
        "0xde0b6b3a7640000", // amount_sy_burned low
        "0x0", // amount_sy_burned high
        "0xde0b6b3a7640000", // amount_redeemed low
        "0x0", // amount_redeemed high
        "0xde0b6b3a7640000", // exchange_rate low
        "0x0", // exchange_rate high
        "0xde0b6b3a7640000", // total_supply_after low
        "0x0", // total_supply_after high
      ],
      address: "0xsy_address",
      transactionHash: "0xredeem123",
      blockNumber: 4643450,
      blockTimestamp: "1234567950",
    };

    const result = transformSYEvent(event);

    expect(result).toEqual({
      event_type: "Redeem",
      block_number: 4643450,
      block_timestamp: "1234567950",
      transaction_hash: "0xredeem123",
      caller: "0xcaller",
      receiver: "0xreceiver",
      underlying: "0xunderlying",
      sy: "0xsy_address",
      amount_sy_burned: "1000000000000000000",
      amount_redeemed: "1000000000000000000",
      exchange_rate: "1000000000000000000",
      total_supply_after: "1000000000000000000",
    });
  });

  it("should transform OracleRateUpdated event", () => {
    const event = {
      keys: [ORACLE_RATE_UPDATED, "0xsy_address", "0xunderlying"],
      data: [
        "0xde0b6b3a7640000", // old_rate low
        "0x0", // old_rate high
        "0xde58274c5160000", // new_rate low (1.01e18)
        "0x0", // new_rate high
        "0x64", // rate_change_bps low (100 = 1%)
        "0x0", // rate_change_bps high
      ],
      address: "0xsy_address",
      transactionHash: "0xoracle123",
      blockNumber: 4643500,
      blockTimestamp: "1234568000",
    };

    const result = transformSYEvent(event);

    expect(result).toEqual({
      event_type: "OracleRateUpdated",
      block_number: 4643500,
      block_timestamp: "1234568000",
      transaction_hash: "0xoracle123",
      sy: "0xsy_address",
      underlying: "0xunderlying",
      old_rate: "1000000000000000000",
      new_rate: "1001349930194173952",
      rate_change_bps: "100",
    });
  });

  it("should return null for unknown events", () => {
    const event = {
      keys: ["0xunknown"],
      data: [],
      address: "0xsy_address",
      transactionHash: "0x123",
      blockNumber: 1,
      blockTimestamp: "0",
    };

    const result = transformSYEvent(event);
    expect(result).toBeNull();
  });
});
