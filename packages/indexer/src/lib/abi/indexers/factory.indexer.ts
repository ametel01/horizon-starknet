/**
 * Factory Indexer
 *
 * Indexes events from the Factory contract:
 * - YieldContractsCreated: When new PT/YT pairs are deployed
 * - ClassHashesUpdated: When PT/YT class hashes are updated
 */

import {
  factoryClassHashesUpdated,
  factoryYieldContractsCreated,
} from "@/schema";
import {
  drizzle,
  drizzleStorage,
  useDrizzleStorage,
} from "@apibara/plugin-drizzle";
import { getSelector, StarknetStream } from "@apibara/starknet";
import { defineIndexer } from "apibara/indexer";
import type { ApibaraRuntimeConfig } from "apibara/types";
import { getNetworkConfig } from "../../constants";
import { getDrizzleOptions } from "../../database";
import { streamTimeoutPlugin } from "../../plugins";
import { decodeByteArray, matchSelector } from "../../utils";

// Event selectors using Apibara's getSelector helper
const YIELD_CONTRACTS_CREATED = getSelector("YieldContractsCreated");
const CLASS_HASHES_UPDATED = getSelector("ClassHashesUpdated");

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

  console.log(
    `[factory] Starting indexer with streamUrl: ${streamUrl}, startingBlock: ${config.startingBlock}`,
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
      // Log progress every 1000 blocks (reduced frequency for performance)
      const blockNumber = Number(block.header.blockNumber);
      if (blockNumber % 1000 === 0) {
        console.log(
          `[factory] Block ${blockNumber} | Cursor: ${endCursor?.orderKey}`,
        );
      }

      if (block.events.length === 0) return;

      const { db } = useDrizzleStorage();
      const { events, header } = block;
      const blockTimestamp = header.timestamp;

      // Collect events by type for batch insert
      type YieldContractsRow = typeof factoryYieldContractsCreated.$inferInsert;
      type ClassHashesRow = typeof factoryClassHashesUpdated.$inferInsert;

      const yieldContractsRows: YieldContractsRow[] = [];
      const classHashesRows: ClassHashesRow[] = [];

      for (const event of events) {
        const transactionHash = event.transactionHash;
        const eventKey = event.keys[0];

        if (matchSelector(eventKey, YIELD_CONTRACTS_CREATED)) {
          const sy = event.keys[1];
          const expiry = BigInt(event.keys[2] ?? "0");

          const data = event.data;
          const pt = data[0];
          const yt = data[1];
          const creator = data[2];
          const underlying = data[3];
          const underlyingSymbol = decodeByteArray(data as string[], 4);
          const initialExchangeRate = BigInt(data[7] ?? "0");
          const marketIndex = Number(data[10] ?? "0");

          console.log(
            `[factory] YieldContractsCreated: SY=${sy}, PT=${pt}, YT=${yt}, underlying=${underlying}, symbol=${underlyingSymbol}`,
          );

          yieldContractsRows.push({
            block_number: blockNumber,
            block_timestamp: blockTimestamp,
            transaction_hash: transactionHash,
            sy: sy ?? "",
            expiry: Number(expiry),
            pt: pt ?? "",
            yt: yt ?? "",
            creator: creator ?? "",
            underlying: underlying ?? "",
            underlying_symbol: underlyingSymbol,
            initial_exchange_rate: initialExchangeRate.toString(),
            market_index: marketIndex,
          });
        } else if (matchSelector(eventKey, CLASS_HASHES_UPDATED)) {
          const ytClassHash = event.data[0];
          const ptClassHash = event.data[1];

          console.log(`[factory] ClassHashesUpdated at block ${blockNumber}`);

          classHashesRows.push({
            block_number: blockNumber,
            block_timestamp: blockTimestamp,
            transaction_hash: transactionHash,
            yt_class_hash: ytClassHash ?? "",
            pt_class_hash: ptClassHash ?? "",
          });
        }
      }

      // Batch insert all events (parallel inserts for different tables)
      const insertPromises: Promise<unknown>[] = [];
      if (yieldContractsRows.length > 0)
        insertPromises.push(
          db.insert(factoryYieldContractsCreated).values(yieldContractsRows),
        );
      if (classHashesRows.length > 0)
        insertPromises.push(
          db.insert(factoryClassHashesUpdated).values(classHashesRows),
        );

      if (insertPromises.length > 0) {
        await Promise.all(insertPromises);
      }
    },
  });
}
