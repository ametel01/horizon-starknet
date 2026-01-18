/**
 * MarketFactory Indexer
 *
 * Indexes events from the MarketFactory contract:
 * - MarketCreated: When new AMM markets are deployed
 * - MarketClassHashUpdated: When market class hash is updated
 * - TreasuryUpdated: When the treasury address is changed
 * - DefaultReserveFeeUpdated: When the default reserve fee percent is changed
 * - OverrideFeeSet: When a per-router per-market fee override is set
 * - YieldContractFactoryUpdated: When the yield contract factory address is changed
 * - DefaultRateImpactSensitivityUpdated: When the default rate impact sensitivity is changed
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
  marketFactoryClassHashUpdated,
  marketFactoryDefaultRateImpactSensitivityUpdated,
  marketFactoryDefaultReserveFeeUpdated,
  marketFactoryMarketCreated,
  marketFactoryOverrideFeeSet,
  marketFactoryTreasuryUpdated,
  marketFactoryYieldContractFactoryUpdated,
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
  marketFactoryClassHashUpdatedSchema,
  marketFactoryDefaultRateImpactSensitivityUpdatedSchema,
  marketFactoryDefaultReserveFeeUpdatedSchema,
  marketFactoryMarketCreatedSchema,
  marketFactoryOverrideFeeSetSchema,
  marketFactoryTreasuryUpdatedSchema,
  marketFactoryYieldContractFactoryUpdatedSchema,
  validateEvent,
} from "../lib/validation";

// Event selectors using Apibara's getSelector helper
const MARKET_CREATED = getSelector("MarketCreated");
const MARKET_CLASS_HASH_UPDATED = getSelector("MarketClassHashUpdated");
const TREASURY_UPDATED = getSelector("TreasuryUpdated");
const DEFAULT_RESERVE_FEE_UPDATED = getSelector("DefaultReserveFeeUpdated");
const OVERRIDE_FEE_SET = getSelector("OverrideFeeSet");
const YIELD_CONTRACT_FACTORY_UPDATED = getSelector(
  "YieldContractFactoryUpdated"
);
const DEFAULT_RATE_IMPACT_SENSITIVITY_UPDATED = getSelector(
  "DefaultRateImpactSensitivityUpdated"
);

const log = createIndexerLogger("market-factory");

export default function marketFactoryIndexer(
  runtimeConfig: ApibaraRuntimeConfig
) {
  const config = getNetworkConfig(runtimeConfig.network);
  const streamUrl =
    runtimeConfig.starknet?.streamUrl ?? "http://localhost:7171";

  const database = drizzle(
    getDrizzleOptions({
      marketFactoryMarketCreated,
      marketFactoryClassHashUpdated,
      marketFactoryTreasuryUpdated,
      marketFactoryDefaultReserveFeeUpdated,
      marketFactoryOverrideFeeSet,
      marketFactoryYieldContractFactoryUpdated,
      marketFactoryDefaultRateImpactSensitivityUpdated,
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
        indexerName: "market-factory",
        migrate: { migrationsFolder: "./drizzle" },
      }),
    ],
    filter: {
      header: "always",
      events: [
        { address: config.marketFactory, keys: [MARKET_CREATED] },
        { address: config.marketFactory, keys: [MARKET_CLASS_HASH_UPDATED] },
        { address: config.marketFactory, keys: [TREASURY_UPDATED] },
        { address: config.marketFactory, keys: [DEFAULT_RESERVE_FEE_UPDATED] },
        { address: config.marketFactory, keys: [OVERRIDE_FEE_SET] },
        {
          address: config.marketFactory,
          keys: [YIELD_CONTRACT_FACTORY_UPDATED],
        },
        {
          address: config.marketFactory,
          keys: [DEFAULT_RATE_IMPACT_SENSITIVITY_UPDATED],
        },
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
      type MarketCreatedRow = typeof marketFactoryMarketCreated.$inferInsert;
      type ClassHashRow = typeof marketFactoryClassHashUpdated.$inferInsert;
      type TreasuryUpdatedRow =
        typeof marketFactoryTreasuryUpdated.$inferInsert;
      type DefaultReserveFeeUpdatedRow =
        typeof marketFactoryDefaultReserveFeeUpdated.$inferInsert;
      type OverrideFeeSetRow = typeof marketFactoryOverrideFeeSet.$inferInsert;
      type YieldContractFactoryUpdatedRow =
        typeof marketFactoryYieldContractFactoryUpdated.$inferInsert;
      type DefaultRateImpactSensitivityUpdatedRow =
        typeof marketFactoryDefaultRateImpactSensitivityUpdated.$inferInsert;

      const marketCreatedRows: MarketCreatedRow[] = [];
      const classHashRows: ClassHashRow[] = [];
      const treasuryUpdatedRows: TreasuryUpdatedRow[] = [];
      const defaultReserveFeeUpdatedRows: DefaultReserveFeeUpdatedRow[] = [];
      const overrideFeeSetRows: OverrideFeeSetRow[] = [];
      const yieldContractFactoryUpdatedRows: YieldContractFactoryUpdatedRow[] =
        [];
      const defaultRateImpactSensitivityUpdatedRows: DefaultRateImpactSensitivityUpdatedRow[] =
        [];

      // Track errors for this block
      let errorCount = 0;

      for (let i = 0; i < events.length; i++) {
        const event = events.at(i)!;
        const transactionHash = event.transactionHash;
        const eventKey = event.keys[0];
        // Use event.eventIndex from Apibara, fallback to array position
        const eventIndex = event.eventIndex ?? i;

        try {
          if (matchSelector(eventKey, MARKET_CREATED)) {
            // Validate event structure
            const validated = validateEvent(
              marketFactoryMarketCreatedSchema,
              event,
              {
                indexer: "market-factory",
                eventName: "MarketCreated",
                blockNumber,
                transactionHash,
              }
            );
            if (!validated) {
              errorCount++;
              continue;
            }

            const pt = validated.keys[1];
            const expiry = BigInt(validated.keys[2] ?? "0");

            const data = validated.data;
            const market = data[0];
            const creator = data[1];
            // u256 fields use 2 felts each (low, high)
            const scalarRoot = readU256(data, 2, "scalar_root");
            const initialAnchor = readU256(data, 4, "initial_anchor");
            const lnFeeRateRoot = readU256(data, 6, "ln_fee_rate_root");
            const reserveFeePercent = Number(data[8] ?? "0");
            const sy = data[9];
            const yt = data[10];
            const underlying = data[11];
            // ByteArray is variable-length: 3 + arrayLen felts
            // Use decodeByteArrayWithOffset to get next index dynamically
            const { value: underlyingSymbol, nextIndex: afterSymbol } =
              decodeByteArrayWithOffset(data, 12, "underlying_symbol");
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

            marketCreatedRows.push({
              block_number: blockNumber,
              block_timestamp: blockTimestamp,
              transaction_hash: transactionHash,
              event_index: eventIndex,
              pt: pt ?? "",
              expiry: Number(expiry),
              market: market ?? "",
              creator: creator ?? "",
              scalar_root: scalarRoot,
              initial_anchor: initialAnchor,
              ln_fee_rate_root: lnFeeRateRoot,
              reserve_fee_percent: reserveFeePercent,
              sy: sy ?? "",
              yt: yt ?? "",
              underlying: underlying ?? "",
              underlying_symbol: underlyingSymbol,
              initial_exchange_rate: initialExchangeRate,
              market_index: marketIndex,
            });
          } else if (matchSelector(eventKey, MARKET_CLASS_HASH_UPDATED)) {
            // Validate event structure
            const validated = validateEvent(
              marketFactoryClassHashUpdatedSchema,
              event,
              {
                indexer: "market-factory",
                eventName: "MarketClassHashUpdated",
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

            classHashRows.push({
              block_number: blockNumber,
              block_timestamp: blockTimestamp,
              transaction_hash: transactionHash,
              event_index: eventIndex,
              old_class_hash: oldClassHash ?? "",
              new_class_hash: newClassHash ?? "",
            });
          } else if (matchSelector(eventKey, TREASURY_UPDATED)) {
            // Validate event structure
            const validated = validateEvent(
              marketFactoryTreasuryUpdatedSchema,
              event,
              {
                indexer: "market-factory",
                eventName: "TreasuryUpdated",
                blockNumber,
                transactionHash,
              }
            );
            if (!validated) {
              errorCount++;
              continue;
            }

            // TreasuryUpdated: keys = [selector], data = [old_treasury, new_treasury]
            const oldTreasury = validated.data[0];
            const newTreasury = validated.data[1];

            treasuryUpdatedRows.push({
              block_number: blockNumber,
              block_timestamp: blockTimestamp,
              transaction_hash: transactionHash,
              event_index: eventIndex,
              old_treasury: oldTreasury ?? "",
              new_treasury: newTreasury ?? "",
            });
          } else if (matchSelector(eventKey, DEFAULT_RESERVE_FEE_UPDATED)) {
            // Validate event structure
            const validated = validateEvent(
              marketFactoryDefaultReserveFeeUpdatedSchema,
              event,
              {
                indexer: "market-factory",
                eventName: "DefaultReserveFeeUpdated",
                blockNumber,
                transactionHash,
              }
            );
            if (!validated) {
              errorCount++;
              continue;
            }

            // DefaultReserveFeeUpdated: keys = [selector], data = [old_percent, new_percent]
            const oldPercent = Number(validated.data[0] ?? "0");
            const newPercent = Number(validated.data[1] ?? "0");

            defaultReserveFeeUpdatedRows.push({
              block_number: blockNumber,
              block_timestamp: blockTimestamp,
              transaction_hash: transactionHash,
              event_index: eventIndex,
              old_percent: oldPercent,
              new_percent: newPercent,
            });
          } else if (matchSelector(eventKey, OVERRIDE_FEE_SET)) {
            // Validate event structure
            const validated = validateEvent(
              marketFactoryOverrideFeeSetSchema,
              event,
              {
                indexer: "market-factory",
                eventName: "OverrideFeeSet",
                blockNumber,
                transactionHash,
              }
            );
            if (!validated) {
              errorCount++;
              continue;
            }

            // OverrideFeeSet: keys = [selector, router, market], data = [ln_fee_rate_root(u256)]
            const router = validated.keys[1] ?? "";
            const market = validated.keys[2] ?? "";
            const lnFeeRateRoot = readU256(
              validated.data,
              0,
              "ln_fee_rate_root"
            );

            overrideFeeSetRows.push({
              block_number: blockNumber,
              block_timestamp: blockTimestamp,
              transaction_hash: transactionHash,
              event_index: eventIndex,
              router,
              market,
              ln_fee_rate_root: lnFeeRateRoot,
            });
          } else if (matchSelector(eventKey, YIELD_CONTRACT_FACTORY_UPDATED)) {
            // Validate event structure
            const validated = validateEvent(
              marketFactoryYieldContractFactoryUpdatedSchema,
              event,
              {
                indexer: "market-factory",
                eventName: "YieldContractFactoryUpdated",
                blockNumber,
                transactionHash,
              }
            );
            if (!validated) {
              errorCount++;
              continue;
            }

            // YieldContractFactoryUpdated: keys = [selector], data = [old_factory, new_factory]
            const oldFactory = validated.data[0] ?? "";
            const newFactory = validated.data[1] ?? "";

            yieldContractFactoryUpdatedRows.push({
              block_number: blockNumber,
              block_timestamp: blockTimestamp,
              transaction_hash: transactionHash,
              event_index: eventIndex,
              old_factory: oldFactory,
              new_factory: newFactory,
            });
          } else if (
            matchSelector(eventKey, DEFAULT_RATE_IMPACT_SENSITIVITY_UPDATED)
          ) {
            // Validate event structure
            const validated = validateEvent(
              marketFactoryDefaultRateImpactSensitivityUpdatedSchema,
              event,
              {
                indexer: "market-factory",
                eventName: "DefaultRateImpactSensitivityUpdated",
                blockNumber,
                transactionHash,
              }
            );
            if (!validated) {
              errorCount++;
              continue;
            }

            // DefaultRateImpactSensitivityUpdated: keys = [selector], data = [old_sensitivity(u256), new_sensitivity(u256)]
            const oldSensitivity = readU256(
              validated.data,
              0,
              "old_sensitivity"
            );
            const newSensitivity = readU256(
              validated.data,
              2,
              "new_sensitivity"
            );

            defaultRateImpactSensitivityUpdatedRows.push({
              block_number: blockNumber,
              block_timestamp: blockTimestamp,
              transaction_hash: transactionHash,
              event_index: eventIndex,
              old_sensitivity: oldSensitivity,
              new_sensitivity: newSensitivity,
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
      await measureDbLatency("market-factory", async () => {
        await db.transaction(async (tx) => {
          if (marketCreatedRows.length > 0) {
            await tx
              .insert(marketFactoryMarketCreated)
              .values(marketCreatedRows)
              .onConflictDoNothing();
          }
          if (classHashRows.length > 0) {
            await tx
              .insert(marketFactoryClassHashUpdated)
              .values(classHashRows)
              .onConflictDoNothing();
          }
          if (treasuryUpdatedRows.length > 0) {
            await tx
              .insert(marketFactoryTreasuryUpdated)
              .values(treasuryUpdatedRows)
              .onConflictDoNothing();
          }
          if (defaultReserveFeeUpdatedRows.length > 0) {
            await tx
              .insert(marketFactoryDefaultReserveFeeUpdated)
              .values(defaultReserveFeeUpdatedRows)
              .onConflictDoNothing();
          }
          if (overrideFeeSetRows.length > 0) {
            await tx
              .insert(marketFactoryOverrideFeeSet)
              .values(overrideFeeSetRows)
              .onConflictDoNothing();
          }
          if (yieldContractFactoryUpdatedRows.length > 0) {
            await tx
              .insert(marketFactoryYieldContractFactoryUpdated)
              .values(yieldContractFactoryUpdatedRows)
              .onConflictDoNothing();
          }
          if (defaultRateImpactSensitivityUpdatedRows.length > 0) {
            await tx
              .insert(marketFactoryDefaultRateImpactSensitivityUpdated)
              .values(defaultRateImpactSensitivityUpdatedRows)
              .onConflictDoNothing();
          }
        });
      });

      // Record metrics
      const successCount =
        marketCreatedRows.length +
        classHashRows.length +
        treasuryUpdatedRows.length +
        defaultReserveFeeUpdatedRows.length +
        overrideFeeSetRows.length +
        yieldContractFactoryUpdatedRows.length +
        defaultRateImpactSensitivityUpdatedRows.length;
      recordEvents("market-factory", successCount, errorCount);
      recordBlock("market-factory", blockNumber);
    },
  });
}
