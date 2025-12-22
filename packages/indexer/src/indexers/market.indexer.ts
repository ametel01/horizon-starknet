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

// MarketFactory event to discover Market contracts
const MARKET_CREATED = getSelector("MarketCreated");

// Market events
const MINT = getSelector("Mint");
const BURN = getSelector("Burn");
const SWAP = getSelector("Swap");
const IMPLIED_RATE_UPDATED = getSelector("ImpliedRateUpdated");
const FEES_COLLECTED = getSelector("FeesCollected");

// Helper to read u256 (2 felts: low, high)
function readU256(data: string[], index: number): string {
  const low = BigInt(data[index] ?? "0");
  const high = BigInt(data[index + 1] ?? "0");
  return ((high << 128n) + low).toString();
}

export default function marketIndexer(runtimeConfig: ApibaraRuntimeConfig) {
  const config = getNetworkConfig(runtimeConfig.network);
  const streamUrl =
    runtimeConfig.starknet?.streamUrl ?? "http://localhost:7171";

  const database = drizzle({
    schema: {
      marketMint,
      marketBurn,
      marketSwap,
      marketImpliedRateUpdated,
      marketFeesCollected,
    },
  });

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
        if (event.keys[0] !== MARKET_CREATED) return [];

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
      // Log progress every 100 blocks
      const blockNum = Number(block.header.blockNumber);
      if (blockNum % 100 === 0 || block.events.length > 0) {
        console.log(
          `[market] Block ${blockNum} | Events: ${block.events.length} | Cursor: ${endCursor?.orderKey}`,
        );
      }
      const { db } = useDrizzleStorage();
      const { events, header } = block;

      const blockNumber = Number(header.blockNumber);
      const blockTimestamp = header.timestamp;

      for (const event of events) {
        const transactionHash = event.transactionHash;
        const eventKey = event.keys[0];
        const marketAddress = event.address;
        const data = event.data as string[];

        if (eventKey === MINT) {
          // Mint event
          // Keys: [selector, sender, receiver, expiry]
          // Data: [sy, pt, sy_amount (u256), pt_amount (u256), lp_amount (u256),
          //        exchange_rate (u256), implied_rate (u256), sy_reserve (u256),
          //        pt_reserve (u256), total_lp (u256)]
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

          await db.insert(marketMint).values({
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
        } else if (eventKey === BURN) {
          // Burn event
          // Keys: [selector, sender, receiver, expiry]
          // Data: [sy, pt, lp_amount (u256), sy_amount (u256), pt_amount (u256),
          //        exchange_rate (u256), implied_rate (u256), sy_reserve (u256),
          //        pt_reserve (u256), total_lp (u256)]
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

          await db.insert(marketBurn).values({
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
        } else if (eventKey === SWAP) {
          // Swap event
          // Keys: [selector, sender, receiver, expiry]
          // Data: [sy, pt, pt_in (u256), sy_in (u256), pt_out (u256), sy_out (u256),
          //        fee (u256), implied_rate_before (u256), implied_rate_after (u256),
          //        exchange_rate (u256), sy_reserve (u256), pt_reserve (u256)]
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

          await db.insert(marketSwap).values({
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
        } else if (eventKey === IMPLIED_RATE_UPDATED) {
          // ImpliedRateUpdated event
          // Keys: [selector, market, expiry]
          // Data: [old_rate (u256), new_rate (u256), time_to_expiry,
          //        exchange_rate (u256), sy_reserve (u256), pt_reserve (u256), total_lp (u256)]
          const market = event.keys[1] ?? marketAddress;
          const expiry = Number(BigInt(event.keys[2] ?? "0"));

          const oldRate = readU256(data, 0);
          const newRate = readU256(data, 2);
          const timeToExpiry = Number(BigInt(data[4] ?? "0"));
          const exchangeRate = readU256(data, 5);
          const syReserve = readU256(data, 7);
          const ptReserve = readU256(data, 9);
          const totalLp = readU256(data, 11);

          await db.insert(marketImpliedRateUpdated).values({
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
        } else if (eventKey === FEES_COLLECTED) {
          // FeesCollected event
          // Keys: [selector, collector, receiver, market]
          // Data: [amount (u256), expiry, fee_rate (u256)]
          const collector = event.keys[1] ?? "";
          const receiver = event.keys[2] ?? "";
          const market = event.keys[3] ?? marketAddress;

          const amount = readU256(data, 0);
          const expiry = Number(BigInt(data[2] ?? "0"));
          const feeRate = readU256(data, 3);

          await db.insert(marketFeesCollected).values({
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
    },
  });
}
