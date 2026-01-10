/**
 * Market (AMM) Indexer
 *
 * Uses factory pattern to discover Market contracts from MarketFactory.MarketCreated events.
 *
 * Indexes events from Market contracts:
 * - Mint: Adding liquidity to the market
 * - Burn: Removing liquidity from the market
 * - BurnWithReceivers: Removing liquidity with separate SY/PT receivers
 * - Swap: Swapping PT/SY in the market
 * - ImpliedRateUpdated: Implied rate changes
 * - FeesCollected: Protocol fees collected
 * - ScalarRootUpdated: Scalar root parameter changes (admin)
 * - ReserveFeeTransferred: Reserve fees transferred to treasury
 * - RewardsClaimed: LP rewards claimed by users
 * - RewardIndexUpdated: LP reward index updates (for APY calculation)
 * - RewardTokenAdded: New reward tokens added to market
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
  marketBurn,
  marketBurnWithReceivers,
  marketFeesCollected,
  marketImpliedRateUpdated,
  marketMint,
  marketReserveFeeTransferred,
  marketRewardIndexUpdated,
  marketRewardsClaimed,
  marketRewardTokenAdded,
  marketScalarRootUpdated,
  marketSwap,
} from "@/schema";
import { getNetworkConfig } from "../lib/constants";
import { getDrizzleOptions } from "../lib/database";
import { isProgrammerError } from "../lib/errors";
import {
  createIndexerLogger,
  logBatchInsert,
  logBlockProgress,
  logIndexerStart,
} from "../lib/logger";
import { measureDbLatency, recordBlock, recordEvents } from "../lib/metrics";
import { streamTimeoutPlugin } from "../lib/plugins";
import { matchSelector, readU256 } from "../lib/utils";
import {
  marketBurnSchema,
  marketBurnWithReceiversSchema,
  marketFeesCollectedSchema,
  marketImpliedRateUpdatedSchema,
  marketMintSchema,
  marketReserveFeeTransferredSchema,
  marketRewardIndexUpdatedSchema,
  marketRewardsClaimedSchema,
  marketRewardTokenAddedSchema,
  marketScalarRootUpdatedSchema,
  marketSwapSchema,
  validateEvent,
} from "../lib/validation";

// MarketFactory event to discover Market contracts
const MARKET_CREATED = getSelector("MarketCreated");

// Market events
const MINT = getSelector("Mint");
const BURN = getSelector("Burn");
const SWAP = getSelector("Swap");
const IMPLIED_RATE_UPDATED = getSelector("ImpliedRateUpdated");
const FEES_COLLECTED = getSelector("FeesCollected");
const SCALAR_ROOT_UPDATED = getSelector("ScalarRootUpdated");
const RESERVE_FEE_TRANSFERRED = getSelector("ReserveFeeTransferred");
// New Market events (LP rewards and burn with receivers)
const BURN_WITH_RECEIVERS = getSelector("BurnWithReceivers");
const REWARDS_CLAIMED = getSelector("RewardsClaimed");
const REWARD_INDEX_UPDATED = getSelector("RewardIndexUpdated");
const REWARD_TOKEN_ADDED = getSelector("RewardTokenAdded");

const log = createIndexerLogger("market");

export default function marketIndexer(runtimeConfig: ApibaraRuntimeConfig) {
  const config = getNetworkConfig(runtimeConfig.network);
  const streamUrl =
    runtimeConfig.starknet?.streamUrl ?? "http://localhost:7171";

  const database = drizzle(
    getDrizzleOptions({
      marketMint,
      marketBurn,
      marketBurnWithReceivers,
      marketSwap,
      marketImpliedRateUpdated,
      marketFeesCollected,
      marketScalarRootUpdated,
      marketReserveFeeTransferred,
      marketRewardsClaimed,
      marketRewardIndexUpdated,
      marketRewardTokenAdded,
    })
  );

  logIndexerStart(log, {
    streamUrl,
    startingBlock: config.startingBlock,
    knownContracts: config.knownMarkets.length,
  });

  // Build initial filter with factory event + known Market contracts
  // This ensures the indexer works correctly after restarts when the checkpoint
  // is past the block where MarketCreated was emitted
  const knownMarketFilters = config.knownMarkets.flatMap(
    (marketAddress: `0x${string}`) => [
      { address: marketAddress, keys: [MINT] },
      { address: marketAddress, keys: [BURN] },
      { address: marketAddress, keys: [BURN_WITH_RECEIVERS] },
      { address: marketAddress, keys: [SWAP] },
      { address: marketAddress, keys: [IMPLIED_RATE_UPDATED] },
      { address: marketAddress, keys: [FEES_COLLECTED] },
      { address: marketAddress, keys: [SCALAR_ROOT_UPDATED] },
      { address: marketAddress, keys: [RESERVE_FEE_TRANSFERRED] },
      { address: marketAddress, keys: [REWARDS_CLAIMED] },
      { address: marketAddress, keys: [REWARD_INDEX_UPDATED] },
      { address: marketAddress, keys: [REWARD_TOKEN_ADDED] },
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
        indexerName: "market",
        migrate: { migrationsFolder: "./drizzle" },
      }),
    ],
    // Initial filter: listen to MarketFactory for new Market contracts + known Market contracts
    filter: {
      header: "always",
      events: [
        { address: config.marketFactory, keys: [MARKET_CREATED] },
        ...knownMarketFilters,
      ],
    },
    // Factory function: dynamically add filters for discovered Market contracts
    async factory({ block: { events } }) {
      const newFilters = (events ?? []).flatMap((event) => {
        if (!matchSelector(event.keys[0], MARKET_CREATED)) return [];

        // MarketCreated: keys = [selector, pt, expiry], data = [market, ...]
        const marketAddress = event.data[0]!;

        return [
          { address: marketAddress, keys: [MINT] },
          { address: marketAddress, keys: [BURN] },
          { address: marketAddress, keys: [BURN_WITH_RECEIVERS] },
          { address: marketAddress, keys: [SWAP] },
          { address: marketAddress, keys: [IMPLIED_RATE_UPDATED] },
          { address: marketAddress, keys: [FEES_COLLECTED] },
          { address: marketAddress, keys: [SCALAR_ROOT_UPDATED] },
          { address: marketAddress, keys: [RESERVE_FEE_TRANSFERRED] },
          { address: marketAddress, keys: [REWARDS_CLAIMED] },
          { address: marketAddress, keys: [REWARD_INDEX_UPDATED] },
          { address: marketAddress, keys: [REWARD_TOKEN_ADDED] },
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
      type MintRow = typeof marketMint.$inferInsert;
      type BurnRow = typeof marketBurn.$inferInsert;
      type BurnWithReceiversRow = typeof marketBurnWithReceivers.$inferInsert;
      type SwapRow = typeof marketSwap.$inferInsert;
      type ImpliedRateRow = typeof marketImpliedRateUpdated.$inferInsert;
      type FeesRow = typeof marketFeesCollected.$inferInsert;
      type ScalarRootRow = typeof marketScalarRootUpdated.$inferInsert;
      type ReserveFeeRow = typeof marketReserveFeeTransferred.$inferInsert;
      type RewardsClaimedRow = typeof marketRewardsClaimed.$inferInsert;
      type RewardIndexUpdatedRow = typeof marketRewardIndexUpdated.$inferInsert;
      type RewardTokenAddedRow = typeof marketRewardTokenAdded.$inferInsert;

      const mintRows: MintRow[] = [];
      const burnRows: BurnRow[] = [];
      const burnWithReceiversRows: BurnWithReceiversRow[] = [];
      const swapRows: SwapRow[] = [];
      const impliedRateRows: ImpliedRateRow[] = [];
      const feesRows: FeesRow[] = [];
      const scalarRootRows: ScalarRootRow[] = [];
      const reserveFeeRows: ReserveFeeRow[] = [];
      const rewardsClaimedRows: RewardsClaimedRow[] = [];
      const rewardIndexUpdatedRows: RewardIndexUpdatedRow[] = [];
      const rewardTokenAddedRows: RewardTokenAddedRow[] = [];

      // Track errors for this block
      let errorCount = 0;

      for (let i = 0; i < events.length; i++) {
        const event = events.at(i)!;
        const transactionHash = event.transactionHash;
        const eventKey = event.keys[0];
        const marketAddress = event.address;
        // Use event.eventIndex from Apibara, fallback to array position
        const eventIndex = event.eventIndex ?? i;

        try {
          if (matchSelector(eventKey, MINT)) {
            // Validate event structure
            const validated = validateEvent(marketMintSchema, event, {
              indexer: "market",
              eventName: "Mint",
              blockNumber,
              transactionHash,
            });
            if (!validated) {
              errorCount++;
              continue;
            }

            const sender = validated.keys[1] ?? "";
            const receiver = validated.keys[2] ?? "";
            const expiry = Number(BigInt(validated.keys[3] ?? "0"));

            const data = validated.data;
            const sy = data[0] ?? "";
            const pt = data[1] ?? "";
            const syAmount = readU256(data, 2, "sy_amount");
            const ptAmount = readU256(data, 4, "pt_amount");
            const lpAmount = readU256(data, 6, "lp_amount");
            const exchangeRate = readU256(data, 8, "exchange_rate");
            const impliedRate = readU256(data, 10, "implied_rate");
            const syReserve = readU256(data, 12, "sy_reserve");
            const ptReserve = readU256(data, 14, "pt_reserve");
            const totalLp = readU256(data, 16, "total_lp");

            mintRows.push({
              block_number: blockNumber,
              block_timestamp: blockTimestamp,
              transaction_hash: transactionHash,
              event_index: eventIndex,
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
            });
          } else if (matchSelector(eventKey, BURN)) {
            // Validate event structure
            const validated = validateEvent(marketBurnSchema, event, {
              indexer: "market",
              eventName: "Burn",
              blockNumber,
              transactionHash,
            });
            if (!validated) {
              errorCount++;
              continue;
            }

            const sender = validated.keys[1] ?? "";
            const receiver = validated.keys[2] ?? "";
            const expiry = Number(BigInt(validated.keys[3] ?? "0"));

            const data = validated.data;
            const sy = data[0] ?? "";
            const pt = data[1] ?? "";
            const lpAmount = readU256(data, 2, "lp_amount");
            const syAmount = readU256(data, 4, "sy_amount");
            const ptAmount = readU256(data, 6, "pt_amount");
            const exchangeRate = readU256(data, 8, "exchange_rate");
            const impliedRate = readU256(data, 10, "implied_rate");
            const syReserve = readU256(data, 12, "sy_reserve");
            const ptReserve = readU256(data, 14, "pt_reserve");
            const totalLp = readU256(data, 16, "total_lp");

            burnRows.push({
              block_number: blockNumber,
              block_timestamp: blockTimestamp,
              transaction_hash: transactionHash,
              event_index: eventIndex,
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
            });
          } else if (matchSelector(eventKey, SWAP)) {
            // Validate event structure
            const validated = validateEvent(marketSwapSchema, event, {
              indexer: "market",
              eventName: "Swap",
              blockNumber,
              transactionHash,
            });
            if (!validated) {
              errorCount++;
              continue;
            }

            const sender = validated.keys[1] ?? "";
            const receiver = validated.keys[2] ?? "";
            const expiry = Number(BigInt(validated.keys[3] ?? "0"));

            const data = validated.data;
            const sy = data[0] ?? "";
            const pt = data[1] ?? "";
            const ptIn = readU256(data, 2, "pt_in");
            const syIn = readU256(data, 4, "sy_in");
            const ptOut = readU256(data, 6, "pt_out");
            const syOut = readU256(data, 8, "sy_out");
            // Fee fields added in AMM curve integration (3 u256 fields = 6 data positions)
            const totalFee = readU256(data, 10, "total_fee");
            const lpFee = readU256(data, 12, "lp_fee");
            const reserveFee = readU256(data, 14, "reserve_fee");
            // Remaining fields shifted by 6 positions due to new fee fields
            const impliedRateBefore = readU256(data, 16, "implied_rate_before");
            const impliedRateAfter = readU256(data, 18, "implied_rate_after");
            const exchangeRate = readU256(data, 20, "exchange_rate");
            const syReserve = readU256(data, 22, "sy_reserve");
            const ptReserve = readU256(data, 24, "pt_reserve");

            swapRows.push({
              block_number: blockNumber,
              block_timestamp: blockTimestamp,
              transaction_hash: transactionHash,
              event_index: eventIndex,
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
              total_fee: totalFee,
              lp_fee: lpFee,
              reserve_fee: reserveFee,
              implied_rate_before: impliedRateBefore,
              implied_rate_after: impliedRateAfter,
              exchange_rate: exchangeRate,
              sy_reserve_after: syReserve,
              pt_reserve_after: ptReserve,
            });
          } else if (matchSelector(eventKey, IMPLIED_RATE_UPDATED)) {
            // Validate event structure
            const validated = validateEvent(
              marketImpliedRateUpdatedSchema,
              event,
              {
                indexer: "market",
                eventName: "ImpliedRateUpdated",
                blockNumber,
                transactionHash,
              }
            );
            if (!validated) {
              errorCount++;
              continue;
            }

            const market = validated.keys[1] ?? marketAddress;
            const expiry = Number(BigInt(validated.keys[2] ?? "0"));

            const data = validated.data;
            // Event structure:
            // data[0-1]: old_rate (u256)
            // data[2-3]: new_rate (u256)
            // data[4]: timestamp (u64)
            // data[5]: time_to_expiry (u64)
            // data[6-7]: exchange_rate (u256)
            // data[8-9]: sy_reserve (u256)
            // data[10-11]: pt_reserve (u256)
            // data[12-13]: total_lp (u256)
            const oldRate = readU256(data, 0, "old_rate");
            const newRate = readU256(data, 2, "new_rate");
            // Note: data[4] is timestamp, data[5] is time_to_expiry
            const timeToExpiry = Number(BigInt(data[5] ?? "0"));
            const exchangeRate = readU256(data, 6, "exchange_rate");
            const syReserve = readU256(data, 8, "sy_reserve");
            const ptReserve = readU256(data, 10, "pt_reserve");
            const totalLp = readU256(data, 12, "total_lp");

            impliedRateRows.push({
              block_number: blockNumber,
              block_timestamp: blockTimestamp,
              transaction_hash: transactionHash,
              event_index: eventIndex,
              market,
              expiry,
              old_rate: oldRate,
              new_rate: newRate,
              time_to_expiry: timeToExpiry,
              exchange_rate: exchangeRate,
              sy_reserve: syReserve,
              pt_reserve: ptReserve,
              total_lp: totalLp,
            });
          } else if (matchSelector(eventKey, FEES_COLLECTED)) {
            // Validate event structure
            const validated = validateEvent(marketFeesCollectedSchema, event, {
              indexer: "market",
              eventName: "FeesCollected",
              blockNumber,
              transactionHash,
            });
            if (!validated) {
              errorCount++;
              continue;
            }

            const collector = validated.keys[1] ?? "";
            const receiver = validated.keys[2] ?? "";
            const market = validated.keys[3] ?? marketAddress;

            const data = validated.data;
            const amount = readU256(data, 0, "amount");
            const expiry = Number(BigInt(data[2] ?? "0"));
            const lnFeeRateRoot = readU256(data, 3, "ln_fee_rate_root");

            feesRows.push({
              block_number: blockNumber,
              block_timestamp: blockTimestamp,
              transaction_hash: transactionHash,
              event_index: eventIndex,
              collector,
              receiver,
              market,
              amount,
              expiry,
              ln_fee_rate_root: lnFeeRateRoot,
            });
          } else if (matchSelector(eventKey, SCALAR_ROOT_UPDATED)) {
            // Validate event structure
            const validated = validateEvent(
              marketScalarRootUpdatedSchema,
              event,
              {
                indexer: "market",
                eventName: "ScalarRootUpdated",
                blockNumber,
                transactionHash,
              }
            );
            if (!validated) {
              errorCount++;
              continue;
            }

            // ScalarRootUpdated: keys = [selector, market], data = [old_value, new_value, timestamp]
            const market = validated.keys[1] ?? marketAddress;

            const data = validated.data;
            const oldValue = readU256(data, 0, "old_value");
            const newValue = readU256(data, 2, "new_value");

            scalarRootRows.push({
              block_number: blockNumber,
              block_timestamp: blockTimestamp,
              transaction_hash: transactionHash,
              event_index: eventIndex,
              market,
              old_value: oldValue,
              new_value: newValue,
            });
          } else if (matchSelector(eventKey, RESERVE_FEE_TRANSFERRED)) {
            // Validate event structure
            const validated = validateEvent(
              marketReserveFeeTransferredSchema,
              event,
              {
                indexer: "market",
                eventName: "ReserveFeeTransferred",
                blockNumber,
                transactionHash,
              }
            );
            if (!validated) {
              errorCount++;
              continue;
            }

            // ReserveFeeTransferred: keys = [selector, market, treasury, caller]
            // data = [amount(u256), expiry, timestamp]
            const market = validated.keys[1] ?? marketAddress;
            const treasury = validated.keys[2] ?? "";
            const caller = validated.keys[3] ?? "";

            const data = validated.data;
            const amount = readU256(data, 0, "amount");
            const expiry = Number(BigInt(data[2] ?? "0"));
            const timestamp = Number(BigInt(data[3] ?? "0"));

            reserveFeeRows.push({
              block_number: blockNumber,
              block_timestamp: blockTimestamp,
              transaction_hash: transactionHash,
              event_index: eventIndex,
              market,
              treasury,
              caller,
              amount,
              expiry,
              timestamp,
            });
          } else if (matchSelector(eventKey, BURN_WITH_RECEIVERS)) {
            // Validate event structure
            const validated = validateEvent(
              marketBurnWithReceiversSchema,
              event,
              {
                indexer: "market",
                eventName: "BurnWithReceivers",
                blockNumber,
                transactionHash,
              }
            );
            if (!validated) {
              errorCount++;
              continue;
            }

            // BurnWithReceivers: keys = [selector, sender, receiver_sy, receiver_pt]
            // data = [expiry, sy, pt, lp_amount(u256), sy_amount(u256), pt_amount(u256),
            //         exchange_rate(u256), implied_rate(u256), sy_reserve_after(u256),
            //         pt_reserve_after(u256), total_lp_after(u256), timestamp]
            const sender = validated.keys[1] ?? "";
            const receiverSy = validated.keys[2] ?? "";
            const receiverPt = validated.keys[3] ?? "";

            const data = validated.data;
            const expiry = Number(BigInt(data[0] ?? "0"));
            const sy = data[1] ?? "";
            const pt = data[2] ?? "";
            const lpAmount = readU256(data, 3, "lp_amount");
            const syAmount = readU256(data, 5, "sy_amount");
            const ptAmount = readU256(data, 7, "pt_amount");
            const exchangeRate = readU256(data, 9, "exchange_rate");
            const impliedRate = readU256(data, 11, "implied_rate");
            const syReserve = readU256(data, 13, "sy_reserve_after");
            const ptReserve = readU256(data, 15, "pt_reserve_after");
            const totalLp = readU256(data, 17, "total_lp_after");

            burnWithReceiversRows.push({
              block_number: blockNumber,
              block_timestamp: blockTimestamp,
              transaction_hash: transactionHash,
              event_index: eventIndex,
              sender,
              receiver_sy: receiverSy,
              receiver_pt: receiverPt,
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
            });
          } else if (matchSelector(eventKey, REWARDS_CLAIMED)) {
            // Validate event structure
            const validated = validateEvent(
              marketRewardsClaimedSchema,
              event,
              {
                indexer: "market",
                eventName: "RewardsClaimed",
                blockNumber,
                transactionHash,
              }
            );
            if (!validated) {
              errorCount++;
              continue;
            }

            // RewardsClaimed: keys = [selector, user, reward_token]
            // data = [amount(u256), timestamp]
            const user = validated.keys[1] ?? "";
            const rewardToken = validated.keys[2] ?? "";

            const data = validated.data;
            const amount = readU256(data, 0, "amount");
            const eventTimestamp = Number(BigInt(data[2] ?? "0"));

            rewardsClaimedRows.push({
              block_number: blockNumber,
              block_timestamp: blockTimestamp,
              transaction_hash: transactionHash,
              event_index: eventIndex,
              user,
              reward_token: rewardToken,
              market: marketAddress,
              amount,
              event_timestamp: eventTimestamp,
            });
          } else if (matchSelector(eventKey, REWARD_INDEX_UPDATED)) {
            // Validate event structure
            const validated = validateEvent(
              marketRewardIndexUpdatedSchema,
              event,
              {
                indexer: "market",
                eventName: "RewardIndexUpdated",
                blockNumber,
                transactionHash,
              }
            );
            if (!validated) {
              errorCount++;
              continue;
            }

            // RewardIndexUpdated: keys = [selector, reward_token]
            // data = [old_index(u256), new_index(u256), rewards_added(u256), total_supply(u256), timestamp]
            const rewardToken = validated.keys[1] ?? "";

            const data = validated.data;
            const oldIndex = readU256(data, 0, "old_index");
            const newIndex = readU256(data, 2, "new_index");
            const rewardsAdded = readU256(data, 4, "rewards_added");
            const totalSupply = readU256(data, 6, "total_supply");
            const eventTimestamp = Number(BigInt(data[8] ?? "0"));

            rewardIndexUpdatedRows.push({
              block_number: blockNumber,
              block_timestamp: blockTimestamp,
              transaction_hash: transactionHash,
              event_index: eventIndex,
              reward_token: rewardToken,
              market: marketAddress,
              old_index: oldIndex,
              new_index: newIndex,
              rewards_added: rewardsAdded,
              total_supply: totalSupply,
              event_timestamp: eventTimestamp,
            });
          } else if (matchSelector(eventKey, REWARD_TOKEN_ADDED)) {
            // Validate event structure
            const validated = validateEvent(
              marketRewardTokenAddedSchema,
              event,
              {
                indexer: "market",
                eventName: "RewardTokenAdded",
                blockNumber,
                transactionHash,
              }
            );
            if (!validated) {
              errorCount++;
              continue;
            }

            // RewardTokenAdded: keys = [selector, reward_token]
            // data = [index, timestamp]
            const rewardToken = validated.keys[1] ?? "";

            const data = validated.data;
            const tokenIndex = Number(BigInt(data[0] ?? "0"));
            const eventTimestamp = Number(BigInt(data[1] ?? "0"));

            rewardTokenAddedRows.push({
              block_number: blockNumber,
              block_timestamp: blockTimestamp,
              transaction_hash: transactionHash,
              event_index: eventIndex,
              reward_token: rewardToken,
              market: marketAddress,
              token_index: tokenIndex,
              event_timestamp: eventTimestamp,
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
      await measureDbLatency("market", async () => {
        await db.transaction(async (tx) => {
          if (mintRows.length > 0) {
            await tx.insert(marketMint).values(mintRows).onConflictDoNothing();
          }
          if (burnRows.length > 0) {
            await tx.insert(marketBurn).values(burnRows).onConflictDoNothing();
          }
          if (swapRows.length > 0) {
            await tx.insert(marketSwap).values(swapRows).onConflictDoNothing();
          }
          if (impliedRateRows.length > 0) {
            await tx
              .insert(marketImpliedRateUpdated)
              .values(impliedRateRows)
              .onConflictDoNothing();
          }
          if (feesRows.length > 0) {
            await tx
              .insert(marketFeesCollected)
              .values(feesRows)
              .onConflictDoNothing();
          }
          if (scalarRootRows.length > 0) {
            await tx
              .insert(marketScalarRootUpdated)
              .values(scalarRootRows)
              .onConflictDoNothing();
          }
          if (reserveFeeRows.length > 0) {
            await tx
              .insert(marketReserveFeeTransferred)
              .values(reserveFeeRows)
              .onConflictDoNothing();
          }
          if (burnWithReceiversRows.length > 0) {
            await tx
              .insert(marketBurnWithReceivers)
              .values(burnWithReceiversRows)
              .onConflictDoNothing();
          }
          if (rewardsClaimedRows.length > 0) {
            await tx
              .insert(marketRewardsClaimed)
              .values(rewardsClaimedRows)
              .onConflictDoNothing();
          }
          if (rewardIndexUpdatedRows.length > 0) {
            await tx
              .insert(marketRewardIndexUpdated)
              .values(rewardIndexUpdatedRows)
              .onConflictDoNothing();
          }
          if (rewardTokenAddedRows.length > 0) {
            await tx
              .insert(marketRewardTokenAdded)
              .values(rewardTokenAddedRows)
              .onConflictDoNothing();
          }
        });
      });

      // Record metrics
      const successCount =
        mintRows.length +
        burnRows.length +
        burnWithReceiversRows.length +
        swapRows.length +
        impliedRateRows.length +
        feesRows.length +
        scalarRootRows.length +
        reserveFeeRows.length +
        rewardsClaimedRows.length +
        rewardIndexUpdatedRows.length +
        rewardTokenAddedRows.length;
      recordEvents("market", successCount, errorCount);
      recordBlock("market", blockNumber);

      logBatchInsert(log, blockNum, events.length);
    },
  });
}
