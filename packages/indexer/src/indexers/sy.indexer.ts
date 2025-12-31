/**
 * SY (Standardized Yield) Indexer
 *
 * Uses factory pattern to discover SY contracts from Factory.YieldContractsCreated events.
 *
 * Indexes events from SY contracts:
 * - Deposit: User deposits underlying to get SY
 * - Redeem: User redeems SY for underlying
 * - OracleRateUpdated: Exchange rate update from oracle
 *
 * Phase 4 additions (monitoring & rewards):
 * - NegativeYieldDetected: When exchange rate drops below watermark
 * - Paused/Unpaused: OpenZeppelin pausable state changes
 * - RewardsClaimed: User claims rewards from SYWithRewards
 * - RewardIndexUpdated: Reward distribution index updates
 * - RewardTokenAdded: New reward token registered
 */

import {
  drizzle,
  drizzleStorage,
  useDrizzleStorage,
} from "@apibara/plugin-drizzle";
import { getSelector, StarknetStream } from "@apibara/starknet";
import { defineIndexer } from "apibara/indexer";

import {
  syDeposit,
  syNegativeYieldDetected,
  syOracleRateUpdated,
  syPauseState,
  syRedeem,
  syRewardIndexUpdated,
  syRewardsClaimed,
  syRewardTokenAdded,
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
import { matchSelector, readFeltAsNumber, readU256 } from "../lib/utils";
import {
  syDepositSchema,
  syNegativeYieldDetectedSchema,
  syOracleRateUpdatedSchema,
  syPausedSchema,
  syRedeemSchema,
  syRewardIndexUpdatedSchema,
  syRewardsClaimedSchema,
  syRewardTokenAddedSchema,
  syUnpausedSchema,
  validateEvent,
} from "../lib/validation";

import type { ApibaraRuntimeConfig } from "apibara/types";

const log = createIndexerLogger("sy");

// Factory event to discover SY contracts
const YIELD_CONTRACTS_CREATED = getSelector("YieldContractsCreated");

// SY core events
const DEPOSIT = getSelector("Deposit");
const REDEEM = getSelector("Redeem");
const ORACLE_RATE_UPDATED = getSelector("OracleRateUpdated");

// Phase 4: SY monitoring events
const NEGATIVE_YIELD_DETECTED = getSelector("NegativeYieldDetected");
const PAUSED = getSelector("Paused");
const UNPAUSED = getSelector("Unpaused");

// Phase 4: Reward manager events (SYWithRewards only)
const REWARDS_CLAIMED = getSelector("RewardsClaimed");
const REWARD_INDEX_UPDATED = getSelector("RewardIndexUpdated");
const REWARD_TOKEN_ADDED = getSelector("RewardTokenAdded");

export default function syIndexer(runtimeConfig: ApibaraRuntimeConfig) {
  const config = getNetworkConfig(runtimeConfig.network);
  const streamUrl =
    runtimeConfig.starknet?.streamUrl ?? "http://localhost:7171";

  const database = drizzle(
    getDrizzleOptions({
      // Core SY tables
      syDeposit,
      syRedeem,
      syOracleRateUpdated,
      // Phase 4: Monitoring tables
      syNegativeYieldDetected,
      syPauseState,
      // Phase 4: Reward tables
      syRewardsClaimed,
      syRewardIndexUpdated,
      syRewardTokenAdded,
    }),
  );

  logIndexerStart(log, {
    streamUrl,
    startingBlock: config.startingBlock,
    knownContracts: config.knownSYContracts.length,
  });

  // Build initial filter with factory event + known SY contracts
  // This ensures the indexer works correctly after restarts when the checkpoint
  // is past the block where YieldContractsCreated was emitted
  const knownSYFilters = config.knownSYContracts.flatMap(
    (syAddress: `0x${string}`) => [
      // Core SY events
      { address: syAddress, keys: [DEPOSIT] },
      { address: syAddress, keys: [REDEEM] },
      { address: syAddress, keys: [ORACLE_RATE_UPDATED] },
      // Phase 4: Monitoring events
      { address: syAddress, keys: [NEGATIVE_YIELD_DETECTED] },
      { address: syAddress, keys: [PAUSED] },
      { address: syAddress, keys: [UNPAUSED] },
      // Phase 4: Reward events (only emitted by SYWithRewards)
      { address: syAddress, keys: [REWARDS_CLAIMED] },
      { address: syAddress, keys: [REWARD_INDEX_UPDATED] },
      { address: syAddress, keys: [REWARD_TOKEN_ADDED] },
    ],
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
        indexerName: "sy",
        migrate: { migrationsFolder: "./drizzle" },
      }),
    ],
    // Initial filter: listen to Factory for new SY contracts + known SY contracts
    filter: {
      header: "always",
      events: [
        { address: config.factory, keys: [YIELD_CONTRACTS_CREATED] },
        ...knownSYFilters,
      ],
    },
    // Factory function: dynamically add filters for discovered SY contracts
    async factory({ block: { events } }) {
      const newFilters = (events ?? []).flatMap((event) => {
        if (!matchSelector(event.keys[0], YIELD_CONTRACTS_CREATED)) return [];

        // YieldContractsCreated: keys = [selector, sy, expiry]
        const syAddress = event.keys[1]!;

        return [
          // Core SY events
          { address: syAddress, keys: [DEPOSIT] },
          { address: syAddress, keys: [REDEEM] },
          { address: syAddress, keys: [ORACLE_RATE_UPDATED] },
          // Phase 4: Monitoring events
          { address: syAddress, keys: [NEGATIVE_YIELD_DETECTED] },
          { address: syAddress, keys: [PAUSED] },
          { address: syAddress, keys: [UNPAUSED] },
          // Phase 4: Reward events (only emitted by SYWithRewards)
          { address: syAddress, keys: [REWARDS_CLAIMED] },
          { address: syAddress, keys: [REWARD_INDEX_UPDATED] },
          { address: syAddress, keys: [REWARD_TOKEN_ADDED] },
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
      // Core SY tables
      type DepositRow = typeof syDeposit.$inferInsert;
      type RedeemRow = typeof syRedeem.$inferInsert;
      type OracleRateRow = typeof syOracleRateUpdated.$inferInsert;
      // Phase 4: Monitoring tables
      type NegativeYieldRow = typeof syNegativeYieldDetected.$inferInsert;
      type PauseStateRow = typeof syPauseState.$inferInsert;
      // Phase 4: Reward tables
      type RewardsClaimedRow = typeof syRewardsClaimed.$inferInsert;
      type RewardIndexRow = typeof syRewardIndexUpdated.$inferInsert;
      type RewardTokenRow = typeof syRewardTokenAdded.$inferInsert;

      const depositRows: DepositRow[] = [];
      const redeemRows: RedeemRow[] = [];
      const oracleRateRows: OracleRateRow[] = [];
      // Phase 4 row collectors
      const negativeYieldRows: NegativeYieldRow[] = [];
      const pauseStateRows: PauseStateRow[] = [];
      const rewardsClaimedRows: RewardsClaimedRow[] = [];
      const rewardIndexRows: RewardIndexRow[] = [];
      const rewardTokenRows: RewardTokenRow[] = [];

      // Track errors for this block
      let errorCount = 0;

      for (let i = 0; i < events.length; i++) {
        const event = events.at(i)!;
        const transactionHash = event.transactionHash;
        const eventKey = event.keys[0];
        const syAddress = event.address;
        // Use event.eventIndex from Apibara, fallback to array position
        const eventIndex = event.eventIndex ?? i;

        try {
          if (matchSelector(eventKey, DEPOSIT)) {
            // Validate event structure
            const validated = validateEvent(syDepositSchema, event, {
              indexer: "sy",
              eventName: "Deposit",
              blockNumber,
              transactionHash,
            });
            if (!validated) {
              errorCount++;
              continue;
            }

            const caller = validated.keys[1] ?? "";
            const receiver = validated.keys[2] ?? "";
            const underlying = validated.keys[3] ?? "";

            const data = validated.data;
            const amountDeposited = readU256(data, 0, "amount_deposited");
            const amountSyMinted = readU256(data, 2, "amount_sy_minted");
            const exchangeRate = readU256(data, 4, "exchange_rate");
            const totalSupplyAfter = readU256(data, 6, "total_supply_after");

            depositRows.push({
              block_number: blockNumber,
              block_timestamp: blockTimestamp,
              transaction_hash: transactionHash,
              event_index: eventIndex,
              caller,
              receiver,
              underlying,
              sy: syAddress,
              amount_deposited: amountDeposited,
              amount_sy_minted: amountSyMinted,
              exchange_rate: exchangeRate,
              total_supply_after: totalSupplyAfter,
            });
          } else if (matchSelector(eventKey, REDEEM)) {
            // Validate event structure
            const validated = validateEvent(syRedeemSchema, event, {
              indexer: "sy",
              eventName: "Redeem",
              blockNumber,
              transactionHash,
            });
            if (!validated) {
              errorCount++;
              continue;
            }

            const caller = validated.keys[1] ?? "";
            const receiver = validated.keys[2] ?? "";
            const underlying = validated.keys[3] ?? "";

            const data = validated.data;
            const amountSyBurned = readU256(data, 0, "amount_sy_burned");
            const amountRedeemed = readU256(data, 2, "amount_redeemed");
            const exchangeRate = readU256(data, 4, "exchange_rate");
            const totalSupplyAfter = readU256(data, 6, "total_supply_after");

            redeemRows.push({
              block_number: blockNumber,
              block_timestamp: blockTimestamp,
              transaction_hash: transactionHash,
              event_index: eventIndex,
              caller,
              receiver,
              underlying,
              sy: syAddress,
              amount_sy_burned: amountSyBurned,
              amount_redeemed: amountRedeemed,
              exchange_rate: exchangeRate,
              total_supply_after: totalSupplyAfter,
            });
          } else if (matchSelector(eventKey, ORACLE_RATE_UPDATED)) {
            // Validate event structure
            const validated = validateEvent(syOracleRateUpdatedSchema, event, {
              indexer: "sy",
              eventName: "OracleRateUpdated",
              blockNumber,
              transactionHash,
            });
            if (!validated) {
              errorCount++;
              continue;
            }

            const sy = validated.keys[1] ?? syAddress;
            const underlying = validated.keys[2] ?? "";

            const data = validated.data;
            const oldRate = readU256(data, 0, "old_rate");
            const newRate = readU256(data, 2, "new_rate");
            const rateChangeBps = readU256(data, 4, "rate_change_bps");

            oracleRateRows.push({
              block_number: blockNumber,
              block_timestamp: blockTimestamp,
              transaction_hash: transactionHash,
              event_index: eventIndex,
              sy,
              underlying,
              old_rate: oldRate,
              new_rate: newRate,
              rate_change_bps: rateChangeBps,
            });
          }
          // ============================================================
          // Phase 4: Monitoring Events
          // ============================================================
          else if (matchSelector(eventKey, NEGATIVE_YIELD_DETECTED)) {
            const validated = validateEvent(
              syNegativeYieldDetectedSchema,
              event,
              {
                indexer: "sy",
                eventName: "NegativeYieldDetected",
                blockNumber,
                transactionHash,
              },
            );
            if (!validated) {
              errorCount++;
              continue;
            }

            // keys: [selector, sy, underlying]
            const sy = validated.keys[1] ?? syAddress;
            const underlying = validated.keys[2] ?? "";

            // data: [watermark_rate(u256), current_rate(u256), rate_drop_bps(u256), timestamp]
            const data = validated.data;
            const watermarkRate = readU256(data, 0, "watermark_rate");
            const currentRate = readU256(data, 2, "current_rate");
            const rateDropBps = readU256(data, 4, "rate_drop_bps");
            const eventTimestamp = readFeltAsNumber(data, 6, "timestamp");

            negativeYieldRows.push({
              block_number: blockNumber,
              block_timestamp: blockTimestamp,
              transaction_hash: transactionHash,
              event_index: eventIndex,
              sy,
              underlying,
              watermark_rate: watermarkRate,
              current_rate: currentRate,
              rate_drop_bps: rateDropBps,
              event_timestamp: eventTimestamp,
            });
          } else if (matchSelector(eventKey, PAUSED)) {
            const validated = validateEvent(syPausedSchema, event, {
              indexer: "sy",
              eventName: "Paused",
              blockNumber,
              transactionHash,
            });
            if (!validated) {
              errorCount++;
              continue;
            }

            // data: [account]
            const account = validated.data[0] ?? "";

            pauseStateRows.push({
              block_number: blockNumber,
              block_timestamp: blockTimestamp,
              transaction_hash: transactionHash,
              event_index: eventIndex,
              sy: syAddress, // Contract that emitted the event
              account,
              is_paused: true,
            });
          } else if (matchSelector(eventKey, UNPAUSED)) {
            const validated = validateEvent(syUnpausedSchema, event, {
              indexer: "sy",
              eventName: "Unpaused",
              blockNumber,
              transactionHash,
            });
            if (!validated) {
              errorCount++;
              continue;
            }

            // data: [account]
            const account = validated.data[0] ?? "";

            pauseStateRows.push({
              block_number: blockNumber,
              block_timestamp: blockTimestamp,
              transaction_hash: transactionHash,
              event_index: eventIndex,
              sy: syAddress, // Contract that emitted the event
              account,
              is_paused: false,
            });
          }
          // ============================================================
          // Phase 4: Reward Manager Events (SYWithRewards only)
          // ============================================================
          else if (matchSelector(eventKey, REWARDS_CLAIMED)) {
            const validated = validateEvent(syRewardsClaimedSchema, event, {
              indexer: "sy",
              eventName: "RewardsClaimed",
              blockNumber,
              transactionHash,
            });
            if (!validated) {
              errorCount++;
              continue;
            }

            // keys: [selector, user, reward_token]
            const user = validated.keys[1] ?? "";
            const rewardToken = validated.keys[2] ?? "";

            // data: [amount(u256), timestamp]
            const data = validated.data;
            const amount = readU256(data, 0, "amount");
            const eventTimestamp = readFeltAsNumber(data, 2, "timestamp");

            rewardsClaimedRows.push({
              block_number: blockNumber,
              block_timestamp: blockTimestamp,
              transaction_hash: transactionHash,
              event_index: eventIndex,
              sy: syAddress, // SYWithRewards contract
              user,
              reward_token: rewardToken,
              amount,
              event_timestamp: eventTimestamp,
            });
          } else if (matchSelector(eventKey, REWARD_INDEX_UPDATED)) {
            const validated = validateEvent(syRewardIndexUpdatedSchema, event, {
              indexer: "sy",
              eventName: "RewardIndexUpdated",
              blockNumber,
              transactionHash,
            });
            if (!validated) {
              errorCount++;
              continue;
            }

            // keys: [selector, reward_token]
            const rewardToken = validated.keys[1] ?? "";

            // data: [old_index(u256), new_index(u256), rewards_added(u256), total_supply(u256), timestamp]
            const data = validated.data;
            const oldIndex = readU256(data, 0, "old_index");
            const newIndex = readU256(data, 2, "new_index");
            const rewardsAdded = readU256(data, 4, "rewards_added");
            const totalSupply = readU256(data, 6, "total_supply");
            const eventTimestamp = readFeltAsNumber(data, 8, "timestamp");

            rewardIndexRows.push({
              block_number: blockNumber,
              block_timestamp: blockTimestamp,
              transaction_hash: transactionHash,
              event_index: eventIndex,
              sy: syAddress, // SYWithRewards contract
              reward_token: rewardToken,
              old_index: oldIndex,
              new_index: newIndex,
              rewards_added: rewardsAdded,
              total_supply: totalSupply,
              event_timestamp: eventTimestamp,
            });
          } else if (matchSelector(eventKey, REWARD_TOKEN_ADDED)) {
            const validated = validateEvent(syRewardTokenAddedSchema, event, {
              indexer: "sy",
              eventName: "RewardTokenAdded",
              blockNumber,
              transactionHash,
            });
            if (!validated) {
              errorCount++;
              continue;
            }

            // keys: [selector, reward_token]
            const rewardToken = validated.keys[1] ?? "";

            // data: [index, timestamp]
            const data = validated.data;
            const tokenIndex = readFeltAsNumber(data, 0, "index");
            const eventTimestamp = readFeltAsNumber(data, 1, "timestamp");

            rewardTokenRows.push({
              block_number: blockNumber,
              block_timestamp: blockTimestamp,
              transaction_hash: transactionHash,
              event_index: eventIndex,
              sy: syAddress, // SYWithRewards contract
              reward_token: rewardToken,
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
            "Event processing failed",
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
          "Block completed with errors",
        );
      }

      // Batch insert with transaction wrapping and conflict handling for idempotency
      await measureDbLatency("sy", async () => {
        await db.transaction(async (tx) => {
          // Core SY tables
          if (depositRows.length > 0) {
            await tx
              .insert(syDeposit)
              .values(depositRows)
              .onConflictDoNothing();
          }
          if (redeemRows.length > 0) {
            await tx.insert(syRedeem).values(redeemRows).onConflictDoNothing();
          }
          if (oracleRateRows.length > 0) {
            await tx
              .insert(syOracleRateUpdated)
              .values(oracleRateRows)
              .onConflictDoNothing();
          }
          // Phase 4: Monitoring tables
          if (negativeYieldRows.length > 0) {
            await tx
              .insert(syNegativeYieldDetected)
              .values(negativeYieldRows)
              .onConflictDoNothing();
          }
          if (pauseStateRows.length > 0) {
            await tx
              .insert(syPauseState)
              .values(pauseStateRows)
              .onConflictDoNothing();
          }
          // Phase 4: Reward tables
          if (rewardsClaimedRows.length > 0) {
            await tx
              .insert(syRewardsClaimed)
              .values(rewardsClaimedRows)
              .onConflictDoNothing();
          }
          if (rewardIndexRows.length > 0) {
            await tx
              .insert(syRewardIndexUpdated)
              .values(rewardIndexRows)
              .onConflictDoNothing();
          }
          if (rewardTokenRows.length > 0) {
            await tx
              .insert(syRewardTokenAdded)
              .values(rewardTokenRows)
              .onConflictDoNothing();
          }
        });
      });

      // Record metrics
      const successCount =
        depositRows.length +
        redeemRows.length +
        oracleRateRows.length +
        negativeYieldRows.length +
        pauseStateRows.length +
        rewardsClaimedRows.length +
        rewardIndexRows.length +
        rewardTokenRows.length;
      recordEvents("sy", successCount, errorCount);
      recordBlock("sy", blockNumber);

      logBatchInsert(log, blockNum, events.length);
    },
  });
}
