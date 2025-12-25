/**
 * Market (AMM) Indexer
 *
 * Uses factory pattern to discover Market contracts from MarketFactory.MarketCreated events.
 *
 * Indexes events from Market contracts:
 * - Mint: Adding liquidity to the market
 * - Burn: Removing liquidity from the market
 * - Swap: Swapping PT/SY in the market
 * - ImpliedRateUpdated: Implied rate changes
 * - FeesCollected: Protocol fees collected
 */

import {
  marketBurn,
  marketFeesCollected,
  marketImpliedRateUpdated,
  marketMint,
  marketSwap,
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

// MarketFactory event to discover Market contracts
const MARKET_CREATED = getSelector("MarketCreated");

// Market events
const MINT = getSelector("Mint");
const BURN = getSelector("Burn");
const SWAP = getSelector("Swap");
const IMPLIED_RATE_UPDATED = getSelector("ImpliedRateUpdated");
const FEES_COLLECTED = getSelector("FeesCollected");

export default function marketIndexer(runtimeConfig: ApibaraRuntimeConfig) {
  const config = getNetworkConfig(runtimeConfig.network);
  const streamUrl =
    runtimeConfig.starknet?.streamUrl ?? "http://localhost:7171";

  const database = drizzle(
    getDrizzleOptions({
      marketMint,
      marketBurn,
      marketSwap,
      marketImpliedRateUpdated,
      marketFeesCollected,
    }),
  );

  console.log(
    `[market] Starting indexer with streamUrl: ${streamUrl}, startingBlock: ${config.startingBlock}`,
  );

  // Build initial filter with factory event + known Market contracts
  // This ensures the indexer works correctly after restarts when the checkpoint
  // is past the block where MarketCreated was emitted
  const knownMarketFilters = config.knownMarkets.flatMap((marketAddress) => [
    { address: marketAddress, keys: [MINT] },
    { address: marketAddress, keys: [BURN] },
    { address: marketAddress, keys: [SWAP] },
    { address: marketAddress, keys: [IMPLIED_RATE_UPDATED] },
    { address: marketAddress, keys: [FEES_COLLECTED] },
  ]);

  console.log(
    `[market] Including ${config.knownMarkets.length} known Market contracts in initial filter`,
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
        indexerName: "market",
        migrate: { migrationsFolder: "./drizzle" },
      }),
    ],
    // Initial filter: listen to MarketFactory for new Market contracts + known Market contracts
    filter: {
      header: "always",
      events: [
        { address: config.marketFactory, keys: [MARKET_CREATED] },
        ...knownMarketFilters,
      ],
    },
    // Factory function: dynamically add filters for discovered Market contracts
    async factory({ block: { events } }) {
      const newFilters = (events ?? []).flatMap((event) => {
        if (!matchSelector(event.keys[0], MARKET_CREATED)) return [];

        // MarketCreated: keys = [selector, pt, expiry], data = [market, ...]
        const marketAddress = event.data[0] as `0x${string}`;

        return [
          { address: marketAddress, keys: [MINT] },
          { address: marketAddress, keys: [BURN] },
          { address: marketAddress, keys: [SWAP] },
          { address: marketAddress, keys: [IMPLIED_RATE_UPDATED] },
          { address: marketAddress, keys: [FEES_COLLECTED] },
        ];
      });

      if (newFilters.length === 0) return {};

      return {
        filter: {
          events: newFilters,
        },
      };
    },
    async transform({ block, endCursor }) {
      // Log progress every 1000 blocks (reduced frequency for performance)
      const blockNum = Number(block.header.blockNumber);
      if (blockNum % 1000 === 0) {
        console.log(
          `[market] Block ${blockNum} | Cursor: ${endCursor?.orderKey}`,
        );
      }

      if (block.events.length === 0) return;

      const { db } = useDrizzleStorage();
      const { events, header } = block;

      const blockNumber = Number(header.blockNumber);
      const blockTimestamp = header.timestamp;

      // Collect events by type for batch insert
      type MintRow = typeof marketMint.$inferInsert;
      type BurnRow = typeof marketBurn.$inferInsert;
      type SwapRow = typeof marketSwap.$inferInsert;
      type ImpliedRateRow = typeof marketImpliedRateUpdated.$inferInsert;
      type FeesRow = typeof marketFeesCollected.$inferInsert;

      const mintRows: MintRow[] = [];
      const burnRows: BurnRow[] = [];
      const swapRows: SwapRow[] = [];
      const impliedRateRows: ImpliedRateRow[] = [];
      const feesRows: FeesRow[] = [];

      for (const event of events) {
        const transactionHash = event.transactionHash;
        const eventKey = event.keys[0];
        const marketAddress = event.address;
        const data = event.data as string[];

        if (matchSelector(eventKey, MINT)) {
          const sender = event.keys[1] ?? "";
          const receiver = event.keys[2] ?? "";
          const expiry = Number(BigInt(event.keys[3] ?? "0"));

          const sy = data[0] ?? "";
          const pt = data[1] ?? "";
          const syAmount = readU256(data, 2);
          const ptAmount = readU256(data, 4);
          const lpAmount = readU256(data, 6);
          const exchangeRate = readU256(data, 8);
          const impliedRate = readU256(data, 10);
          const syReserve = readU256(data, 12);
          const ptReserve = readU256(data, 14);
          const totalLp = readU256(data, 16);

          mintRows.push({
            block_number: blockNumber,
            block_timestamp: blockTimestamp,
            transaction_hash: transactionHash,
            sender,
            receiver,
            expiry,
            market: marketAddress,
            sy,
            pt,
            sy_amount: syAmount,
            pt_amount: ptAmount,
            lp_amount: lpAmount,
            exchange_rate: exchangeRate,
            implied_rate: impliedRate,
            sy_reserve_after: syReserve,
            pt_reserve_after: ptReserve,
            total_lp_after: totalLp,
          });
        } else if (matchSelector(eventKey, BURN)) {
          const sender = event.keys[1] ?? "";
          const receiver = event.keys[2] ?? "";
          const expiry = Number(BigInt(event.keys[3] ?? "0"));

          const sy = data[0] ?? "";
          const pt = data[1] ?? "";
          const lpAmount = readU256(data, 2);
          const syAmount = readU256(data, 4);
          const ptAmount = readU256(data, 6);
          const exchangeRate = readU256(data, 8);
          const impliedRate = readU256(data, 10);
          const syReserve = readU256(data, 12);
          const ptReserve = readU256(data, 14);
          const totalLp = readU256(data, 16);

          burnRows.push({
            block_number: blockNumber,
            block_timestamp: blockTimestamp,
            transaction_hash: transactionHash,
            sender,
            receiver,
            expiry,
            market: marketAddress,
            sy,
            pt,
            lp_amount: lpAmount,
            sy_amount: syAmount,
            pt_amount: ptAmount,
            exchange_rate: exchangeRate,
            implied_rate: impliedRate,
            sy_reserve_after: syReserve,
            pt_reserve_after: ptReserve,
            total_lp_after: totalLp,
          });
        } else if (matchSelector(eventKey, SWAP)) {
          const sender = event.keys[1] ?? "";
          const receiver = event.keys[2] ?? "";
          const expiry = Number(BigInt(event.keys[3] ?? "0"));

          const sy = data[0] ?? "";
          const pt = data[1] ?? "";
          const ptIn = readU256(data, 2);
          const syIn = readU256(data, 4);
          const ptOut = readU256(data, 6);
          const syOut = readU256(data, 8);
          const fee = readU256(data, 10);
          const impliedRateBefore = readU256(data, 12);
          const impliedRateAfter = readU256(data, 14);
          const exchangeRate = readU256(data, 16);
          const syReserve = readU256(data, 18);
          const ptReserve = readU256(data, 20);

          swapRows.push({
            block_number: blockNumber,
            block_timestamp: blockTimestamp,
            transaction_hash: transactionHash,
            sender,
            receiver,
            expiry,
            market: marketAddress,
            sy,
            pt,
            pt_in: ptIn,
            sy_in: syIn,
            pt_out: ptOut,
            sy_out: syOut,
            fee,
            implied_rate_before: impliedRateBefore,
            implied_rate_after: impliedRateAfter,
            exchange_rate: exchangeRate,
            sy_reserve_after: syReserve,
            pt_reserve_after: ptReserve,
          });
        } else if (matchSelector(eventKey, IMPLIED_RATE_UPDATED)) {
          const market = event.keys[1] ?? marketAddress;
          const expiry = Number(BigInt(event.keys[2] ?? "0"));

          const oldRate = readU256(data, 0);
          const newRate = readU256(data, 2);
          const timeToExpiry = Number(BigInt(data[4] ?? "0"));
          const exchangeRate = readU256(data, 5);
          const syReserve = readU256(data, 7);
          const ptReserve = readU256(data, 9);
          const totalLp = readU256(data, 11);

          impliedRateRows.push({
            block_number: blockNumber,
            block_timestamp: blockTimestamp,
            transaction_hash: transactionHash,
            market,
            expiry,
            old_rate: oldRate,
            new_rate: newRate,
            time_to_expiry: timeToExpiry,
            exchange_rate: exchangeRate,
            sy_reserve: syReserve,
            pt_reserve: ptReserve,
            total_lp: totalLp,
          });
        } else if (matchSelector(eventKey, FEES_COLLECTED)) {
          const collector = event.keys[1] ?? "";
          const receiver = event.keys[2] ?? "";
          const market = event.keys[3] ?? marketAddress;

          const amount = readU256(data, 0);
          const expiry = Number(BigInt(data[2] ?? "0"));
          const feeRate = readU256(data, 3);

          feesRows.push({
            block_number: blockNumber,
            block_timestamp: blockTimestamp,
            transaction_hash: transactionHash,
            collector,
            receiver,
            market,
            amount,
            expiry,
            fee_rate: feeRate,
          });
        }
      }

      // Batch insert all events (parallel inserts for different tables)
      const insertPromises: Promise<unknown>[] = [];
      if (mintRows.length > 0)
        insertPromises.push(db.insert(marketMint).values(mintRows));
      if (burnRows.length > 0)
        insertPromises.push(db.insert(marketBurn).values(burnRows));
      if (swapRows.length > 0)
        insertPromises.push(db.insert(marketSwap).values(swapRows));
      if (impliedRateRows.length > 0)
        insertPromises.push(
          db.insert(marketImpliedRateUpdated).values(impliedRateRows),
        );
      if (feesRows.length > 0)
        insertPromises.push(db.insert(marketFeesCollected).values(feesRows));

      if (insertPromises.length > 0) {
        await Promise.all(insertPromises);
        console.log(
          `[market] Block ${blockNum} | Inserted ${events.length} events`,
        );
      }
    },
  });
}
