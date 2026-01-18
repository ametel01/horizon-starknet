/**
 * Factory Indexer
 *
 * Indexes events from the Factory contract:
 * - YieldContractsCreated: When new PT/YT pairs are deployed
 * - ClassHashesUpdated: When PT/YT class hashes are updated
 * - RewardFeeRateSet: When reward fee rate is updated
 * - DefaultInterestFeeRateSet: When default interest fee rate is updated
 * - ExpiryDivisorSet: When expiry divisor is updated
 * - SYWithRewardsDeployed: When SY with rewards token is deployed
 * - SYWithRewardsClassHashUpdated: When SY with rewards class hash is updated
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
  factoryClassHashesUpdated,
  factoryDefaultInterestFeeRateSet,
  factoryExpiryDivisorSet,
  factoryRewardFeeRateSet,
  factorySYWithRewardsClassHashUpdated,
  factorySYWithRewardsDeployed,
  factoryYieldContractsCreated,
} from "@/schema";
import { getNetworkConfig } from "../lib/constants";
import { getDrizzleOptions } from "../lib/database";
import { isProgrammerError } from "../lib/errors";
import {
  createIndexerLogger,
  logBlockProgress,
  logIndexerStart,
} from "../lib/logger";
import { measureDbLatency, recordBlock, recordEvents } from "../lib/metrics";
import { streamTimeoutPlugin } from "../lib/plugins";
import {
  decodeByteArrayWithOffset,
  matchSelector,
  readFeltAsNumber,
  readU256,
} from "../lib/utils";
import {
  factoryClassHashesUpdatedSchema,
  factoryDefaultInterestFeeRateSetSchema,
  factoryExpiryDivisorSetSchema,
  factoryRewardFeeRateSetSchema,
  factorySYWithRewardsClassHashUpdatedSchema,
  factorySYWithRewardsDeployedSchema,
  factoryYieldContractsCreatedSchema,
  validateEvent,
} from "../lib/validation";

// Event selectors using Apibara's getSelector helper
const YIELD_CONTRACTS_CREATED = getSelector("YieldContractsCreated");
const CLASS_HASHES_UPDATED = getSelector("ClassHashesUpdated");
const REWARD_FEE_RATE_SET = getSelector("RewardFeeRateSet");
const DEFAULT_INTEREST_FEE_RATE_SET = getSelector("DefaultInterestFeeRateSet");
const EXPIRY_DIVISOR_SET = getSelector("ExpiryDivisorSet");
const SY_WITH_REWARDS_DEPLOYED = getSelector("SYWithRewardsDeployed");
const SY_WITH_REWARDS_CLASS_HASH_UPDATED = getSelector("SYWithRewardsClassHashUpdated");

const log = createIndexerLogger("factory");

export default function factoryIndexer(runtimeConfig: ApibaraRuntimeConfig) {
  const config = getNetworkConfig(runtimeConfig.network);
  const streamUrl =
    runtimeConfig.starknet?.streamUrl ?? "http://localhost:7171";

  const database = drizzle(
    getDrizzleOptions({
      factoryYieldContractsCreated,
      factoryClassHashesUpdated,
      factoryRewardFeeRateSet,
      factoryDefaultInterestFeeRateSet,
      factoryExpiryDivisorSet,
      factorySYWithRewardsDeployed,
      factorySYWithRewardsClassHashUpdated,
    })
  );

  logIndexerStart(log, { streamUrl, startingBlock: config.startingBlock });

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
        indexerName: "factory",
        migrate: { migrationsFolder: "./drizzle" },
      }),
    ],
    filter: {
      header: "always",
      events: [
        { address: config.factory, keys: [YIELD_CONTRACTS_CREATED] },
        { address: config.factory, keys: [CLASS_HASHES_UPDATED] },
        { address: config.factory, keys: [REWARD_FEE_RATE_SET] },
        { address: config.factory, keys: [DEFAULT_INTEREST_FEE_RATE_SET] },
        { address: config.factory, keys: [EXPIRY_DIVISOR_SET] },
        { address: config.factory, keys: [SY_WITH_REWARDS_DEPLOYED] },
        { address: config.factory, keys: [SY_WITH_REWARDS_CLASS_HASH_UPDATED] },
      ],
    },
    async transform({ block, endCursor }) {
      const blockNumber = Number(block.header.blockNumber);
      logBlockProgress(log, blockNumber, endCursor?.orderKey);

      if (block.events.length === 0) return;

      const { db } = useDrizzleStorage();
      const { events, header } = block;
      const blockTimestamp = header.timestamp;

      // Collect events by type for batch insert
      type YieldContractsRow = typeof factoryYieldContractsCreated.$inferInsert;
      type ClassHashesRow = typeof factoryClassHashesUpdated.$inferInsert;
      type RewardFeeRateRow = typeof factoryRewardFeeRateSet.$inferInsert;
      type DefaultInterestFeeRateRow =
        typeof factoryDefaultInterestFeeRateSet.$inferInsert;
      type ExpiryDivisorRow = typeof factoryExpiryDivisorSet.$inferInsert;
      type SYWithRewardsDeployedRow =
        typeof factorySYWithRewardsDeployed.$inferInsert;
      type SYWithRewardsClassHashRow =
        typeof factorySYWithRewardsClassHashUpdated.$inferInsert;

      const yieldContractsRows: YieldContractsRow[] = [];
      const classHashesRows: ClassHashesRow[] = [];
      const rewardFeeRateRows: RewardFeeRateRow[] = [];
      const defaultInterestFeeRateRows: DefaultInterestFeeRateRow[] = [];
      const expiryDivisorRows: ExpiryDivisorRow[] = [];
      const syWithRewardsDeployedRows: SYWithRewardsDeployedRow[] = [];
      const syWithRewardsClassHashRows: SYWithRewardsClassHashRow[] = [];

      // Track errors for this block
      let errorCount = 0;

      for (let i = 0; i < events.length; i++) {
        const event = events.at(i)!;
        const transactionHash = event.transactionHash;
        const eventKey = event.keys[0];
        // Use event.eventIndex from Apibara, fallback to array position
        const eventIndex = event.eventIndex ?? i;

        try {
          if (matchSelector(eventKey, YIELD_CONTRACTS_CREATED)) {
            // Validate event structure
            const validated = validateEvent(
              factoryYieldContractsCreatedSchema,
              event,
              {
                indexer: "factory",
                eventName: "YieldContractsCreated",
                blockNumber,
                transactionHash,
              }
            );
            if (!validated) {
              errorCount++;
              continue;
            }

            const sy = validated.keys[1];
            const expiry = BigInt(validated.keys[2] ?? "0");

            const data = validated.data;
            const pt = data[0];
            const yt = data[1];
            const creator = data[2];
            const underlying = data[3];
            // ByteArray is variable-length: 3 + arrayLen felts
            // Use decodeByteArrayWithOffset to get next index dynamically
            const { value: underlyingSymbol, nextIndex: afterSymbol } =
              decodeByteArrayWithOffset(data, 4, "underlying_symbol");
            const initialExchangeRate = readU256(
              data,
              afterSymbol,
              "initial_exchange_rate"
            );
            // afterSymbol + 2 is timestamp (unused), afterSymbol + 3 is market_index
            const marketIndex = readFeltAsNumber(
              data,
              afterSymbol + 3,
              "market_index"
            );

            log.info(
              { sy, pt, yt, underlying, symbol: underlyingSymbol },
              "YieldContractsCreated"
            );

            yieldContractsRows.push({
              block_number: blockNumber,
              block_timestamp: blockTimestamp,
              transaction_hash: transactionHash,
              event_index: eventIndex,
              sy: sy ?? "",
              expiry: Number(expiry),
              pt: pt ?? "",
              yt: yt ?? "",
              creator: creator ?? "",
              underlying: underlying ?? "",
              underlying_symbol: underlyingSymbol,
              initial_exchange_rate: initialExchangeRate,
              market_index: marketIndex,
            });
          } else if (matchSelector(eventKey, CLASS_HASHES_UPDATED)) {
            // Validate event structure
            const validated = validateEvent(
              factoryClassHashesUpdatedSchema,
              event,
              {
                indexer: "factory",
                eventName: "ClassHashesUpdated",
                blockNumber,
                transactionHash,
              }
            );
            if (!validated) {
              errorCount++;
              continue;
            }

            const ytClassHash = validated.data[0];
            const ptClassHash = validated.data[1];

            log.info({ block: blockNumber }, "ClassHashesUpdated");

            classHashesRows.push({
              block_number: blockNumber,
              block_timestamp: blockTimestamp,
              transaction_hash: transactionHash,
              event_index: eventIndex,
              yt_class_hash: ytClassHash ?? "",
              pt_class_hash: ptClassHash ?? "",
            });
          } else if (matchSelector(eventKey, REWARD_FEE_RATE_SET)) {
            const validated = validateEvent(
              factoryRewardFeeRateSetSchema,
              event,
              {
                indexer: "factory",
                eventName: "RewardFeeRateSet",
                blockNumber,
                transactionHash,
              }
            );
            if (!validated) {
              errorCount++;
              continue;
            }

            const oldFeeRate = readU256(validated.data, 0, "old_fee_rate");
            const newFeeRate = readU256(validated.data, 2, "new_fee_rate");

            log.info({ oldFeeRate, newFeeRate }, "RewardFeeRateSet");

            rewardFeeRateRows.push({
              block_number: blockNumber,
              block_timestamp: blockTimestamp,
              transaction_hash: transactionHash,
              event_index: eventIndex,
              old_fee_rate: oldFeeRate,
              new_fee_rate: newFeeRate,
            });
          } else if (matchSelector(eventKey, DEFAULT_INTEREST_FEE_RATE_SET)) {
            const validated = validateEvent(
              factoryDefaultInterestFeeRateSetSchema,
              event,
              {
                indexer: "factory",
                eventName: "DefaultInterestFeeRateSet",
                blockNumber,
                transactionHash,
              }
            );
            if (!validated) {
              errorCount++;
              continue;
            }

            const oldFeeRate = readU256(validated.data, 0, "old_fee_rate");
            const newFeeRate = readU256(validated.data, 2, "new_fee_rate");

            log.info({ oldFeeRate, newFeeRate }, "DefaultInterestFeeRateSet");

            defaultInterestFeeRateRows.push({
              block_number: blockNumber,
              block_timestamp: blockTimestamp,
              transaction_hash: transactionHash,
              event_index: eventIndex,
              old_fee_rate: oldFeeRate,
              new_fee_rate: newFeeRate,
            });
          } else if (matchSelector(eventKey, EXPIRY_DIVISOR_SET)) {
            const validated = validateEvent(factoryExpiryDivisorSetSchema, event, {
              indexer: "factory",
              eventName: "ExpiryDivisorSet",
              blockNumber,
              transactionHash,
            });
            if (!validated) {
              errorCount++;
              continue;
            }

            const oldExpiryDivisor = readFeltAsNumber(
              validated.data,
              0,
              "old_expiry_divisor"
            );
            const newExpiryDivisor = readFeltAsNumber(
              validated.data,
              1,
              "new_expiry_divisor"
            );

            log.info(
              { oldExpiryDivisor, newExpiryDivisor },
              "ExpiryDivisorSet"
            );

            expiryDivisorRows.push({
              block_number: blockNumber,
              block_timestamp: blockTimestamp,
              transaction_hash: transactionHash,
              event_index: eventIndex,
              old_expiry_divisor: oldExpiryDivisor,
              new_expiry_divisor: newExpiryDivisor,
            });
          } else if (matchSelector(eventKey, SY_WITH_REWARDS_DEPLOYED)) {
            const validated = validateEvent(
              factorySYWithRewardsDeployedSchema,
              event,
              {
                indexer: "factory",
                eventName: "SYWithRewardsDeployed",
                blockNumber,
                transactionHash,
              }
            );
            if (!validated) {
              errorCount++;
              continue;
            }

            const sy = validated.keys[1];
            const data = validated.data;
            const { value: name, nextIndex: afterName } =
              decodeByteArrayWithOffset(data, 0, "name");
            const { value: symbol, nextIndex: afterSymbol } =
              decodeByteArrayWithOffset(data, afterName, "symbol");
            const underlying = data[afterSymbol];
            const deployer = data[afterSymbol + 1];
            const timestampField = readFeltAsNumber(
              data,
              afterSymbol + 2,
              "timestamp"
            );

            log.info({ sy, name, symbol, underlying, deployer }, "SYWithRewardsDeployed");

            syWithRewardsDeployedRows.push({
              block_number: blockNumber,
              block_timestamp: blockTimestamp,
              transaction_hash: transactionHash,
              event_index: eventIndex,
              sy: sy ?? "",
              name,
              symbol,
              underlying: underlying ?? "",
              deployer: deployer ?? "",
              timestamp_field: timestampField,
            });
          } else if (matchSelector(eventKey, SY_WITH_REWARDS_CLASS_HASH_UPDATED)) {
            const validated = validateEvent(
              factorySYWithRewardsClassHashUpdatedSchema,
              event,
              {
                indexer: "factory",
                eventName: "SYWithRewardsClassHashUpdated",
                blockNumber,
                transactionHash,
              }
            );
            if (!validated) {
              errorCount++;
              continue;
            }

            const oldClassHash = validated.data[0];
            const newClassHash = validated.data[1];

            log.info({ oldClassHash, newClassHash }, "SYWithRewardsClassHashUpdated");

            syWithRewardsClassHashRows.push({
              block_number: blockNumber,
              block_timestamp: blockTimestamp,
              transaction_hash: transactionHash,
              event_index: eventIndex,
              old_class_hash: oldClassHash ?? "",
              new_class_hash: newClassHash ?? "",
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
      await measureDbLatency("factory", async () => {
        await db.transaction(async (tx) => {
          if (yieldContractsRows.length > 0) {
            await tx
              .insert(factoryYieldContractsCreated)
              .values(yieldContractsRows)
              .onConflictDoNothing();
          }
          if (classHashesRows.length > 0) {
            await tx
              .insert(factoryClassHashesUpdated)
              .values(classHashesRows)
              .onConflictDoNothing();
          }
          if (rewardFeeRateRows.length > 0) {
            await tx
              .insert(factoryRewardFeeRateSet)
              .values(rewardFeeRateRows)
              .onConflictDoNothing();
          }
          if (defaultInterestFeeRateRows.length > 0) {
            await tx
              .insert(factoryDefaultInterestFeeRateSet)
              .values(defaultInterestFeeRateRows)
              .onConflictDoNothing();
          }
          if (expiryDivisorRows.length > 0) {
            await tx
              .insert(factoryExpiryDivisorSet)
              .values(expiryDivisorRows)
              .onConflictDoNothing();
          }
          if (syWithRewardsDeployedRows.length > 0) {
            await tx
              .insert(factorySYWithRewardsDeployed)
              .values(syWithRewardsDeployedRows)
              .onConflictDoNothing();
          }
          if (syWithRewardsClassHashRows.length > 0) {
            await tx
              .insert(factorySYWithRewardsClassHashUpdated)
              .values(syWithRewardsClassHashRows)
              .onConflictDoNothing();
          }
        });
      });

      // Record metrics
      const successCount =
        yieldContractsRows.length +
        classHashesRows.length +
        rewardFeeRateRows.length +
        defaultInterestFeeRateRows.length +
        expiryDivisorRows.length +
        syWithRewardsDeployedRows.length +
        syWithRewardsClassHashRows.length;
      recordEvents("factory", successCount, errorCount);
      recordBlock("factory", blockNumber);
    },
  });
}
