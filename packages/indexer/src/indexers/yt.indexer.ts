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
  ytExpiryReached,
  ytInterestClaimed,
  ytMintPY,
  ytRedeemPY,
  ytRedeemPYPostExpiry,
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

// Factory event to discover YT contracts
const YIELD_CONTRACTS_CREATED = getSelector("YieldContractsCreated");

// YT events
const MINT_PY = getSelector("MintPY");
const REDEEM_PY = getSelector("RedeemPY");
const REDEEM_PY_POST_EXPIRY = getSelector("RedeemPYPostExpiry");
const INTEREST_CLAIMED = getSelector("InterestClaimed");
const EXPIRY_REACHED = getSelector("ExpiryReached");

// Helper to read u256 (2 felts: low, high)
function readU256(data: string[], index: number): string {
  const low = BigInt(data[index] ?? "0");
  const high = BigInt(data[index + 1] ?? "0");
  return ((high << 128n) + low).toString();
}

// Helper to compare selectors numerically (handles padding differences)
// DNA stream may return "0x0e316f..." while getSelector returns "0x00e316f..."
function matchSelector(a: string | undefined, b: string): boolean {
  if (!a) return false;
  try {
    return BigInt(a) === BigInt(b);
  } catch {
    return false;
  }
}

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

  console.log(
    `[yt] Starting indexer with streamUrl: ${streamUrl}, startingBlock: ${config.startingBlock}`,
  );

  // Build initial filter with factory event + known YT contracts
  // This ensures the indexer works correctly after restarts when the checkpoint
  // is past the block where YieldContractsCreated was emitted
  const knownYTFilters = config.knownYTContracts.flatMap((ytAddress) => [
    { address: ytAddress, keys: [MINT_PY] },
    { address: ytAddress, keys: [REDEEM_PY] },
    { address: ytAddress, keys: [REDEEM_PY_POST_EXPIRY] },
    { address: ytAddress, keys: [INTEREST_CLAIMED] },
    { address: ytAddress, keys: [EXPIRY_REACHED] },
  ]);

  console.log(
    `[yt] Including ${config.knownYTContracts.length} known YT contracts in initial filter`,
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
        const ytAddress = event.data[1] as `0x${string}`;

        console.log(`[yt] Discovered new YT contract: ${ytAddress}`);

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
      // Log progress every 1000 blocks (reduced frequency for performance)
      const blockNum = Number(block.header.blockNumber);
      if (blockNum % 1000 === 0) {
        console.log(`[yt] Block ${blockNum} | Cursor: ${endCursor?.orderKey}`);
      }

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

      for (const event of events) {
        const transactionHash = event.transactionHash;
        const eventKey = event.keys[0];
        const ytAddress = event.address;
        const data = event.data as string[];

        if (matchSelector(eventKey, MINT_PY)) {
          const caller = event.keys[1] ?? "";
          const receiver = event.keys[2] ?? "";
          const expiry = Number(BigInt(event.keys[3] ?? "0"));

          const amountSyDeposited = readU256(data, 0);
          const amountPyMinted = readU256(data, 2);
          const pt = data[4] ?? "";
          const sy = data[5] ?? "";
          const pyIndex = readU256(data, 6);
          const exchangeRate = readU256(data, 8);
          const totalPtSupply = readU256(data, 10);
          const totalYtSupply = readU256(data, 12);

          mintPYRows.push({
            block_number: blockNumber,
            block_timestamp: blockTimestamp,
            transaction_hash: transactionHash,
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
          const caller = event.keys[1] ?? "";
          const receiver = event.keys[2] ?? "";
          const expiry = Number(BigInt(event.keys[3] ?? "0"));

          const sy = data[0] ?? "";
          const pt = data[1] ?? "";
          const amountPyRedeemed = readU256(data, 2);
          const amountSyReturned = readU256(data, 4);
          const pyIndex = readU256(data, 6);
          const exchangeRate = readU256(data, 8);

          redeemPYRows.push({
            block_number: blockNumber,
            block_timestamp: blockTimestamp,
            transaction_hash: transactionHash,
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
          const caller = event.keys[1] ?? "";
          const receiver = event.keys[2] ?? "";
          const expiry = Number(BigInt(event.keys[3] ?? "0"));

          const amountPtRedeemed = readU256(data, 0);
          const amountSyReturned = readU256(data, 2);
          const pt = data[4] ?? "";
          const sy = data[5] ?? "";
          const finalPyIndex = readU256(data, 6);
          const finalExchangeRate = readU256(data, 8);

          redeemPostExpiryRows.push({
            block_number: blockNumber,
            block_timestamp: blockTimestamp,
            transaction_hash: transactionHash,
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
          const user = event.keys[1] ?? "";
          const yt = event.keys[2] ?? ytAddress;
          const expiry = Number(BigInt(event.keys[3] ?? "0"));

          const amountSy = readU256(data, 0);
          const sy = data[2] ?? "";
          const ytBalance = readU256(data, 3);
          const pyIndexAtClaim = readU256(data, 5);
          const exchangeRate = readU256(data, 7);

          interestClaimedRows.push({
            block_number: blockNumber,
            block_timestamp: blockTimestamp,
            transaction_hash: transactionHash,
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
          const market = event.keys[1] ?? "";
          const yt = event.keys[2] ?? ytAddress;
          const pt = event.keys[3] ?? "";

          const sy = data[0] ?? "";
          const expiry = Number(BigInt(data[1] ?? "0"));
          const finalExchangeRate = readU256(data, 2);
          const finalPyIndex = readU256(data, 4);
          const totalPtSupply = readU256(data, 6);
          const totalYtSupply = readU256(data, 8);
          const syReserve = readU256(data, 10);
          const ptReserve = readU256(data, 12);

          expiryReachedRows.push({
            block_number: blockNumber,
            block_timestamp: blockTimestamp,
            transaction_hash: transactionHash,
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
      }

      // Batch insert all events (parallel inserts for different tables)
      const insertPromises: Promise<unknown>[] = [];
      if (mintPYRows.length > 0)
        insertPromises.push(db.insert(ytMintPY).values(mintPYRows));
      if (redeemPYRows.length > 0)
        insertPromises.push(db.insert(ytRedeemPY).values(redeemPYRows));
      if (redeemPostExpiryRows.length > 0)
        insertPromises.push(
          db.insert(ytRedeemPYPostExpiry).values(redeemPostExpiryRows),
        );
      if (interestClaimedRows.length > 0)
        insertPromises.push(
          db.insert(ytInterestClaimed).values(interestClaimedRows),
        );
      if (expiryReachedRows.length > 0)
        insertPromises.push(
          db.insert(ytExpiryReached).values(expiryReachedRows),
        );

      if (insertPromises.length > 0) {
        await Promise.all(insertPromises);
        console.log(
          `[yt] Block ${blockNum} | Inserted ${events.length} events`,
        );
      }
    },
  });
}
