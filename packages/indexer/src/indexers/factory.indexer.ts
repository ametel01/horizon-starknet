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
import { getNetworkConfig } from "../lib/constants";

// Event selectors using Apibara's getSelector helper
const YIELD_CONTRACTS_CREATED = getSelector("YieldContractsCreated");
const CLASS_HASHES_UPDATED = getSelector("ClassHashesUpdated");

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

export default function factoryIndexer(runtimeConfig: ApibaraRuntimeConfig) {
  const config = getNetworkConfig(runtimeConfig.network);
  const streamUrl =
    runtimeConfig.starknet?.streamUrl ?? "http://localhost:7171";

  const database = drizzle({
    schema: {
      factoryYieldContractsCreated,
      factoryClassHashesUpdated,
    },
  });

  console.log(
    `[factory] Starting indexer with streamUrl: ${streamUrl}, startingBlock: ${config.startingBlock}`,
  );

  return defineIndexer(StarknetStream)({
    streamUrl,
    finality: "accepted",
    startingCursor: { orderKey: BigInt(config.startingBlock) },
    debug: false,
    plugins: [
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
      const { db } = useDrizzleStorage();
      const { events, header } = block;

      const blockNumber = Number(header.blockNumber);
      const blockTimestamp = header.timestamp;

      // Log progress every 100 blocks or when there are events
      if (blockNumber % 100 === 0 || events.length > 0) {
        console.log(
          `[factory] Block ${blockNumber} | Events: ${events.length} | Cursor: ${endCursor?.orderKey}`,
        );
      }

      for (const event of events) {
        const transactionHash = event.transactionHash;
        const eventKey = event.keys[0];

        if (eventKey === YIELD_CONTRACTS_CREATED) {
          // Event: YieldContractsCreated (Enriched)
          // Keys: [selector, sy, expiry]
          // Data: [pt, yt, creator, underlying, underlying_symbol (ByteArray 3 felts),
          //        initial_exchange_rate (u256 2 felts), timestamp, market_index]
          const sy = event.keys[1];
          const expiry = BigInt(event.keys[2] ?? "0");

          const data = event.data;
          const pt = data[0];
          const yt = data[1];
          const creator = data[2];
          const underlying = data[3];
          // ByteArray for underlying_symbol starts at index 4 (3 felts)
          const underlyingSymbol = decodeByteArray(data as string[], 4);
          // After ByteArray (3 felts at indices 4,5,6), initial_exchange_rate is u256 at indices 7,8
          const initialExchangeRate = BigInt(data[7] ?? "0");
          // timestamp at index 9
          const timestamp = BigInt(data[9] ?? "0");
          // market_index at index 10
          const marketIndex = Number(data[10] ?? "0");

          console.log(
            `[factory] YieldContractsCreated: SY=${sy}, PT=${pt}, YT=${yt}, underlying=${underlying}, symbol=${underlyingSymbol}`,
          );

          await db.insert(factoryYieldContractsCreated).values({
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
        } else if (eventKey === CLASS_HASHES_UPDATED) {
          // Event: ClassHashesUpdated
          // Data: [yt_class_hash, pt_class_hash]
          const ytClassHash = event.data[0];
          const ptClassHash = event.data[1];

          console.log(`[factory] ClassHashesUpdated at block ${blockNumber}`);

          await db.insert(factoryClassHashesUpdated).values({
            block_number: blockNumber,
            block_timestamp: blockTimestamp,
            transaction_hash: transactionHash,
            yt_class_hash: ytClassHash ?? "",
            pt_class_hash: ptClassHash ?? "",
          });
        }
      }
    },
  });
}
