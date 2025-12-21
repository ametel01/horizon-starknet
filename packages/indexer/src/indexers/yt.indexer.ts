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
import { StarknetStream } from "@apibara/starknet";
import { defineIndexer } from "apibara/indexer";
import type { ApibaraRuntimeConfig } from "apibara/types";
import { hash } from "starknet";
import { getNetworkConfig } from "../lib/constants";

// Factory event to discover YT contracts
const YIELD_CONTRACTS_CREATED = hash.getSelectorFromName(
  "YieldContractsCreated",
) as `0x${string}`;

// YT events
const MINT_PY = hash.getSelectorFromName("MintPY") as `0x${string}`;
const REDEEM_PY = hash.getSelectorFromName("RedeemPY") as `0x${string}`;
const REDEEM_PY_POST_EXPIRY = hash.getSelectorFromName(
  "RedeemPYPostExpiry",
) as `0x${string}`;
const INTEREST_CLAIMED = hash.getSelectorFromName(
  "InterestClaimed",
) as `0x${string}`;
const EXPIRY_REACHED = hash.getSelectorFromName(
  "ExpiryReached",
) as `0x${string}`;

// Helper to read u256 (2 felts: low, high)
function readU256(data: string[], index: number): string {
  const low = BigInt(data[index] ?? "0");
  const high = BigInt(data[index + 1] ?? "0");
  return ((high << 128n) + low).toString();
}

export default function ytIndexer(runtimeConfig: ApibaraRuntimeConfig) {
  const config = getNetworkConfig(runtimeConfig.network);
  const streamUrl =
    runtimeConfig.starknet?.streamUrl ?? "http://localhost:7171";

  const database = drizzle({
    schema: {
      ytMintPY,
      ytRedeemPY,
      ytRedeemPYPostExpiry,
      ytInterestClaimed,
      ytExpiryReached,
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
        indexerName: "yt",
        migrate: { migrationsFolder: "./drizzle" },
      }),
    ],
    // Initial filter: listen to Factory for new YT contracts
    filter: {
      events: [{ address: config.factory, keys: [YIELD_CONTRACTS_CREATED] }],
    },
    // Factory function: dynamically add filters for discovered YT contracts
    async factory({ block: { events } }) {
      const newFilters = (events ?? []).flatMap((event) => {
        if (event.keys[0] !== YIELD_CONTRACTS_CREATED) return [];

        // YieldContractsCreated: keys = [selector, sy, expiry], data = [pt, yt, creator]
        const ytAddress = event.data[1] as `0x${string}`;

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
    async transform({ block }) {
      const { db } = useDrizzleStorage();
      const { events, header } = block;

      const blockNumber = Number(header.blockNumber);
      const blockTimestamp = header.timestamp;

      for (const event of events) {
        const transactionHash = event.transactionHash;
        const eventKey = event.keys[0];
        const ytAddress = event.address;
        const data = event.data as string[];

        if (eventKey === MINT_PY) {
          // MintPY event
          // Keys: [selector, caller, receiver, expiry]
          // Data: [sy, pt, amount_sy_deposited (u256), amount_py_minted (u256),
          //        py_index (u256), exchange_rate (u256), total_pt_supply (u256), total_yt_supply (u256)]
          const caller = event.keys[1] ?? "";
          const receiver = event.keys[2] ?? "";
          const expiry = Number(BigInt(event.keys[3] ?? "0"));

          const sy = data[0] ?? "";
          const pt = data[1] ?? "";
          const amountSyDeposited = readU256(data, 2);
          const amountPyMinted = readU256(data, 4);
          const pyIndex = readU256(data, 6);
          const exchangeRate = readU256(data, 8);
          const totalPtSupply = readU256(data, 10);
          const totalYtSupply = readU256(data, 12);

          await db.insert(ytMintPY).values({
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
        } else if (eventKey === REDEEM_PY) {
          // RedeemPY event
          // Keys: [selector, caller, receiver, expiry]
          // Data: [sy, pt, amount_py_redeemed (u256), amount_sy_returned (u256),
          //        py_index (u256), exchange_rate (u256)]
          const caller = event.keys[1] ?? "";
          const receiver = event.keys[2] ?? "";
          const expiry = Number(BigInt(event.keys[3] ?? "0"));

          const sy = data[0] ?? "";
          const pt = data[1] ?? "";
          const amountPyRedeemed = readU256(data, 2);
          const amountSyReturned = readU256(data, 4);
          const pyIndex = readU256(data, 6);
          const exchangeRate = readU256(data, 8);

          await db.insert(ytRedeemPY).values({
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
        } else if (eventKey === REDEEM_PY_POST_EXPIRY) {
          // RedeemPYPostExpiry event
          // Keys: [selector, caller, receiver, expiry]
          // Data: [sy, pt, amount_pt_redeemed (u256), amount_sy_returned (u256),
          //        final_py_index (u256), final_exchange_rate (u256)]
          const caller = event.keys[1] ?? "";
          const receiver = event.keys[2] ?? "";
          const expiry = Number(BigInt(event.keys[3] ?? "0"));

          const sy = data[0] ?? "";
          const pt = data[1] ?? "";
          const amountPtRedeemed = readU256(data, 2);
          const amountSyReturned = readU256(data, 4);
          const finalPyIndex = readU256(data, 6);
          const finalExchangeRate = readU256(data, 8);

          await db.insert(ytRedeemPYPostExpiry).values({
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
        } else if (eventKey === INTEREST_CLAIMED) {
          // InterestClaimed event
          // Keys: [selector, user, yt, expiry]
          // Data: [sy, amount_sy (u256), yt_balance (u256), py_index_at_claim (u256), exchange_rate (u256)]
          const user = event.keys[1] ?? "";
          const yt = event.keys[2] ?? ytAddress;
          const expiry = Number(BigInt(event.keys[3] ?? "0"));

          const sy = data[0] ?? "";
          const amountSy = readU256(data, 1);
          const ytBalance = readU256(data, 3);
          const pyIndexAtClaim = readU256(data, 5);
          const exchangeRate = readU256(data, 7);

          await db.insert(ytInterestClaimed).values({
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
        } else if (eventKey === EXPIRY_REACHED) {
          // ExpiryReached event
          // Keys: [selector, market, yt, pt]
          // Data: [sy, expiry, final_exchange_rate (u256), final_py_index (u256),
          //        total_pt_supply (u256), total_yt_supply (u256), sy_reserve (u256), pt_reserve (u256)]
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

          await db.insert(ytExpiryReached).values({
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
    },
  });
}
