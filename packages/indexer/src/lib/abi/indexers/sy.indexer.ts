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
import { getNetworkConfig } from "../../constants";
import { getDrizzleOptions } from "../../database";
import { streamTimeoutPlugin } from "../../plugins";
import { matchSelector, readU256 } from "../../utils";

// Factory event to discover SY contracts
const YIELD_CONTRACTS_CREATED = getSelector("YieldContractsCreated");

// SY events
const DEPOSIT = getSelector("Deposit");
const REDEEM = getSelector("Redeem");
const ORACLE_RATE_UPDATED = getSelector("OracleRateUpdated");

export default function syIndexer(runtimeConfig: ApibaraRuntimeConfig) {
  const config = getNetworkConfig(runtimeConfig.network);
  const streamUrl =
    runtimeConfig.starknet?.streamUrl ?? "http://localhost:7171";

  const database = drizzle(
    getDrizzleOptions({
      syDeposit,
      syRedeem,
      syOracleRateUpdated,
    }),
  );

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
        if (!matchSelector(event.keys[0], YIELD_CONTRACTS_CREATED)) return [];

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
      // Log progress every 1000 blocks (reduced frequency for performance)
      const blockNum = Number(block.header.blockNumber);
      if (blockNum % 1000 === 0) {
        console.log(`[sy] Block ${blockNum} | Cursor: ${endCursor?.orderKey}`);
      }

      if (block.events.length === 0) return;

      const { db } = useDrizzleStorage();
      const { events, header } = block;

      const blockNumber = Number(header.blockNumber);
      const blockTimestamp = header.timestamp;

      // Collect events by type for batch insert
      type DepositRow = typeof syDeposit.$inferInsert;
      type RedeemRow = typeof syRedeem.$inferInsert;
      type OracleRateRow = typeof syOracleRateUpdated.$inferInsert;

      const depositRows: DepositRow[] = [];
      const redeemRows: RedeemRow[] = [];
      const oracleRateRows: OracleRateRow[] = [];

      for (const event of events) {
        const transactionHash = event.transactionHash;
        const eventKey = event.keys[0];
        const syAddress = event.address;
        const data = event.data as string[];

        if (matchSelector(eventKey, DEPOSIT)) {
          const caller = event.keys[1] ?? "";
          const receiver = event.keys[2] ?? "";
          const underlying = event.keys[3] ?? "";

          const amountDeposited = readU256(data, 0);
          const amountSyMinted = readU256(data, 2);
          const exchangeRate = readU256(data, 4);
          const totalSupplyAfter = readU256(data, 6);

          depositRows.push({
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
        } else if (matchSelector(eventKey, REDEEM)) {
          const caller = event.keys[1] ?? "";
          const receiver = event.keys[2] ?? "";
          const underlying = event.keys[3] ?? "";

          const amountSyBurned = readU256(data, 0);
          const amountRedeemed = readU256(data, 2);
          const exchangeRate = readU256(data, 4);
          const totalSupplyAfter = readU256(data, 6);

          redeemRows.push({
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
        } else if (matchSelector(eventKey, ORACLE_RATE_UPDATED)) {
          const sy = event.keys[1] ?? syAddress;
          const underlying = event.keys[2] ?? "";

          const oldRate = readU256(data, 0);
          const newRate = readU256(data, 2);
          const rateChangeBps = readU256(data, 4);

          oracleRateRows.push({
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

      // Batch insert all events (parallel inserts for different tables)
      const insertPromises: Promise<unknown>[] = [];
      if (depositRows.length > 0)
        insertPromises.push(db.insert(syDeposit).values(depositRows));
      if (redeemRows.length > 0)
        insertPromises.push(db.insert(syRedeem).values(redeemRows));
      if (oracleRateRows.length > 0)
        insertPromises.push(
          db.insert(syOracleRateUpdated).values(oracleRateRows),
        );

      if (insertPromises.length > 0) {
        await Promise.all(insertPromises);
        console.log(
          `[sy] Block ${blockNum} | Inserted ${events.length} events`,
        );
      }
    },
  });
}
