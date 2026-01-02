/**
 * YT (Yield Token) Indexer
 *
 * Uses factory pattern to discover YT contracts from Factory.YieldContractsCreated events.
 *
 * Indexes events from YT contracts:
 * - MintPY: Minting PT/YT from SY
 * - RedeemPY: Redeeming PT/YT to SY before expiry
 * - RedeemPYPostExpiry: Redeeming PT to SY after expiry
 * - InterestClaimed: User claims accrued interest
 * - ExpiryReached: Market has reached expiry
 */

import {
  drizzle,
  drizzleStorage,
  useDrizzleStorage,
} from "@apibara/plugin-drizzle";
import { getSelector, StarknetStream } from "@apibara/starknet";
import { defineIndexer } from "apibara/indexer";
import type { ApibaraRuntimeConfig } from "apibara/types";
import {
  ytExpiryReached,
  ytInterestClaimed,
  ytInterestFeeRateSet,
  ytMintPY,
  ytMintPYMulti,
  ytPostExpiryDataSet,
  ytPyIndexUpdated,
  ytRedeemPY,
  ytRedeemPYMulti,
  ytRedeemPYPostExpiry,
  ytRedeemPYWithInterest,
  ytTreasuryInterestRedeemed,
} from "@/schema";
import { getNetworkConfig } from "../lib/constants";
import { getDrizzleOptions } from "../lib/database";
import { isProgrammerError } from "../lib/errors";
import {
  createIndexerLogger,
  logBatchInsert,
  logBlockProgress,
  logContractDiscovery,
  logIndexerStart,
} from "../lib/logger";
import { measureDbLatency, recordBlock, recordEvents } from "../lib/metrics";
import { streamTimeoutPlugin } from "../lib/plugins";
import { matchSelector, readU256 } from "../lib/utils";
import {
  validateEvent,
  ytExpiryReachedSchema,
  ytInterestClaimedSchema,
  ytInterestFeeRateSetSchema,
  ytMintPYMultiSchema,
  ytMintPYSchema,
  ytPostExpiryDataSetSchema,
  ytPyIndexUpdatedSchema,
  ytRedeemPYMultiSchema,
  ytRedeemPYPostExpirySchema,
  ytRedeemPYSchema,
  ytRedeemPYWithInterestSchema,
  ytTreasuryInterestRedeemedSchema,
} from "../lib/validation";

const log = createIndexerLogger("yt");

// Factory event to discover YT contracts
const YIELD_CONTRACTS_CREATED = getSelector("YieldContractsCreated");

// YT events
const MINT_PY = getSelector("MintPY");
const REDEEM_PY = getSelector("RedeemPY");
const REDEEM_PY_POST_EXPIRY = getSelector("RedeemPYPostExpiry");
const INTEREST_CLAIMED = getSelector("InterestClaimed");
const EXPIRY_REACHED = getSelector("ExpiryReached");

// New YT events (Pendle-style interest system)
const TREASURY_INTEREST_REDEEMED = getSelector("TreasuryInterestRedeemed");
const INTEREST_FEE_RATE_SET = getSelector("InterestFeeRateSet");
const MINT_PY_MULTI = getSelector("MintPYMulti");
const REDEEM_PY_MULTI = getSelector("RedeemPYMulti");
const REDEEM_PY_WITH_INTEREST = getSelector("RedeemPYWithInterest");
const POST_EXPIRY_DATA_SET = getSelector("PostExpiryDataSet");
const PY_INDEX_UPDATED = getSelector("PyIndexUpdated");

