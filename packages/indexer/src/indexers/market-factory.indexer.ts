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

// Event selectors using Apibara's getSelector helper
const MARKET_CREATED = getSelector("MarketCreated");
const MARKET_CLASS_HASH_UPDATED = getSelector("MarketClassHashUpdated");

// Helper to decode ByteArray from felt252 array
function decodeByteArray(data: string[], startIndex: number): string {
  // ByteArray structure: [pending_word, pending_word_len, data_len, ...data]
  // For short strings, we just decode the pending_word
  const pendingWord = data[startIndex];
  if (!pendingWord || pendingWord === "0x0") return "";

  // Convert felt252 to string (short string encoding)
  try {
    const hex = pendingWord.replace("0x", "");
    let str = "";
    for (let i = 0; i < hex.length; i += 2) {
      const charCode = parseInt(hex.substr(i, 2), 16);
      if (charCode === 0) break;
      str += String.fromCharCode(charCode);
    }
    return str;
  } catch {
    return pendingWord;
  }
}

// Helper to compare selectors numerically (handles padding differences)
// DNA stream may return "0x0e316f..." while getSelector returns "0x00e316f..."
function matchSelector(a: string | undefined, b: string): boolean {
  if (!a) return false;
  try {
    return BigInt(a) === BigInt(b);
  } catch {
    return false;
  }
}

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

          const data = event.data;
          const market = data[0];
          const creator = data[1];
          const scalarRoot = BigInt(data[2] ?? "0");
          const initialAnchor = BigInt(data[4] ?? "0");
          const feeRate = BigInt(data[6] ?? "0");
          const sy = data[8];
          const yt = data[9];
          const underlying = data[10];
          const underlyingSymbol = decodeByteArray(data as string[], 11);
          const initialExchangeRate = BigInt(data[14] ?? "0");
          const marketIndex = Number(data[16] ?? "0");

          marketCreatedRows.push({
            block_number: blockNumber,
            block_timestamp: blockTimestamp,
            transaction_hash: transactionHash,
            pt: pt ?? "",
            expiry: Number(expiry),
            market: market ?? "",
            creator: creator ?? "",
            scalar_root: scalarRoot.toString(),
            initial_anchor: initialAnchor.toString(),
            fee_rate: feeRate.toString(),
            sy: sy ?? "",
            yt: yt ?? "",
            underlying: underlying ?? "",
            underlying_symbol: underlyingSymbol,
            initial_exchange_rate: initialExchangeRate.toString(),
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
