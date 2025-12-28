/**
 * YT (Yield Token) Indexer
 *
 * Uses factory pattern to discover YT contracts from Factory.YieldContractsCreated events.
 *
 * Indexes events from YT contracts:
 * - MintPY: Minting PT/YT from SY
 * - RedeemPY: Redeeming PT/YT to SY before expiry
 * - RedeemPYPostExpiry: Redeeming PT to SY after expiry
 * - InterestClaimed: User claims accrued interest
 * - ExpiryReached: Market has reached expiry
 */

import {
  drizzle,
  drizzleStorage,
  useDrizzleStorage,
} from "@apibara/plugin-drizzle";
import { getSelector, StarknetStream } from "@apibara/starknet";
import { defineIndexer } from "apibara/indexer";

import {
  ytExpiryReached,
  ytInterestClaimed,
  ytMintPY,
  ytRedeemPY,
  ytRedeemPYPostExpiry,
} from "@/schema";

import { getNetworkConfig } from "../lib/constants";
import { getDrizzleOptions } from "../lib/database";
import { isProgrammerError } from "../lib/errors";
import {
  createIndexerLogger,
  logBatchInsert,
  logBlockProgress,
  logContractDiscovery,
  logIndexerStart,
} from "../lib/logger";
import { measureDbLatency, recordBlock, recordEvents } from "../lib/metrics";
import { streamTimeoutPlugin } from "../lib/plugins";
import { matchSelector, readU256 } from "../lib/utils";
import {
  validateEvent,
  ytExpiryReachedSchema,
  ytInterestClaimedSchema,
  ytMintPYSchema,
  ytRedeemPYPostExpirySchema,
  ytRedeemPYSchema,
} from "../lib/validation";

import type { ApibaraRuntimeConfig } from "apibara/types";

const log = createIndexerLogger("yt");

// Factory event to discover YT contracts
const YIELD_CONTRACTS_CREATED = getSelector("YieldContractsCreated");

// YT events
const MINT_PY = getSelector("MintPY");
const REDEEM_PY = getSelector("RedeemPY");
const REDEEM_PY_POST_EXPIRY = getSelector("RedeemPYPostExpiry");
const INTEREST_CLAIMED = getSelector("InterestClaimed");
const EXPIRY_REACHED = getSelector("ExpiryReached");