export default function ytIndexer(runtimeConfig: ApibaraRuntimeConfig) {
  const config = getNetworkConfig(runtimeConfig.network);
  const streamUrl =
    runtimeConfig.starknet?.streamUrl ?? "http://localhost:7171";

  const database = drizzle(
    getDrizzleOptions({
      ytMintPY,
      ytRedeemPY,
      ytRedeemPYPostExpiry,
      ytInterestClaimed,
      ytExpiryReached,
      // New tables (Pendle-style interest system)
      ytPostExpiryDataSet,
      ytPyIndexUpdated,
      ytTreasuryInterestRedeemed,
      ytInterestFeeRateSet,
      ytMintPYMulti,
      ytRedeemPYMulti,
      ytRedeemPYWithInterest,
    })
  );

  logIndexerStart(log, {
    streamUrl,
    startingBlock: config.startingBlock,
    knownContracts: config.knownYTContracts.length,
  });

  // Build initial filter with factory event + known YT contracts
  // This ensures the indexer works correctly after restarts when the checkpoint
  // is past the block where YieldContractsCreated was emitted
  const knownYTFilters = config.knownYTContracts.flatMap(
    (ytAddress: `0x${string}`) => [
      { address: ytAddress, keys: [MINT_PY] },
      { address: ytAddress, keys: [REDEEM_PY] },
      { address: ytAddress, keys: [REDEEM_PY_POST_EXPIRY] },
      { address: ytAddress, keys: [INTEREST_CLAIMED] },
      { address: ytAddress, keys: [EXPIRY_REACHED] },
      // New events (Pendle-style interest system)
      { address: ytAddress, keys: [TREASURY_INTEREST_REDEEMED] },
      { address: ytAddress, keys: [INTEREST_FEE_RATE_SET] },
      { address: ytAddress, keys: [MINT_PY_MULTI] },
      { address: ytAddress, keys: [REDEEM_PY_MULTI] },
      { address: ytAddress, keys: [REDEEM_PY_WITH_INTEREST] },
      { address: ytAddress, keys: [POST_EXPIRY_DATA_SET] },
      { address: ytAddress, keys: [PY_INDEX_UPDATED] },
    ]
  );

  return defineIndexer(StarknetStream)({
    streamUrl,
    finality: "accepted",
    startingCursor: { orderKey: BigInt(config.startingBlock) },
    debug: false,
    plugins: [
      streamTimeoutPlugin(),
      drizzleStorage({
        db: database,
        idColumn: { "*": "_id" },
        persistState: true,
        indexerName: "yt",
        migrate: { migrationsFolder: "./drizzle" },
      }),
    ],
    // Initial filter: listen to Factory for new YT contracts + known YT contracts
    filter: {
      header: "always",
      events: [
        { address: config.factory, keys: [YIELD_CONTRACTS_CREATED] },
        ...knownYTFilters,
      ],
    },
    // Factory function: dynamically add filters for discovered YT contracts
    async factory({ block: { events } }) {
      const newFilters = (events ?? []).flatMap((event) => {
        if (!matchSelector(event.keys[0], YIELD_CONTRACTS_CREATED)) return [];

        // YieldContractsCreated: keys = [selector, sy, expiry], data = [pt, yt, creator]
        const ytAddress = event.data[1]!;

        logContractDiscovery(log, "YT", ytAddress);

        return [
          { address: ytAddress, keys: [MINT_PY] },
          { address: ytAddress, keys: [REDEEM_PY] },
          { address: ytAddress, keys: [REDEEM_PY_POST_EXPIRY] },
          { address: ytAddress, keys: [INTEREST_CLAIMED] },
          { address: ytAddress, keys: [EXPIRY_REACHED] },
          // New events (Pendle-style interest system)
          { address: ytAddress, keys: [TREASURY_INTEREST_REDEEMED] },
          { address: ytAddress, keys: [INTEREST_FEE_RATE_SET] },
          { address: ytAddress, keys: [MINT_PY_MULTI] },
          { address: ytAddress, keys: [REDEEM_PY_MULTI] },
          { address: ytAddress, keys: [REDEEM_PY_WITH_INTEREST] },
          { address: ytAddress, keys: [POST_EXPIRY_DATA_SET] },
          { address: ytAddress, keys: [PY_INDEX_UPDATED] },
        ];
      });

      if (newFilters.length === 0) return {};

      return {
        filter: {
          events: newFilters,
        },
      };
    },
    async transform({ block, endCursor }) {
      const blockNum = Number(block.header.blockNumber);
      logBlockProgress(log, blockNum, endCursor?.orderKey);

      if (block.events.length === 0) return;

      const { db } = useDrizzleStorage();
      const { events, header } = block;

      const blockNumber = Number(header.blockNumber);
      const blockTimestamp = header.timestamp;

      // Collect events by type for batch insert
      type MintPYRow = typeof ytMintPY.$inferInsert;
      type RedeemPYRow = typeof ytRedeemPY.$inferInsert;
      type RedeemPostExpiryRow = typeof ytRedeemPYPostExpiry.$inferInsert;
      type InterestClaimedRow = typeof ytInterestClaimed.$inferInsert;
      type ExpiryReachedRow = typeof ytExpiryReached.$inferInsert;
      // New types (Pendle-style interest system)
      type PostExpiryDataSetRow = typeof ytPostExpiryDataSet.$inferInsert;
      type PyIndexUpdatedRow = typeof ytPyIndexUpdated.$inferInsert;
      type TreasuryInterestRedeemedRow =
        typeof ytTreasuryInterestRedeemed.$inferInsert;
      type InterestFeeRateSetRow = typeof ytInterestFeeRateSet.$inferInsert;
      type MintPYMultiRow = typeof ytMintPYMulti.$inferInsert;
      type RedeemPYMultiRow = typeof ytRedeemPYMulti.$inferInsert;
      type RedeemPYWithInterestRow = typeof ytRedeemPYWithInterest.$inferInsert;

      const mintPYRows: MintPYRow[] = [];
      const redeemPYRows: RedeemPYRow[] = [];
      const redeemPostExpiryRows: RedeemPostExpiryRow[] = [];
      const interestClaimedRows: InterestClaimedRow[] = [];
      const expiryReachedRows: ExpiryReachedRow[] = [];
      // New arrays (Pendle-style interest system)
      const postExpiryDataSetRows: PostExpiryDataSetRow[] = [];
      const pyIndexUpdatedRows: PyIndexUpdatedRow[] = [];
      const treasuryInterestRedeemedRows: TreasuryInterestRedeemedRow[] = [];
      const interestFeeRateSetRows: InterestFeeRateSetRow[] = [];
      const mintPYMultiRows: MintPYMultiRow[] = [];
      const redeemPYMultiRows: RedeemPYMultiRow[] = [];
      const redeemPYWithInterestRows: RedeemPYWithInterestRow[] = [];

      // Track errors for this block
      let errorCount = 0;

      for (let i = 0; i < events.length; i++) {
        const event = events.at(i)!;
        const transactionHash = event.transactionHash;
        const eventKey = event.keys[0];
        const ytAddress = event.address;
        // Use event.eventIndex from Apibara, fallback to array position
        const eventIndex = event.eventIndex ?? i;

        try {
          if (matchSelector(eventKey, MINT_PY)) {
            // Validate event structure
            const validated = validateEvent(ytMintPYSchema, event, {
              indexer: "yt",
              eventName: "MintPY",
              blockNumber,
              transactionHash,
            });
            if (!validated) {
              errorCount++;
              continue;
            }

            // NEW layout: keys[selector, caller, receiver_pt, receiver_yt]
            const caller = validated.keys[1] ?? "";
            const receiverPt = validated.keys[2] ?? "";
            const receiverYt = validated.keys[3] ?? "";

            // NEW layout: data[expiry, amount_sy_deposited(u256), amount_py_minted(u256), pt, sy, py_index(u256),
            //             exchange_rate(u256), total_pt_supply(u256), total_yt_supply(u256), timestamp]
            const data = validated.data;
            const expiry = Number(BigInt(data[0] ?? "0"));
            const amountSyDeposited = readU256(data, 1, "amount_sy_deposited");
            const amountPyMinted = readU256(data, 3, "amount_py_minted");
            const pt = data[5] ?? "";
            const sy = data[6] ?? "";
            const pyIndex = readU256(data, 7, "py_index");
            const exchangeRate = readU256(data, 9, "exchange_rate");
            const totalPtSupply = readU256(data, 11, "total_pt_supply");
            const totalYtSupply = readU256(data, 13, "total_yt_supply");

            mintPYRows.push({
              block_number: blockNumber,
              block_timestamp: blockTimestamp,
              transaction_hash: transactionHash,
              event_index: eventIndex,
              caller,
              receiver_pt: receiverPt,
              receiver_yt: receiverYt,
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
            });
          } else if (matchSelector(eventKey, REDEEM_PY)) {
            // Validate event structure
            const validated = validateEvent(ytRedeemPYSchema, event, {
              indexer: "yt",
              eventName: "RedeemPY",
              blockNumber,
              transactionHash,
            });
            if (!validated) {
              errorCount++;
              continue;
            }

            const caller = validated.keys[1] ?? "";
            const receiver = validated.keys[2] ?? "";
            const expiry = Number(BigInt(validated.keys[3] ?? "0"));

            const data = validated.data;
            const sy = data[0] ?? "";
            const pt = data[1] ?? "";
            const amountPyRedeemed = readU256(data, 2, "amount_py_redeemed");
            const amountSyReturned = readU256(data, 4, "amount_sy_returned");
            const pyIndex = readU256(data, 6, "py_index");
            const exchangeRate = readU256(data, 8, "exchange_rate");

            redeemPYRows.push({
              block_number: blockNumber,
              block_timestamp: blockTimestamp,
              transaction_hash: transactionHash,
              event_index: eventIndex,
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
            });
          } else if (matchSelector(eventKey, REDEEM_PY_POST_EXPIRY)) {
            // Validate event structure
            const validated = validateEvent(ytRedeemPYPostExpirySchema, event, {
              indexer: "yt",
              eventName: "RedeemPYPostExpiry",
              blockNumber,
              transactionHash,
            });
            if (!validated) {
              errorCount++;
              continue;
            }

            const caller = validated.keys[1] ?? "";
            const receiver = validated.keys[2] ?? "";
            const expiry = Number(BigInt(validated.keys[3] ?? "0"));

            const data = validated.data;
            const amountPtRedeemed = readU256(data, 0, "amount_pt_redeemed");
            const amountSyReturned = readU256(data, 2, "amount_sy_returned");
            const pt = data[4] ?? "";
            const sy = data[5] ?? "";
            const finalPyIndex = readU256(data, 6, "final_py_index");
            const finalExchangeRate = readU256(data, 8, "final_exchange_rate");

            redeemPostExpiryRows.push({
              block_number: blockNumber,
              block_timestamp: blockTimestamp,
              transaction_hash: transactionHash,
              event_index: eventIndex,
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
            });
          } else if (matchSelector(eventKey, INTEREST_CLAIMED)) {
            // Validate event structure
            const validated = validateEvent(ytInterestClaimedSchema, event, {
              indexer: "yt",
              eventName: "InterestClaimed",
              blockNumber,
              transactionHash,
            });
            if (!validated) {
              errorCount++;
              continue;
            }

            const user = validated.keys[1] ?? "";
            const yt = validated.keys[2] ?? ytAddress;
            const expiry = Number(BigInt(validated.keys[3] ?? "0"));

            const data = validated.data;
            const amountSy = readU256(data, 0, "amount_sy");
            const sy = data[2] ?? "";
            const ytBalance = readU256(data, 3, "yt_balance");
            const pyIndexAtClaim = readU256(data, 5, "py_index_at_claim");
            const exchangeRate = readU256(data, 7, "exchange_rate");

            interestClaimedRows.push({
              block_number: blockNumber,
              block_timestamp: blockTimestamp,
              transaction_hash: transactionHash,
              event_index: eventIndex,
              user,
              yt,
              expiry,
              sy,
              amount_sy: amountSy,
              yt_balance: ytBalance,
              py_index_at_claim: pyIndexAtClaim,
              exchange_rate: exchangeRate,
            });
          } else if (matchSelector(eventKey, EXPIRY_REACHED)) {
            // Validate event structure
            const validated = validateEvent(ytExpiryReachedSchema, event, {
              indexer: "yt",
              eventName: "ExpiryReached",
              blockNumber,
              transactionHash,
            });
            if (!validated) {
              errorCount++;
              continue;
            }

            const market = validated.keys[1] ?? "";
            const yt = validated.keys[2] ?? ytAddress;
            const pt = validated.keys[3] ?? "";

            const data = validated.data;
            const sy = data[0] ?? "";
            const expiry = Number(BigInt(data[1] ?? "0"));
            const finalExchangeRate = readU256(data, 2, "final_exchange_rate");
            const finalPyIndex = readU256(data, 4, "final_py_index");
            const totalPtSupply = readU256(data, 6, "total_pt_supply");
            const totalYtSupply = readU256(data, 8, "total_yt_supply");
            const syReserve = readU256(data, 10, "sy_reserve");
            const ptReserve = readU256(data, 12, "pt_reserve");

            expiryReachedRows.push({
              block_number: blockNumber,
              block_timestamp: blockTimestamp,
              transaction_hash: transactionHash,
              event_index: eventIndex,
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
            });
          } else if (matchSelector(eventKey, POST_EXPIRY_DATA_SET)) {
            const validated = validateEvent(ytPostExpiryDataSetSchema, event, {
              indexer: "yt",
              eventName: "PostExpiryDataSet",
              blockNumber,
              transactionHash,
            });
            if (!validated) {
              errorCount++;
              continue;
            }

            // keys: [selector, yt, pt]
            const yt = validated.keys[1] ?? ytAddress;
            const pt = validated.keys[2] ?? "";

            // data: [sy, expiry, first_py_index(u256), exchange_rate_at_init(u256),
            //        total_pt_supply(u256), total_yt_supply(u256), timestamp]
            const data = validated.data;
            const sy = data[0] ?? "";
            const expiry = Number(BigInt(data[1] ?? "0"));
            const firstPyIndex = readU256(data, 2, "first_py_index");
            const exchangeRateAtInit = readU256(
              data,
              4,
              "exchange_rate_at_init"
            );
            const totalPtSupply = readU256(data, 6, "total_pt_supply");
            const totalYtSupply = readU256(data, 8, "total_yt_supply");

            postExpiryDataSetRows.push({
              block_number: blockNumber,
              block_timestamp: blockTimestamp,
              transaction_hash: transactionHash,
              event_index: eventIndex,
              yt,
              pt,
              sy,
              expiry,
              first_py_index: firstPyIndex,
              exchange_rate_at_init: exchangeRateAtInit,
              total_pt_supply: totalPtSupply,
              total_yt_supply: totalYtSupply,
            });
          } else if (matchSelector(eventKey, PY_INDEX_UPDATED)) {
            const validated = validateEvent(ytPyIndexUpdatedSchema, event, {
              indexer: "yt",
              eventName: "PyIndexUpdated",
              blockNumber,
              transactionHash,
            });
            if (!validated) {
              errorCount++;
              continue;
            }

            // keys: [selector, yt]
            const yt = validated.keys[1] ?? ytAddress;

            // data: [old_index(u256), new_index(u256), exchange_rate(u256), block_number, timestamp]
            const data = validated.data;
            const oldIndex = readU256(data, 0, "old_index");
            const newIndex = readU256(data, 2, "new_index");
            const exchangeRate = readU256(data, 4, "exchange_rate");
            const indexBlockNumber = Number(BigInt(data[6] ?? "0"));

            pyIndexUpdatedRows.push({
              block_number: blockNumber,
              block_timestamp: blockTimestamp,
              transaction_hash: transactionHash,
              event_index: eventIndex,
              yt,
              old_index: oldIndex,
              new_index: newIndex,
              exchange_rate: exchangeRate,
              index_block_number: indexBlockNumber,
            });
          } else if (matchSelector(eventKey, TREASURY_INTEREST_REDEEMED)) {
            const validated = validateEvent(
              ytTreasuryInterestRedeemedSchema,
              event,
              {
                indexer: "yt",
                eventName: "TreasuryInterestRedeemed",
                blockNumber,
                transactionHash,
              }
            );
            if (!validated) {
              errorCount++;
              continue;
            }

            // keys: [selector, yt, treasury]
            const yt = validated.keys[1] ?? ytAddress;
            const treasury = validated.keys[2] ?? "";

            // data: [amount_sy(u256), sy, expiry_index(u256), current_index(u256), total_yt_supply(u256), timestamp]
            const data = validated.data;
            const amountSy = readU256(data, 0, "amount_sy");
            const sy = data[2] ?? "";
            const expiryIndex = readU256(data, 3, "expiry_index");
            const currentIndex = readU256(data, 5, "current_index");
            const totalYtSupply = readU256(data, 7, "total_yt_supply");

            treasuryInterestRedeemedRows.push({
              block_number: blockNumber,
              block_timestamp: blockTimestamp,
              transaction_hash: transactionHash,
              event_index: eventIndex,
              yt,
              treasury,
              amount_sy: amountSy,
              sy,
              expiry_index: expiryIndex,
              current_index: currentIndex,
              total_yt_supply: totalYtSupply,
            });
          } else if (matchSelector(eventKey, INTEREST_FEE_RATE_SET)) {
            const validated = validateEvent(ytInterestFeeRateSetSchema, event, {
              indexer: "yt",
              eventName: "InterestFeeRateSet",
              blockNumber,
              transactionHash,
            });
            if (!validated) {
              errorCount++;
              continue;
            }

            // keys: [selector, yt]
            const yt = validated.keys[1] ?? ytAddress;

            // data: [old_rate(u256), new_rate(u256), timestamp]
            const data = validated.data;
            const oldRate = readU256(data, 0, "old_rate");
            const newRate = readU256(data, 2, "new_rate");

            interestFeeRateSetRows.push({
              block_number: blockNumber,
              block_timestamp: blockTimestamp,
              transaction_hash: transactionHash,
              event_index: eventIndex,
              yt,
              old_rate: oldRate,
              new_rate: newRate,
            });
          } else if (matchSelector(eventKey, MINT_PY_MULTI)) {
            const validated = validateEvent(ytMintPYMultiSchema, event, {
              indexer: "yt",
              eventName: "MintPYMulti",
              blockNumber,
              transactionHash,
            });
            if (!validated) {
              errorCount++;
              continue;
            }

            // keys: [selector, caller, expiry]
            const caller = validated.keys[1] ?? "";
            const expiry = Number(BigInt(validated.keys[2] ?? "0"));

            // data: [total_sy_deposited(u256), total_py_minted(u256), receiver_count, timestamp]
            const data = validated.data;
            const totalSyDeposited = readU256(data, 0, "total_sy_deposited");
            const totalPyMinted = readU256(data, 2, "total_py_minted");
            const receiverCount = Number(BigInt(data[4] ?? "0"));

            mintPYMultiRows.push({
              block_number: blockNumber,
              block_timestamp: blockTimestamp,
              transaction_hash: transactionHash,
              event_index: eventIndex,
              caller,
              expiry,
              yt: ytAddress,
              total_sy_deposited: totalSyDeposited,
              total_py_minted: totalPyMinted,
              receiver_count: receiverCount,
            });
          } else if (matchSelector(eventKey, REDEEM_PY_MULTI)) {
            const validated = validateEvent(ytRedeemPYMultiSchema, event, {
              indexer: "yt",
              eventName: "RedeemPYMulti",
              blockNumber,
              transactionHash,
            });
            if (!validated) {
              errorCount++;
              continue;
            }

            // keys: [selector, caller, expiry]
            const caller = validated.keys[1] ?? "";
            const expiry = Number(BigInt(validated.keys[2] ?? "0"));

            // data: [total_py_redeemed(u256), total_sy_returned(u256), receiver_count, timestamp]
            const data = validated.data;
            const totalPyRedeemed = readU256(data, 0, "total_py_redeemed");
            const totalSyReturned = readU256(data, 2, "total_sy_returned");
            const receiverCount = Number(BigInt(data[4] ?? "0"));

            redeemPYMultiRows.push({
              block_number: blockNumber,
              block_timestamp: blockTimestamp,
              transaction_hash: transactionHash,
              event_index: eventIndex,
              caller,
              expiry,
              yt: ytAddress,
              total_py_redeemed: totalPyRedeemed,
              total_sy_returned: totalSyReturned,
              receiver_count: receiverCount,
            });
          } else if (matchSelector(eventKey, REDEEM_PY_WITH_INTEREST)) {
            const validated = validateEvent(
              ytRedeemPYWithInterestSchema,
              event,
              {
                indexer: "yt",
                eventName: "RedeemPYWithInterest",
                blockNumber,
                transactionHash,
              }
            );
            if (!validated) {
              errorCount++;
              continue;
            }

            // keys: [selector, caller, receiver, expiry]
            const caller = validated.keys[1] ?? "";
            const receiver = validated.keys[2] ?? "";
            const expiry = Number(BigInt(validated.keys[3] ?? "0"));

            // data: [amount_py_redeemed(u256), amount_sy_from_redeem(u256), amount_interest_claimed(u256), timestamp]
            const data = validated.data;
            const amountPyRedeemed = readU256(data, 0, "amount_py_redeemed");
            const amountSyFromRedeem = readU256(
              data,
              2,
              "amount_sy_from_redeem"
            );
            const amountInterestClaimed = readU256(
              data,
              4,
              "amount_interest_claimed"
            );

            redeemPYWithInterestRows.push({
              block_number: blockNumber,
              block_timestamp: blockTimestamp,
              transaction_hash: transactionHash,
              event_index: eventIndex,
              caller,
              receiver,
              expiry,
              yt: ytAddress,
              amount_py_redeemed: amountPyRedeemed,
              amount_sy_from_redeem: amountSyFromRedeem,
              amount_interest_claimed: amountInterestClaimed,
            });
          }
        } catch (err) {
          // Re-throw programmer errors - these should crash the indexer
          if (isProgrammerError(err)) {
            throw err;
          }

          // Log data errors and continue processing
          log.error(
            {
              err,
              blockNumber,
              transactionHash,
              eventIndex,
              eventKey,
            },
            "Event processing failed"
          );
          errorCount++;
        }
      }

      // Log if block had errors
      if (errorCount > 0) {
        log.warn(
          {
            blockNumber,
            errorCount,
            totalEvents: events.length,
          },
          "Block completed with errors"
        );
      }

      // Batch insert with transaction wrapping and conflict handling for idempotency
      await measureDbLatency("yt", async () => {
        await db.transaction(async (tx) => {
          if (mintPYRows.length > 0) {
            await tx.insert(ytMintPY).values(mintPYRows).onConflictDoNothing();
          }
          if (redeemPYRows.length > 0) {
            await tx
              .insert(ytRedeemPY)
              .values(redeemPYRows)
              .onConflictDoNothing();
          }
          if (redeemPostExpiryRows.length > 0) {
            await tx
              .insert(ytRedeemPYPostExpiry)
              .values(redeemPostExpiryRows)
              .onConflictDoNothing();
          }
          if (interestClaimedRows.length > 0) {
            await tx
              .insert(ytInterestClaimed)
              .values(interestClaimedRows)
              .onConflictDoNothing();
          }
          if (expiryReachedRows.length > 0) {
            await tx
              .insert(ytExpiryReached)
              .values(expiryReachedRows)
              .onConflictDoNothing();
          }
          if (postExpiryDataSetRows.length > 0) {
            await tx
              .insert(ytPostExpiryDataSet)
              .values(postExpiryDataSetRows)
              .onConflictDoNothing();
          }
          if (pyIndexUpdatedRows.length > 0) {
            await tx
              .insert(ytPyIndexUpdated)
              .values(pyIndexUpdatedRows)
              .onConflictDoNothing();
          }
          if (treasuryInterestRedeemedRows.length > 0) {
            await tx
              .insert(ytTreasuryInterestRedeemed)
              .values(treasuryInterestRedeemedRows)
              .onConflictDoNothing();
          }
          if (interestFeeRateSetRows.length > 0) {
            await tx
              .insert(ytInterestFeeRateSet)
              .values(interestFeeRateSetRows)
              .onConflictDoNothing();
          }
          if (mintPYMultiRows.length > 0) {
            await tx
              .insert(ytMintPYMulti)
              .values(mintPYMultiRows)
              .onConflictDoNothing();
          }
          if (redeemPYMultiRows.length > 0) {
            await tx
              .insert(ytRedeemPYMulti)
              .values(redeemPYMultiRows)
              .onConflictDoNothing();
          }
          if (redeemPYWithInterestRows.length > 0) {
            await tx
              .insert(ytRedeemPYWithInterest)
              .values(redeemPYWithInterestRows)
              .onConflictDoNothing();
          }
        });
      });

      // Record metrics
      const successCount =
        mintPYRows.length +
        redeemPYRows.length +
        redeemPostExpiryRows.length +
        interestClaimedRows.length +
        expiryReachedRows.length +
        postExpiryDataSetRows.length +
        pyIndexUpdatedRows.length +
        treasuryInterestRedeemedRows.length +
        interestFeeRateSetRows.length +
        mintPYMultiRows.length +
        redeemPYMultiRows.length +
        redeemPYWithInterestRows.length;
      recordEvents("yt", successCount, errorCount);
      recordBlock("yt", blockNumber);

      logBatchInsert(log, blockNum, events.length);
    },
  });
}
