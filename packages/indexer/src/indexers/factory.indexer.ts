/**
 * Factory Indexer
 *
 * Indexes events from the Factory contract:
 * - YieldContractsCreated: When new PT/YT pairs are deployed
 * - ClassHashesUpdated: When PT/YT class hashes are updated
 */

import {
  drizzle,
  drizzleStorage,
  useDrizzleStorage,
} from "@apibara/plugin-drizzle";
import { getSelector, StarknetStream } from "@apibara/starknet";
import { defineIndexer } from "apibara/indexer";

import {
  factoryClassHashesUpdated,
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
import { streamTimeoutPlugin } from "../lib/plugins";
import { decodeByteArray, matchSelector, readU256 } from "../lib/utils";
import {
  factoryClassHashesUpdatedSchema,
  factoryYieldContractsCreatedSchema,
  validateEvent,
} from "../lib/validation";

import type { ApibaraRuntimeConfig } from "apibara/types";

// Event selectors using Apibara's getSelector helper
const YIELD_CONTRACTS_CREATED = getSelector("YieldContractsCreated");
const CLASS_HASHES_UPDATED = getSelector("ClassHashesUpdated");

const log = createIndexerLogger("factory");

export default function factoryIndexer(runtimeConfig: ApibaraRuntimeConfig) {
  const config = getNetworkConfig(runtimeConfig.network);
  const streamUrl =
    runtimeConfig.starknet?.streamUrl ?? "http://localhost:7171";

  const database = drizzle(
    getDrizzleOptions({
      factoryYieldContractsCreated,
      factoryClassHashesUpdated,
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
        indexerName: "factory",
        migrate: { migrationsFolder: "./drizzle" },
      }),
    ],
    filter: {
      header: "always",
      events: [
        { address: config.factory, keys: [YIELD_CONTRACTS_CREATED] },
        { address: config.factory, keys: [CLASS_HASHES_UPDATED] },
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

      const yieldContractsRows: YieldContractsRow[] = [];
      const classHashesRows: ClassHashesRow[] = [];

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
              },
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
            const underlyingSymbol = decodeByteArray(
              data,
              4,
              "underlying_symbol",
            );
            // data[7-8] = initial_exchange_rate (u256), data[9] = timestamp, data[10] = market_index
            const initialExchangeRate = readU256(
              data,
              7,
              "initial_exchange_rate",
            );
            const marketIndex = Number(data[10] ?? "0");

            log.info(
              { sy, pt, yt, underlying, symbol: underlyingSymbol },
              "YieldContractsCreated",
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
              },
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
      });
    },
  });
}
