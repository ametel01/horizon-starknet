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
import { getSelector, StarknetStream } from "@apibara/starknet";
import { defineIndexer } from "apibara/indexer";
import type { ApibaraRuntimeConfig } from "apibara/types";
import { getNetworkConfig } from "../lib/constants";
import { getDrizzleOptions } from "../lib/database";
import { streamTimeoutPlugin } from "../lib/plugins";
import { matchSelector, readU256 } from "../lib/utils";

// Event selectors using Apibara's getSelector helper
const MINT_PY = getSelector("MintPY");
const REDEEM_PY = getSelector("RedeemPY");
const ADD_LIQUIDITY = getSelector("AddLiquidity");
const REMOVE_LIQUIDITY = getSelector("RemoveLiquidity");
const SWAP = getSelector("Swap");
const SWAP_YT = getSelector("SwapYT");

export default function routerIndexer(runtimeConfig: ApibaraRuntimeConfig) {
  const config = getNetworkConfig(runtimeConfig.network);
  const streamUrl =
    runtimeConfig.starknet?.streamUrl ?? "http://localhost:7171";

  const database = drizzle(
    getDrizzleOptions({
      routerMintPY,
      routerRedeemPY,
      routerAddLiquidity,
      routerRemoveLiquidity,
      routerSwap,
      routerSwapYT,
    }),
  );

  console.log(
    `[router] Starting indexer with streamUrl: ${streamUrl}, startingBlock: ${config.startingBlock}`,
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
        indexerName: "router",
        migrate: { migrationsFolder: "./drizzle" },
      }),
    ],
    filter: {
      header: "always",
      events: [
        { address: config.router, keys: [MINT_PY] },
        { address: config.router, keys: [REDEEM_PY] },
        { address: config.router, keys: [ADD_LIQUIDITY] },
        { address: config.router, keys: [REMOVE_LIQUIDITY] },
        { address: config.router, keys: [SWAP] },
        { address: config.router, keys: [SWAP_YT] },
      ],
    },
    async transform({ block, endCursor }) {
      // Log progress every 1000 blocks (reduced frequency for performance)
      const blockNum = Number(block.header.blockNumber);
      if (blockNum % 1000 === 0) {
        console.log(
          `[router] Block ${blockNum} | Cursor: ${endCursor?.orderKey}`,
        );
      }

      if (block.events.length === 0) return;

      const { db } = useDrizzleStorage();
      const { events, header } = block;

      const blockNumber = Number(header.blockNumber);
      const blockTimestamp = header.timestamp;

      // Collect events by type for batch insert
      type MintPYRow = typeof routerMintPY.$inferInsert;
      type RedeemPYRow = typeof routerRedeemPY.$inferInsert;
      type AddLiquidityRow = typeof routerAddLiquidity.$inferInsert;
      type RemoveLiquidityRow = typeof routerRemoveLiquidity.$inferInsert;
      type SwapRow = typeof routerSwap.$inferInsert;
      type SwapYTRow = typeof routerSwapYT.$inferInsert;

      const mintPYRows: MintPYRow[] = [];
      const redeemPYRows: RedeemPYRow[] = [];
      const addLiquidityRows: AddLiquidityRow[] = [];
      const removeLiquidityRows: RemoveLiquidityRow[] = [];
      const swapRows: SwapRow[] = [];
      const swapYTRows: SwapYTRow[] = [];

      for (const event of events) {
        const transactionHash = event.transactionHash;
        const eventKey = event.keys[0];
        const data = event.data as string[];

        // Common: keys always have [selector, sender, receiver]
        const sender = event.keys[1] ?? "";
        const receiver = event.keys[2] ?? "";

        if (matchSelector(eventKey, MINT_PY)) {
          const yt = data[0];
          const syIn = readU256(data, 1);
          const ptOut = readU256(data, 3);
          const ytOut = readU256(data, 5);

          mintPYRows.push({
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
        } else if (matchSelector(eventKey, REDEEM_PY)) {
          const yt = data[0];
          const pyIn = readU256(data, 1);
          const syOut = readU256(data, 3);

          redeemPYRows.push({
            block_number: blockNumber,
            block_timestamp: blockTimestamp,
            transaction_hash: transactionHash,
            sender,
            receiver,
            yt: yt ?? "",
            py_in: pyIn,
            sy_out: syOut,
          });
        } else if (matchSelector(eventKey, ADD_LIQUIDITY)) {
          const market = data[0];
          const syUsed = readU256(data, 1);
          const ptUsed = readU256(data, 3);
          const lpOut = readU256(data, 5);

          addLiquidityRows.push({
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
        } else if (matchSelector(eventKey, REMOVE_LIQUIDITY)) {
          const market = data[0];
          const lpIn = readU256(data, 1);
          const syOut = readU256(data, 3);
          const ptOut = readU256(data, 5);

          removeLiquidityRows.push({
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
        } else if (matchSelector(eventKey, SWAP)) {
          const market = data[0];
          const syIn = readU256(data, 1);
          const ptIn = readU256(data, 3);
          const syOut = readU256(data, 5);
          const ptOut = readU256(data, 7);

          swapRows.push({
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
        } else if (matchSelector(eventKey, SWAP_YT)) {
          const yt = data[0];
          const market = data[1];
          const syIn = readU256(data, 2);
          const ytIn = readU256(data, 4);
          const syOut = readU256(data, 6);
          const ytOut = readU256(data, 8);

          swapYTRows.push({
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

      // Batch insert all events (parallel inserts for different tables)
      const insertPromises: Promise<unknown>[] = [];
      if (mintPYRows.length > 0)
        insertPromises.push(db.insert(routerMintPY).values(mintPYRows));
      if (redeemPYRows.length > 0)
        insertPromises.push(db.insert(routerRedeemPY).values(redeemPYRows));
      if (addLiquidityRows.length > 0)
        insertPromises.push(
          db.insert(routerAddLiquidity).values(addLiquidityRows),
        );
      if (removeLiquidityRows.length > 0)
        insertPromises.push(
          db.insert(routerRemoveLiquidity).values(removeLiquidityRows),
        );
      if (swapRows.length > 0)
        insertPromises.push(db.insert(routerSwap).values(swapRows));
      if (swapYTRows.length > 0)
        insertPromises.push(db.insert(routerSwapYT).values(swapYTRows));

      if (insertPromises.length > 0) {
        await Promise.all(insertPromises);
        console.log(
          `[router] Block ${blockNum} | Inserted ${events.length} events`,
        );
      }
    },
  });
}