export default function ytIndexer(runtimeConfig: ApibaraRuntimeConfig) {
  const config = getNetworkConfig(runtimeConfig.network);
  const streamUrl =
    runtimeConfig.starknet?.streamUrl ?? "http://localhost:7171";

  const database = drizzle(
    getDrizzleOptions({
      ytMintPY,
      ytRedeemPY,
      ytRedeemPYPostExpiry,
      ytInterestClaimed,
      ytExpiryReached,
    }),
  );

  logIndexerStart(log, {
    streamUrl,
    startingBlock: config.startingBlock,
    knownContracts: config.knownYTContracts.length,
  });

  // Build initial filter with factory event + known YT contracts
  // This ensures the indexer works correctly after restarts when the checkpoint
  // is past the block where YieldContractsCreated was emitted
  const knownYTFilters = config.knownYTContracts.flatMap(
    (ytAddress: `0x${string}`) => [
      { address: ytAddress, keys: [MINT_PY] },
      { address: ytAddress, keys: [REDEEM_PY] },
      { address: ytAddress, keys: [REDEEM_PY_POST_EXPIRY] },
      { address: ytAddress, keys: [INTEREST_CLAIMED] },
      { address: ytAddress, keys: [EXPIRY_REACHED] },
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
        indexerName: "yt",
        migrate: { migrationsFolder: "./drizzle" },
      }),
    ],
    // Initial filter: listen to Factory for new YT contracts + known YT contracts
    filter: {
      header: "always",
      events: [
        { address: config.factory, keys: [YIELD_CONTRACTS_CREATED] },
        ...knownYTFilters,
      ],
    },
    // Factory function: dynamically add filters for discovered YT contracts
    async factory({ block: { events } }) {
      const newFilters = (events ?? []).flatMap((event) => {
        if (!matchSelector(event.keys[0], YIELD_CONTRACTS_CREATED)) return [];

        // YieldContractsCreated: keys = [selector, sy, expiry], data = [pt, yt, creator]
        const ytAddress = event.data[1]!;

        logContractDiscovery(log, "YT", ytAddress);

        return [
          { address: ytAddress, keys: [MINT_PY] },
          { address: ytAddress, keys: [REDEEM_PY] },
          { address: ytAddress, keys: [REDEEM_PY_POST_EXPIRY] },
          { address: ytAddress, keys: [INTEREST_CLAIMED] },
          { address: ytAddress, keys: [EXPIRY_REACHED] },
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
      type MintPYRow = typeof ytMintPY.$inferInsert;
      type RedeemPYRow = typeof ytRedeemPY.$inferInsert;
      type RedeemPostExpiryRow = typeof ytRedeemPYPostExpiry.$inferInsert;
      type InterestClaimedRow = typeof ytInterestClaimed.$inferInsert;
      type ExpiryReachedRow = typeof ytExpiryReached.$inferInsert;

      const mintPYRows: MintPYRow[] = [];
      const redeemPYRows: RedeemPYRow[] = [];
      const redeemPostExpiryRows: RedeemPostExpiryRow[] = [];
      const interestClaimedRows: InterestClaimedRow[] = [];
      const expiryReachedRows: ExpiryReachedRow[] = [];

      // Track errors for this block
      let errorCount = 0;

      for (let i = 0; i < events.length; i++) {
        const event = events.at(i)!;
        const transactionHash = event.transactionHash;
        const eventKey = event.keys[0];
        const ytAddress = event.address;
        // Use event.eventIndex from Apibara, fallback to array position
        const eventIndex = event.eventIndex ?? i;

        try {
          if (matchSelector(eventKey, MINT_PY)) {
            // Validate event structure
            const validated = validateEvent(ytMintPYSchema, event, {
              indexer: "yt",
              eventName: "MintPY",
              blockNumber,
              transactionHash,
            });
            if (!validated) {
              errorCount++;
              continue;
            }

            const caller = validated.keys[1] ?? "";
            const receiver = validated.keys[2] ?? "";
            const expiry = Number(BigInt(validated.keys[3] ?? "0"));

            const data = validated.data;
            const amountSyDeposited = readU256(data, 0, "amount_sy_deposited");
            const amountPyMinted = readU256(data, 2, "amount_py_minted");
            const pt = data[4] ?? "";
            const sy = data[5] ?? "";
            const pyIndex = readU256(data, 6, "py_index");
            const exchangeRate = readU256(data, 8, "exchange_rate");
            const totalPtSupply = readU256(data, 10, "total_pt_supply");
            const totalYtSupply = readU256(data, 12, "total_yt_supply");

            mintPYRows.push({
              block_number: blockNumber,
              block_timestamp: blockTimestamp,
              transaction_hash: transactionHash,
              event_index: eventIndex,
              caller,
              receiver,
              expiry,
              yt: ytAddress,
              sy,
              pt,
              amount_sy_deposited: amountSyDeposited,
              amount_py_minted: amountPyMinted,
              py_index: pyIndex,
              exchange_rate: exchangeRate,
              total_pt_supply_after: totalPtSupply,
              total_yt_supply_after: totalYtSupply,
            });
          } else if (matchSelector(eventKey, REDEEM_PY)) {
            // Validate event structure
            const validated = validateEvent(ytRedeemPYSchema, event, {
              indexer: "yt",
              eventName: "RedeemPY",
              blockNumber,
              transactionHash,
            });
            if (!validated) {
              errorCount++;
              continue;
            }

            const caller = validated.keys[1] ?? "";
            const receiver = validated.keys[2] ?? "";
            const expiry = Number(BigInt(validated.keys[3] ?? "0"));

            const data = validated.data;
            const sy = data[0] ?? "";
            const pt = data[1] ?? "";
            const amountPyRedeemed = readU256(data, 2, "amount_py_redeemed");
            const amountSyReturned = readU256(data, 4, "amount_sy_returned");
            const pyIndex = readU256(data, 6, "py_index");
            const exchangeRate = readU256(data, 8, "exchange_rate");

            redeemPYRows.push({
              block_number: blockNumber,
              block_timestamp: blockTimestamp,
              transaction_hash: transactionHash,
              event_index: eventIndex,
              caller,
              receiver,
              expiry,
              yt: ytAddress,
              sy,
              pt,
              amount_py_redeemed: amountPyRedeemed,
              amount_sy_returned: amountSyReturned,
              py_index: pyIndex,
              exchange_rate: exchangeRate,
            });
          } else if (matchSelector(eventKey, REDEEM_PY_POST_EXPIRY)) {
            // Validate event structure
            const validated = validateEvent(ytRedeemPYPostExpirySchema, event, {
              indexer: "yt",
              eventName: "RedeemPYPostExpiry",
              blockNumber,
              transactionHash,
            });
            if (!validated) {
              errorCount++;
              continue;
            }

            const caller = validated.keys[1] ?? "";
            const receiver = validated.keys[2] ?? "";
            const expiry = Number(BigInt(validated.keys[3] ?? "0"));

            const data = validated.data;
            const amountPtRedeemed = readU256(data, 0, "amount_pt_redeemed");
            const amountSyReturned = readU256(data, 2, "amount_sy_returned");
            const pt = data[4] ?? "";
            const sy = data[5] ?? "";
            const finalPyIndex = readU256(data, 6, "final_py_index");
            const finalExchangeRate = readU256(data, 8, "final_exchange_rate");

            redeemPostExpiryRows.push({
              block_number: blockNumber,
              block_timestamp: blockTimestamp,
              transaction_hash: transactionHash,
              event_index: eventIndex,
              caller,
              receiver,
              expiry,
              yt: ytAddress,
              sy,
              pt,
              amount_pt_redeemed: amountPtRedeemed,
              amount_sy_returned: amountSyReturned,
              final_py_index: finalPyIndex,
              final_exchange_rate: finalExchangeRate,
            });
          } else if (matchSelector(eventKey, INTEREST_CLAIMED)) {
            // Validate event structure
            const validated = validateEvent(ytInterestClaimedSchema, event, {
              indexer: "yt",
              eventName: "InterestClaimed",
              blockNumber,
              transactionHash,
            });
            if (!validated) {
              errorCount++;
              continue;
            }

            const user = validated.keys[1] ?? "";
            const yt = validated.keys[2] ?? ytAddress;
            const expiry = Number(BigInt(validated.keys[3] ?? "0"));

            const data = validated.data;
            const amountSy = readU256(data, 0, "amount_sy");
            const sy = data[2] ?? "";
            const ytBalance = readU256(data, 3, "yt_balance");
            const pyIndexAtClaim = readU256(data, 5, "py_index_at_claim");
            const exchangeRate = readU256(data, 7, "exchange_rate");

            interestClaimedRows.push({
              block_number: blockNumber,
              block_timestamp: blockTimestamp,
              transaction_hash: transactionHash,
              event_index: eventIndex,
              user,
              yt,
              expiry,
              sy,
              amount_sy: amountSy,
              yt_balance: ytBalance,
              py_index_at_claim: pyIndexAtClaim,
              exchange_rate: exchangeRate,
            });
          } else if (matchSelector(eventKey, EXPIRY_REACHED)) {
            // Validate event structure
            const validated = validateEvent(ytExpiryReachedSchema, event, {
              indexer: "yt",
              eventName: "ExpiryReached",
              blockNumber,
              transactionHash,
            });
            if (!validated) {
              errorCount++;
              continue;
            }

            const market = validated.keys[1] ?? "";
            const yt = validated.keys[2] ?? ytAddress;
            const pt = validated.keys[3] ?? "";

            const data = validated.data;
            const sy = data[0] ?? "";
            const expiry = Number(BigInt(data[1] ?? "0"));
            const finalExchangeRate = readU256(data, 2, "final_exchange_rate");
            const finalPyIndex = readU256(data, 4, "final_py_index");
            const totalPtSupply = readU256(data, 6, "total_pt_supply");
            const totalYtSupply = readU256(data, 8, "total_yt_supply");
            const syReserve = readU256(data, 10, "sy_reserve");
            const ptReserve = readU256(data, 12, "pt_reserve");

            expiryReachedRows.push({
              block_number: blockNumber,
              block_timestamp: blockTimestamp,
              transaction_hash: transactionHash,
              event_index: eventIndex,
              market,
              yt,
              pt,
              sy,
              expiry,
              final_exchange_rate: finalExchangeRate,
              final_py_index: finalPyIndex,
              total_pt_supply: totalPtSupply,
              total_yt_supply: totalYtSupply,
              sy_reserve: syReserve,
              pt_reserve: ptReserve,
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
      await measureDbLatency("yt", async () => {
        await db.transaction(async (tx) => {
          if (mintPYRows.length > 0) {
            await tx.insert(ytMintPY).values(mintPYRows).onConflictDoNothing();
          }
          if (redeemPYRows.length > 0) {
            await tx
              .insert(ytRedeemPY)
              .values(redeemPYRows)
              .onConflictDoNothing();
          }
          if (redeemPostExpiryRows.length > 0) {
            await tx
              .insert(ytRedeemPYPostExpiry)
              .values(redeemPostExpiryRows)
              .onConflictDoNothing();
          }
          if (interestClaimedRows.length > 0) {
            await tx
              .insert(ytInterestClaimed)
              .values(interestClaimedRows)
              .onConflictDoNothing();
          }
          if (expiryReachedRows.length > 0) {
            await tx
              .insert(ytExpiryReached)
              .values(expiryReachedRows)
              .onConflictDoNothing();
          }
        });
      });

      // Record metrics
      const successCount =
        mintPYRows.length +
        redeemPYRows.length +
        redeemPostExpiryRows.length +
        interestClaimedRows.length +
        expiryReachedRows.length;
      recordEvents("yt", successCount, errorCount);
      recordBlock("yt", blockNumber);

      logBatchInsert(log, blockNum, events.length);
    },
  });
}
