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

import {
  drizzle,
  drizzleStorage,
  useDrizzleStorage,
} from "@apibara/plugin-drizzle";
import { getSelector, StarknetStream } from "@apibara/starknet";
import { defineIndexer } from "apibara/indexer";

import { syDeposit, syOracleRateUpdated, syRedeem } from "@/schema";

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
  syDepositSchema,
  syOracleRateUpdatedSchema,
  syRedeemSchema,
  validateEvent,
} from "../lib/validation";

import type { ApibaraRuntimeConfig } from "apibara/types";

const log = createIndexerLogger("sy");

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

  logIndexerStart(log, {
    streamUrl,
    startingBlock: config.startingBlock,
    knownContracts: config.knownSYContracts.length,
  });

  // Build initial filter with factory event + known SY contracts
  // This ensures the indexer works correctly after restarts when the checkpoint
  // is past the block where YieldContractsCreated was emitted
  const knownSYFilters = config.knownSYContracts.flatMap(
    (syAddress: `0x${string}`) => [
      { address: syAddress, keys: [DEPOSIT] },
      { address: syAddress, keys: [REDEEM] },
      { address: syAddress, keys: [ORACLE_RATE_UPDATED] },
    ],
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
        const syAddress = event.keys[1]!;

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
      const blockNum = Number(block.header.blockNumber);
      logBlockProgress(log, blockNum, endCursor?.orderKey);

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

      // Track errors for this block
      let errorCount = 0;

      for (let i = 0; i < events.length; i++) {
        const event = events.at(i)!;
        const transactionHash = event.transactionHash;
        const eventKey = event.keys[0];
        const syAddress = event.address;
        // Use event.eventIndex from Apibara, fallback to array position
        const eventIndex = event.eventIndex ?? i;

        try {
          if (matchSelector(eventKey, DEPOSIT)) {
            // Validate event structure
            const validated = validateEvent(syDepositSchema, event, {
              indexer: "sy",
              eventName: "Deposit",
              blockNumber,
              transactionHash,
            });
            if (!validated) {
              errorCount++;
              continue;
            }

            const caller = validated.keys[1] ?? "";
            const receiver = validated.keys[2] ?? "";
            const underlying = validated.keys[3] ?? "";

            const data = validated.data;
            const amountDeposited = readU256(data, 0, "amount_deposited");
            const amountSyMinted = readU256(data, 2, "amount_sy_minted");
            const exchangeRate = readU256(data, 4, "exchange_rate");
            const totalSupplyAfter = readU256(data, 6, "total_supply_after");

            depositRows.push({
              block_number: blockNumber,
              block_timestamp: blockTimestamp,
              transaction_hash: transactionHash,
              event_index: eventIndex,
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
            // Validate event structure
            const validated = validateEvent(syRedeemSchema, event, {
              indexer: "sy",
              eventName: "Redeem",
              blockNumber,
              transactionHash,
            });
            if (!validated) {
              errorCount++;
              continue;
            }

            const caller = validated.keys[1] ?? "";
            const receiver = validated.keys[2] ?? "";
            const underlying = validated.keys[3] ?? "";

            const data = validated.data;
            const amountSyBurned = readU256(data, 0, "amount_sy_burned");
            const amountRedeemed = readU256(data, 2, "amount_redeemed");
            const exchangeRate = readU256(data, 4, "exchange_rate");
            const totalSupplyAfter = readU256(data, 6, "total_supply_after");

            redeemRows.push({
              block_number: blockNumber,
              block_timestamp: blockTimestamp,
              transaction_hash: transactionHash,
              event_index: eventIndex,
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
            // Validate event structure
            const validated = validateEvent(syOracleRateUpdatedSchema, event, {
              indexer: "sy",
              eventName: "OracleRateUpdated",
              blockNumber,
              transactionHash,
            });
            if (!validated) {
              errorCount++;
              continue;
            }

            const sy = validated.keys[1] ?? syAddress;
            const underlying = validated.keys[2] ?? "";

            const data = validated.data;
            const oldRate = readU256(data, 0, "old_rate");
            const newRate = readU256(data, 2, "new_rate");
            const rateChangeBps = readU256(data, 4, "rate_change_bps");

            oracleRateRows.push({
              block_number: blockNumber,
              block_timestamp: blockTimestamp,
              transaction_hash: transactionHash,
              event_index: eventIndex,
              sy,
              underlying,
              old_rate: oldRate,
              new_rate: newRate,
              rate_change_bps: rateChangeBps,
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
            "Event processing failed",
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
          "Block completed with errors",
        );
      }

      // Batch insert with transaction wrapping and conflict handling for idempotency
      await measureDbLatency("sy", async () => {
        await db.transaction(async (tx) => {
          if (depositRows.length > 0) {
            await tx
              .insert(syDeposit)
              .values(depositRows)
              .onConflictDoNothing();
          }
          if (redeemRows.length > 0) {
            await tx.insert(syRedeem).values(redeemRows).onConflictDoNothing();
          }
          if (oracleRateRows.length > 0) {
            await tx
              .insert(syOracleRateUpdated)
              .values(oracleRateRows)
              .onConflictDoNothing();
          }
        });
      });

      // Record metrics
      const successCount =
        depositRows.length + redeemRows.length + oracleRateRows.length;
      recordEvents("sy", successCount, errorCount);
      recordBlock("sy", blockNumber);

      logBatchInsert(log, blockNum, events.length);
    },
  });
}
