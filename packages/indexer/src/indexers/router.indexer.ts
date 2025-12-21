/**
 * Router Indexer
 *
 * Indexes events from the Router contract:
 * - MintPY: Minting PT/YT from SY
 * - RedeemPY: Redeeming PT/YT to SY
 * - AddLiquidity: Adding liquidity to market
 * - RemoveLiquidity: Removing liquidity from market
 * - Swap: Swapping PT/SY in market
 * - SwapYT: Swapping YT via flash swap
 */

import {
  routerAddLiquidity,
  routerMintPY,
  routerRedeemPY,
  routerRemoveLiquidity,
  routerSwap,
  routerSwapYT,
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
const MINT_PY = hash.getSelectorFromName("MintPY") as `0x${string}`;
const REDEEM_PY = hash.getSelectorFromName("RedeemPY") as `0x${string}`;
const ADD_LIQUIDITY = hash.getSelectorFromName("AddLiquidity") as `0x${string}`;
const REMOVE_LIQUIDITY = hash.getSelectorFromName(
  "RemoveLiquidity",
) as `0x${string}`;
const SWAP = hash.getSelectorFromName("Swap") as `0x${string}`;
const SWAP_YT = hash.getSelectorFromName("SwapYT") as `0x${string}`;

// Helper to read u256 (2 felts: low, high)
function readU256(data: string[], index: number): string {
  const low = BigInt(data[index] ?? "0");
  const high = BigInt(data[index + 1] ?? "0");
  return ((high << 128n) + low).toString();
}

export default function routerIndexer(runtimeConfig: ApibaraRuntimeConfig) {
  const config = getNetworkConfig(runtimeConfig.preset);
  const streamUrl =
    runtimeConfig.starknet?.streamUrl ?? "http://localhost:7171";

  const database = drizzle({
    schema: {
      routerMintPY,
      routerRedeemPY,
      routerAddLiquidity,
      routerRemoveLiquidity,
      routerSwap,
      routerSwapYT,
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
        indexerName: "router",
        migrate: { migrationsFolder: "./drizzle" },
      }),
    ],
    filter: {
      events: [
        { address: config.router, keys: [MINT_PY] },
        { address: config.router, keys: [REDEEM_PY] },
        { address: config.router, keys: [ADD_LIQUIDITY] },
        { address: config.router, keys: [REMOVE_LIQUIDITY] },
        { address: config.router, keys: [SWAP] },
        { address: config.router, keys: [SWAP_YT] },
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
        const data = event.data as string[];

        // Common: keys always have [selector, sender, receiver]
        const sender = event.keys[1] ?? "";
        const receiver = event.keys[2] ?? "";

        if (eventKey === MINT_PY) {
          // Data: [yt, sy_in (u256), pt_out (u256), yt_out (u256)]
          const yt = data[0];
          const syIn = readU256(data, 1);
          const ptOut = readU256(data, 3);
          const ytOut = readU256(data, 5);

          await db.insert(routerMintPY).values({
            block_number: blockNumber,
            block_timestamp: blockTimestamp,
            transaction_hash: transactionHash,
            sender,
            receiver,
            yt: yt ?? "",
            sy_in: syIn,
            pt_out: ptOut,
            yt_out: ytOut,
          });
        } else if (eventKey === REDEEM_PY) {
          // Data: [yt, py_in (u256), sy_out (u256)]
          const yt = data[0];
          const pyIn = readU256(data, 1);
          const syOut = readU256(data, 3);

          await db.insert(routerRedeemPY).values({
            block_number: blockNumber,
            block_timestamp: blockTimestamp,
            transaction_hash: transactionHash,
            sender,
            receiver,
            yt: yt ?? "",
            py_in: pyIn,
            sy_out: syOut,
          });
        } else if (eventKey === ADD_LIQUIDITY) {
          // Data: [market, sy_used (u256), pt_used (u256), lp_out (u256)]
          const market = data[0];
          const syUsed = readU256(data, 1);
          const ptUsed = readU256(data, 3);
          const lpOut = readU256(data, 5);

          await db.insert(routerAddLiquidity).values({
            block_number: blockNumber,
            block_timestamp: blockTimestamp,
            transaction_hash: transactionHash,
            sender,
            receiver,
            market: market ?? "",
            sy_used: syUsed,
            pt_used: ptUsed,
            lp_out: lpOut,
          });
        } else if (eventKey === REMOVE_LIQUIDITY) {
          // Data: [market, lp_in (u256), sy_out (u256), pt_out (u256)]
          const market = data[0];
          const lpIn = readU256(data, 1);
          const syOut = readU256(data, 3);
          const ptOut = readU256(data, 5);

          await db.insert(routerRemoveLiquidity).values({
            block_number: blockNumber,
            block_timestamp: blockTimestamp,
            transaction_hash: transactionHash,
            sender,
            receiver,
            market: market ?? "",
            lp_in: lpIn,
            sy_out: syOut,
            pt_out: ptOut,
          });
        } else if (eventKey === SWAP) {
          // Data: [market, sy_in (u256), pt_in (u256), sy_out (u256), pt_out (u256)]
          const market = data[0];
          const syIn = readU256(data, 1);
          const ptIn = readU256(data, 3);
          const syOut = readU256(data, 5);
          const ptOut = readU256(data, 7);

          await db.insert(routerSwap).values({
            block_number: blockNumber,
            block_timestamp: blockTimestamp,
            transaction_hash: transactionHash,
            sender,
            receiver,
            market: market ?? "",
            sy_in: syIn,
            pt_in: ptIn,
            sy_out: syOut,
            pt_out: ptOut,
          });
        } else if (eventKey === SWAP_YT) {
          // Data: [yt, market, sy_in (u256), yt_in (u256), sy_out (u256), yt_out (u256)]
          const yt = data[0];
          const market = data[1];
          const syIn = readU256(data, 2);
          const ytIn = readU256(data, 4);
          const syOut = readU256(data, 6);
          const ytOut = readU256(data, 8);

          await db.insert(routerSwapYT).values({
            block_number: blockNumber,
            block_timestamp: blockTimestamp,
            transaction_hash: transactionHash,
            sender,
            receiver,
            yt: yt ?? "",
            market: market ?? "",
            sy_in: syIn,
            yt_in: ytIn,
            sy_out: syOut,
            yt_out: ytOut,
          });
        }
      }
    },
  });
}
