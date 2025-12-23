/**
 * SY (Standardized Yield) Indexer
 *
 * Uses factory pattern to discover SY contracts from Factory.YieldContractsCreated events.
 *
 * Indexes events from SY contracts:
 * - Deposit: User deposits underlying to get SY
 * - Redeem: User redeems SY for underlying
 * - OracleRateUpdated: Exchange rate update from oracle
 */

import { syDeposit, syOracleRateUpdated, syRedeem } from "@/schema";
import {
  drizzle,
  drizzleStorage,
  useDrizzleStorage,
} from "@apibara/plugin-drizzle";
import { getSelector, StarknetStream } from "@apibara/starknet";
import { defineIndexer } from "apibara/indexer";
import type { ApibaraRuntimeConfig } from "apibara/types";
import { getNetworkConfig } from "../lib/constants";
import { streamTimeoutPlugin } from "../lib/plugins";

// Factory event to discover SY contracts
const YIELD_CONTRACTS_CREATED = getSelector("YieldContractsCreated");

// SY events
const DEPOSIT = getSelector("Deposit");
const REDEEM = getSelector("Redeem");
const ORACLE_RATE_UPDATED = getSelector("OracleRateUpdated");

// Helper to read u256 (2 felts: low, high)
function readU256(data: string[], index: number): string {
  const low = BigInt(data[index] ?? "0");
  const high = BigInt(data[index + 1] ?? "0");
  return ((high << 128n) + low).toString();
}

export default function syIndexer(runtimeConfig: ApibaraRuntimeConfig) {
  const config = getNetworkConfig(runtimeConfig.network);
  const streamUrl =
    runtimeConfig.starknet?.streamUrl ?? "http://localhost:7171";

  const database = drizzle({
    schema: {
      syDeposit,
      syRedeem,
      syOracleRateUpdated,
    },
  });

  console.log(
    `[sy] Starting indexer with streamUrl: ${streamUrl}, startingBlock: ${config.startingBlock}`,
  );

  // Build initial filter with factory event + known SY contracts
  // This ensures the indexer works correctly after restarts when the checkpoint
  // is past the block where YieldContractsCreated was emitted
  const knownSYFilters = config.knownSYContracts.flatMap((syAddress) => [
    { address: syAddress, keys: [DEPOSIT] },
    { address: syAddress, keys: [REDEEM] },
    { address: syAddress, keys: [ORACLE_RATE_UPDATED] },
  ]);

  console.log(
    `[sy] Including ${config.knownSYContracts.length} known SY contracts in initial filter`,
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
        indexerName: "sy",
        migrate: { migrationsFolder: "./drizzle" },
      }),
    ],
    // Initial filter: listen to Factory for new SY contracts + known SY contracts
    filter: {
      header: "always",
      events: [
        { address: config.factory, keys: [YIELD_CONTRACTS_CREATED] },
        ...knownSYFilters,
      ],
    },
    // Factory function: dynamically add filters for discovered SY contracts
    async factory({ block: { events } }) {
      const newFilters = (events ?? []).flatMap((event) => {
        if (event.keys[0] !== YIELD_CONTRACTS_CREATED) return [];

        // YieldContractsCreated: keys = [selector, sy, expiry]
        const syAddress = event.keys[1] as `0x${string}`;

        return [
          { address: syAddress, keys: [DEPOSIT] },
          { address: syAddress, keys: [REDEEM] },
          { address: syAddress, keys: [ORACLE_RATE_UPDATED] },
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
          `[sy] Block ${blockNum} | Events: ${block.events.length} | Cursor: ${endCursor?.orderKey}`,
        );
      }
      const { db } = useDrizzleStorage();
      const { events, header } = block;

      const blockNumber = Number(header.blockNumber);
      const blockTimestamp = header.timestamp;

      for (const event of events) {
        const transactionHash = event.transactionHash;
        const eventKey = event.keys[0];
        const syAddress = event.address;
        const data = event.data as string[];

        if (eventKey === DEPOSIT) {
          // Deposit event
          // Keys: [selector, caller, receiver, underlying]
          // Data: [amount_deposited (u256), amount_sy_minted (u256), exchange_rate (u256), total_supply_after (u256)]
          const caller = event.keys[1] ?? "";
          const receiver = event.keys[2] ?? "";
          const underlying = event.keys[3] ?? "";

          const amountDeposited = readU256(data, 0);
          const amountSyMinted = readU256(data, 2);
          const exchangeRate = readU256(data, 4);
          const totalSupplyAfter = readU256(data, 6);

          await db.insert(syDeposit).values({
            block_number: blockNumber,
            block_timestamp: blockTimestamp,
            transaction_hash: transactionHash,
            caller,
            receiver,
            underlying,
            sy: syAddress,
            amount_deposited: amountDeposited,
            amount_sy_minted: amountSyMinted,
            exchange_rate: exchangeRate,
            total_supply_after: totalSupplyAfter,
          });
        } else if (eventKey === REDEEM) {
          // Redeem event
          // Keys: [selector, caller, receiver, underlying]
          // Data: [amount_sy_burned (u256), amount_redeemed (u256), exchange_rate (u256), total_supply_after (u256)]
          const caller = event.keys[1] ?? "";
          const receiver = event.keys[2] ?? "";
          const underlying = event.keys[3] ?? "";

          const amountSyBurned = readU256(data, 0);
          const amountRedeemed = readU256(data, 2);
          const exchangeRate = readU256(data, 4);
          const totalSupplyAfter = readU256(data, 6);

          await db.insert(syRedeem).values({
            block_number: blockNumber,
            block_timestamp: blockTimestamp,
            transaction_hash: transactionHash,
            caller,
            receiver,
            underlying,
            sy: syAddress,
            amount_sy_burned: amountSyBurned,
            amount_redeemed: amountRedeemed,
            exchange_rate: exchangeRate,
            total_supply_after: totalSupplyAfter,
          });
        } else if (eventKey === ORACLE_RATE_UPDATED) {
          // OracleRateUpdated event
          // Keys: [selector, sy, underlying]
          // Data: [old_rate (u256), new_rate (u256), rate_change_bps (u256)]
          const sy = event.keys[1] ?? syAddress;
          const underlying = event.keys[2] ?? "";

          const oldRate = readU256(data, 0);
          const newRate = readU256(data, 2);
          const rateChangeBps = readU256(data, 4);

          await db.insert(syOracleRateUpdated).values({
            block_number: blockNumber,
            block_timestamp: blockTimestamp,
            transaction_hash: transactionHash,
            sy,
            underlying,
            old_rate: oldRate,
            new_rate: newRate,
            rate_change_bps: rateChangeBps,
          });
        }
      }
    },
  });
}
