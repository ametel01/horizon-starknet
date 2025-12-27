/**
 * MarketFactory Indexer
 *
 * Indexes events from the MarketFactory contract:
 * - MarketCreated: When new AMM markets are deployed
 * - MarketClassHashUpdated: When market class hash is updated
 */

import {
  drizzle,
  drizzleStorage,
  useDrizzleStorage,
} from "@apibara/plugin-drizzle";
import { getSelector, StarknetStream } from "@apibara/starknet";
import { defineIndexer } from "apibara/indexer";

import {
  marketFactoryClassHashUpdated,
  marketFactoryMarketCreated,
} from "@/schema";

import { getNetworkConfig } from "../lib/constants";
import { getDrizzleOptions } from "../lib/database";
import { isProgrammerError } from "../lib/errors";
import {
  createIndexerLogger,
  logBlockProgress,
  logIndexerStart,
} from "../lib/logger";
import { streamTimeoutPlugin } from "../lib/plugins";
import { decodeByteArray, matchSelector, readU256 } from "../lib/utils";
import {
  marketFactoryClassHashUpdatedSchema,
  marketFactoryMarketCreatedSchema,
  validateEvent,
} from "../lib/validation";

import type { ApibaraRuntimeConfig } from "apibara/types";

// Event selectors using Apibara's getSelector helper
const MARKET_CREATED = getSelector("MarketCreated");
const MARKET_CLASS_HASH_UPDATED = getSelector("MarketClassHashUpdated");

const log = createIndexerLogger("market-factory");

export default function marketFactoryIndexer(
  runtimeConfig: ApibaraRuntimeConfig,
) {
  const config = getNetworkConfig(runtimeConfig.network);
  const streamUrl =
    runtimeConfig.starknet?.streamUrl ?? "http://localhost:7171";

  const database = drizzle(
    getDrizzleOptions({
      marketFactoryMarketCreated,
      marketFactoryClassHashUpdated,
    }),
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

      const marketCreatedRows: MarketCreatedRow[] = [];
      const classHashRows: ClassHashRow[] = [];

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
              },
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
            const feeRate = readU256(data, 6, "fee_rate");
            const sy = data[8];
            const yt = data[9];
            const underlying = data[10];
            const underlyingSymbol = decodeByteArray(
              data,
              11,
              "underlying_symbol",
            );
            const initialExchangeRate = readU256(
              data,
              14,
              "initial_exchange_rate",
            );
            // data[16] is timestamp (unused)
            const marketIndex = Number(data[17] ?? "0");

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
              fee_rate: feeRate,
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
              },
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
      });
    },
  });
}
