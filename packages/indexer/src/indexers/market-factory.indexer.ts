/**
 * MarketFactory Indexer
 *
 * Indexes events from the MarketFactory contract:
 * - MarketCreated: When new AMM markets are deployed
 * - MarketClassHashUpdated: When market class hash is updated
 */

import {
  marketFactoryClassHashUpdated,
  marketFactoryMarketCreated,
} from "@/schema";
import {
  drizzle,
  drizzleStorage,
  useDrizzleStorage,
} from "@apibara/plugin-drizzle";
import { getSelector, StarknetStream } from "@apibara/starknet";
import { defineIndexer } from "apibara/indexer";
import type { ApibaraRuntimeConfig } from "apibara/types";
import { getNetworkConfig } from "../lib/constants";
import { getDrizzleOptions } from "../lib/database";
import { streamTimeoutPlugin } from "../lib/plugins";
import { decodeByteArray, matchSelector, readU256 } from "../lib/utils";

// Event selectors using Apibara's getSelector helper
const MARKET_CREATED = getSelector("MarketCreated");
const MARKET_CLASS_HASH_UPDATED = getSelector("MarketClassHashUpdated");

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

  console.log(
    `[market-factory] Starting indexer with streamUrl: ${streamUrl}, startingBlock: ${config.startingBlock}`,
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
      // Log progress every 1000 blocks (reduced frequency for performance)
      const blockNumber = Number(block.header.blockNumber);
      if (blockNumber % 1000 === 0) {
        console.log(
          `[market-factory] Block ${blockNumber} | Cursor: ${endCursor?.orderKey}`,
        );
      }

      if (block.events.length === 0) return;

      const { db } = useDrizzleStorage();
      const { events, header } = block;
      const blockTimestamp = header.timestamp;

      // Collect events by type for batch insert
      type MarketCreatedRow = typeof marketFactoryMarketCreated.$inferInsert;
      type ClassHashRow = typeof marketFactoryClassHashUpdated.$inferInsert;

      const marketCreatedRows: MarketCreatedRow[] = [];
      const classHashRows: ClassHashRow[] = [];

      for (const event of events) {
        const transactionHash = event.transactionHash;
        const eventKey = event.keys[0];

        if (matchSelector(eventKey, MARKET_CREATED)) {
          const pt = event.keys[1];
          const expiry = BigInt(event.keys[2] ?? "0");

          const data = event.data as string[];
          const market = data[0];
          const creator = data[1];
          // u256 fields use 2 felts each (low, high)
          const scalarRoot = readU256(data, 2);
          const initialAnchor = readU256(data, 4);
          const feeRate = readU256(data, 6);
          const sy = data[8];
          const yt = data[9];
          const underlying = data[10];
          const underlyingSymbol = decodeByteArray(data, 11);
          const initialExchangeRate = readU256(data, 14);
          const _timestamp = BigInt(data[16] ?? "0");
          const marketIndex = Number(data[17] ?? "0");

          marketCreatedRows.push({
            block_number: blockNumber,
            block_timestamp: blockTimestamp,
            transaction_hash: transactionHash,
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
          const oldClassHash = event.data[0];
          const newClassHash = event.data[1];

          classHashRows.push({
            block_number: blockNumber,
            block_timestamp: blockTimestamp,
            transaction_hash: transactionHash,
            old_class_hash: oldClassHash ?? "",
            new_class_hash: newClassHash ?? "",
          });
        }
      }

      // Batch insert all events (parallel inserts for different tables)
      const insertPromises: Promise<unknown>[] = [];
      if (marketCreatedRows.length > 0)
        insertPromises.push(
          db.insert(marketFactoryMarketCreated).values(marketCreatedRows),
        );
      if (classHashRows.length > 0)
        insertPromises.push(
          db.insert(marketFactoryClassHashUpdated).values(classHashRows),
        );

      if (insertPromises.length > 0) {
        await Promise.all(insertPromises);
      }
    },
  });
}
