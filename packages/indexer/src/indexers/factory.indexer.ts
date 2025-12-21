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
import { StarknetStream } from "@apibara/starknet";
import { defineIndexer } from "apibara/indexer";
import type { ApibaraRuntimeConfig } from "apibara/types";
import { hash } from "starknet";
import { getNetworkConfig } from "../lib/constants";

// Event selectors
const YIELD_CONTRACTS_CREATED = hash.getSelectorFromName(
  "YieldContractsCreated",
) as `0x${string}`;
const CLASS_HASHES_UPDATED = hash.getSelectorFromName(
  "ClassHashesUpdated",
) as `0x${string}`;

export default function factoryIndexer(runtimeConfig: ApibaraRuntimeConfig) {
  const config = getNetworkConfig(runtimeConfig.preset);
  const streamUrl =
    runtimeConfig.starknet?.streamUrl ?? "http://localhost:7171";

  const database = drizzle({
    schema: {
      factoryYieldContractsCreated,
      factoryClassHashesUpdated,
    },
  });

  return defineIndexer(StarknetStream)({
    streamUrl,
    finality: "accepted",
    startingBlock: BigInt(config.startingBlock),
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
      events: [
        { address: config.factory, keys: [YIELD_CONTRACTS_CREATED] },
        { address: config.factory, keys: [CLASS_HASHES_UPDATED] },
      ],
    },
    async transform({ block }) {
      const { db } = useDrizzleStorage();
      const { events, header } = block;

      const blockNumber = Number(header.blockNumber);
      const blockTimestamp = header.timestamp;

      for (const event of events) {
        const transactionHash = event.transactionHash;
        const eventKey = event.keys[0];

        if (eventKey === YIELD_CONTRACTS_CREATED) {
          // Event: YieldContractsCreated
          // Keys: [selector, sy, expiry]
          // Data: [pt, yt, creator]
          const sy = event.keys[1];
          const expiry = BigInt(event.keys[2] ?? "0");
          const pt = event.data[0];
          const yt = event.data[1];
          const creator = event.data[2];

          await db.insert(factoryYieldContractsCreated).values({
            block_number: blockNumber,
            block_timestamp: blockTimestamp,
            transaction_hash: transactionHash,
            sy: sy ?? "",
            expiry: Number(expiry),
            pt: pt ?? "",
            yt: yt ?? "",
            creator: creator ?? "",
          });
        } else if (eventKey === CLASS_HASHES_UPDATED) {
          // Event: ClassHashesUpdated
          // Data: [yt_class_hash, pt_class_hash]
          const ytClassHash = event.data[0];
          const ptClassHash = event.data[1];

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
