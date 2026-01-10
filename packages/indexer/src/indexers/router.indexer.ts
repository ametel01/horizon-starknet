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
 * - RolloverLP: Rolling LP from old market to new market
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
  routerAddLiquidity,
  routerMintPY,
  routerRedeemPY,
  routerRemoveLiquidity,
  routerRolloverLp,
  routerSwap,
  routerSwapYT,
} from "@/schema";
import { getNetworkConfig } from "../lib/constants";
import { getDrizzleOptions } from "../lib/database";
import { isProgrammerError } from "../lib/errors";
import {
  createIndexerLogger,
  logBatchInsert,
  logBlockProgress,
  logIndexerStart,
} from "../lib/logger";
import { measureDbLatency, recordBlock, recordEvents } from "../lib/metrics";
import { streamTimeoutPlugin } from "../lib/plugins";
import { matchSelector, readU256 } from "../lib/utils";
import {
  routerAddLiquiditySchema,
  routerMintPYSchema,
  routerRedeemPYSchema,
  routerRemoveLiquiditySchema,
  routerRolloverLPSchema,
  routerSwapSchema,
  routerSwapYTSchema,
  validateEvent,
} from "../lib/validation";

const log = createIndexerLogger("router");

// Event selectors using Apibara's getSelector helper
const MINT_PY = getSelector("MintPY");
const REDEEM_PY = getSelector("RedeemPY");
const ADD_LIQUIDITY = getSelector("AddLiquidity");
const REMOVE_LIQUIDITY = getSelector("RemoveLiquidity");
const SWAP = getSelector("Swap");
const SWAP_YT = getSelector("SwapYT");
const ROLLOVER_LP = getSelector("RolloverLP");

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
      routerRolloverLp,
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
        { address: config.router, keys: [ROLLOVER_LP] },
      ],
    },
    async transform({ block, endCursor }) {
      const blockNum = Number(block.header.blockNumber);
      logBlockProgress(log, blockNum, endCursor?.orderKey);

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
      type RolloverLpRow = typeof routerRolloverLp.$inferInsert;

      const mintPYRows: MintPYRow[] = [];
      const redeemPYRows: RedeemPYRow[] = [];
      const addLiquidityRows: AddLiquidityRow[] = [];
      const removeLiquidityRows: RemoveLiquidityRow[] = [];
      const swapRows: SwapRow[] = [];
      const swapYTRows: SwapYTRow[] = [];
      const rolloverLpRows: RolloverLpRow[] = [];

      // Track errors for this block
      let errorCount = 0;

      for (let i = 0; i < events.length; i++) {
        const event = events.at(i)!;
        const transactionHash = event.transactionHash;
        const eventKey = event.keys[0];
        // Use event.eventIndex from Apibara, fallback to array position
        const eventIndex = event.eventIndex ?? i;

        try {
          // Common: keys always have [selector, sender, receiver]
          const sender = event.keys[1] ?? "";
          const receiver = event.keys[2] ?? "";

          if (matchSelector(eventKey, MINT_PY)) {
            // Validate event structure
            const validated = validateEvent(routerMintPYSchema, event, {
              indexer: "router",
              eventName: "MintPY",
              blockNumber,
              transactionHash,
            });
            if (!validated) {
              errorCount++;
              continue;
            }

            const data = validated.data;
            const yt = data[0];
            const syIn = readU256(data, 1, "sy_in");
            const ptOut = readU256(data, 3, "pt_out");
            const ytOut = readU256(data, 5, "yt_out");

            mintPYRows.push({
              block_number: blockNumber,
              block_timestamp: blockTimestamp,
              transaction_hash: transactionHash,
              event_index: eventIndex,
              sender,
              receiver,
              yt: yt ?? "",
              sy_in: syIn,
              pt_out: ptOut,
              yt_out: ytOut,
            });
          } else if (matchSelector(eventKey, REDEEM_PY)) {
            // Validate event structure
            const validated = validateEvent(routerRedeemPYSchema, event, {
              indexer: "router",
              eventName: "RedeemPY",
              blockNumber,
              transactionHash,
            });
            if (!validated) {
              errorCount++;
              continue;
            }

            const data = validated.data;
            const yt = data[0];
            const pyIn = readU256(data, 1, "py_in");
            const syOut = readU256(data, 3, "sy_out");

            redeemPYRows.push({
              block_number: blockNumber,
              block_timestamp: blockTimestamp,
              transaction_hash: transactionHash,
              event_index: eventIndex,
              sender,
              receiver,
              yt: yt ?? "",
              py_in: pyIn,
              sy_out: syOut,
            });
          } else if (matchSelector(eventKey, ADD_LIQUIDITY)) {
            // Validate event structure
            const validated = validateEvent(routerAddLiquiditySchema, event, {
              indexer: "router",
              eventName: "AddLiquidity",
              blockNumber,
              transactionHash,
            });
            if (!validated) {
              errorCount++;
              continue;
            }

            const data = validated.data;
            const market = data[0];
            const syUsed = readU256(data, 1, "sy_used");
            const ptUsed = readU256(data, 3, "pt_used");
            const lpOut = readU256(data, 5, "lp_out");

            addLiquidityRows.push({
              block_number: blockNumber,
              block_timestamp: blockTimestamp,
              transaction_hash: transactionHash,
              event_index: eventIndex,
              sender,
              receiver,
              market: market ?? "",
              sy_used: syUsed,
              pt_used: ptUsed,
              lp_out: lpOut,
            });
          } else if (matchSelector(eventKey, REMOVE_LIQUIDITY)) {
            // Validate event structure
            const validated = validateEvent(
              routerRemoveLiquiditySchema,
              event,
              {
                indexer: "router",
                eventName: "RemoveLiquidity",
                blockNumber,
                transactionHash,
              }
            );
            if (!validated) {
              errorCount++;
              continue;
            }

            const data = validated.data;
            const market = data[0];
            const lpIn = readU256(data, 1, "lp_in");
            const syOut = readU256(data, 3, "sy_out");
            const ptOut = readU256(data, 5, "pt_out");

            removeLiquidityRows.push({
              block_number: blockNumber,
              block_timestamp: blockTimestamp,
              transaction_hash: transactionHash,
              event_index: eventIndex,
              sender,
              receiver,
              market: market ?? "",
              lp_in: lpIn,
              sy_out: syOut,
              pt_out: ptOut,
            });
          } else if (matchSelector(eventKey, SWAP)) {
            // Validate event structure
            const validated = validateEvent(routerSwapSchema, event, {
              indexer: "router",
              eventName: "Swap",
              blockNumber,
              transactionHash,
            });
            if (!validated) {
              errorCount++;
              continue;
            }

            const data = validated.data;
            const market = data[0];
            const syIn = readU256(data, 1, "sy_in");
            const ptIn = readU256(data, 3, "pt_in");
            const syOut = readU256(data, 5, "sy_out");
            const ptOut = readU256(data, 7, "pt_out");

            swapRows.push({
              block_number: blockNumber,
              block_timestamp: blockTimestamp,
              transaction_hash: transactionHash,
              event_index: eventIndex,
              sender,
              receiver,
              market: market ?? "",
              sy_in: syIn,
              pt_in: ptIn,
              sy_out: syOut,
              pt_out: ptOut,
            });
          } else if (matchSelector(eventKey, SWAP_YT)) {
            // Validate event structure
            const validated = validateEvent(routerSwapYTSchema, event, {
              indexer: "router",
              eventName: "SwapYT",
              blockNumber,
              transactionHash,
            });
            if (!validated) {
              errorCount++;
              continue;
            }

            const data = validated.data;
            const yt = data[0];
            const market = data[1];
            const syIn = readU256(data, 2, "sy_in");
            const ytIn = readU256(data, 4, "yt_in");
            const syOut = readU256(data, 6, "sy_out");
            const ytOut = readU256(data, 8, "yt_out");

            swapYTRows.push({
              block_number: blockNumber,
              block_timestamp: blockTimestamp,
              transaction_hash: transactionHash,
              event_index: eventIndex,
              sender,
              receiver,
              yt: yt ?? "",
              market: market ?? "",
              sy_in: syIn,
              yt_in: ytIn,
              sy_out: syOut,
              yt_out: ytOut,
            });
          } else if (matchSelector(eventKey, ROLLOVER_LP)) {
            // Validate event structure
            const validated = validateEvent(routerRolloverLPSchema, event, {
              indexer: "router",
              eventName: "RolloverLP",
              blockNumber,
              transactionHash,
            });
            if (!validated) {
              errorCount++;
              continue;
            }

            const data = validated.data;
            const marketOld = data[0];
            const marketNew = data[1];
            const lpBurned = readU256(data, 2, "lp_burned");
            const lpMinted = readU256(data, 4, "lp_minted");

            rolloverLpRows.push({
              block_number: blockNumber,
              block_timestamp: blockTimestamp,
              transaction_hash: transactionHash,
              event_index: eventIndex,
              sender,
              receiver,
              market_old: marketOld ?? "",
              market_new: marketNew ?? "",
              lp_burned: lpBurned,
              lp_minted: lpMinted,
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
      await measureDbLatency("router", async () => {
        await db.transaction(async (tx) => {
          if (mintPYRows.length > 0) {
            await tx
              .insert(routerMintPY)
              .values(mintPYRows)
              .onConflictDoNothing();
          }
          if (redeemPYRows.length > 0) {
            await tx
              .insert(routerRedeemPY)
              .values(redeemPYRows)
              .onConflictDoNothing();
          }
          if (addLiquidityRows.length > 0) {
            await tx
              .insert(routerAddLiquidity)
              .values(addLiquidityRows)
              .onConflictDoNothing();
          }
          if (removeLiquidityRows.length > 0) {
            await tx
              .insert(routerRemoveLiquidity)
              .values(removeLiquidityRows)
              .onConflictDoNothing();
          }
          if (swapRows.length > 0) {
            await tx.insert(routerSwap).values(swapRows).onConflictDoNothing();
          }
          if (swapYTRows.length > 0) {
            await tx
              .insert(routerSwapYT)
              .values(swapYTRows)
              .onConflictDoNothing();
          }
          if (rolloverLpRows.length > 0) {
            await tx
              .insert(routerRolloverLp)
              .values(rolloverLpRows)
              .onConflictDoNothing();
          }
        });
      });

      // Record metrics
      const successCount =
        mintPYRows.length +
        redeemPYRows.length +
        addLiquidityRows.length +
        removeLiquidityRows.length +
        swapRows.length +
        swapYTRows.length +
        rolloverLpRows.length;
      recordEvents("router", successCount, errorCount);
      recordBlock("router", blockNumber);

      logBatchInsert(log, blockNum, events.length);
    },
  });
}
