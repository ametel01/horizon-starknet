#!/usr/bin/env bun
/**
 * Query unique protocol users and their transaction hashes
 *
 * Queries all user interactions across protocol contracts and outputs
 * unique addresses with their actions and transaction hashes.
 *
 * Usage:
 *   bun run scripts/query-users.ts                    # All users (aggregated)
 *   bun run scripts/query-users.ts <address>          # Filter by specific address (detailed)
 *
 * Requires DATABASE_URL in .env.local
 * Outputs to: scripts/output/users.json
 */

import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import postgres from 'postgres';

const OUTPUT_DIR = join(__dirname, 'output');
const OUTPUT_FILE = join(OUTPUT_DIR, 'users.json');

const DATABASE_URL = process.env['DATABASE_URL'];
const ADDRESS_FILTER = process.argv[2]; // Optional address argument

if (!DATABASE_URL) {
  console.error('DATABASE_URL not configured in .env.local');
  process.exit(1);
}

async function queryAllUsers(sql: postgres.Sql) {
  return sql`
    WITH all_interactions AS (
      SELECT caller AS user_address, transaction_hash, 'sy_deposit' AS action FROM sy_deposit
      UNION ALL
      SELECT caller, transaction_hash, 'sy_redeem' FROM sy_redeem
      UNION ALL
      SELECT caller, transaction_hash, 'yt_mint_py' FROM yt_mint_py
      UNION ALL
      SELECT caller, transaction_hash, 'yt_redeem_py' FROM yt_redeem_py
      UNION ALL
      SELECT caller, transaction_hash, 'yt_redeem_py_post_expiry' FROM yt_redeem_py_post_expiry
      UNION ALL
      SELECT "user" AS user_address, transaction_hash, 'yt_interest_claimed' FROM yt_interest_claimed
      UNION ALL
      SELECT sender, transaction_hash, 'market_mint' FROM market_mint
      UNION ALL
      SELECT sender, transaction_hash, 'market_burn' FROM market_burn
      UNION ALL
      SELECT sender, transaction_hash, 'market_swap' FROM market_swap
      UNION ALL
      SELECT sender, transaction_hash, 'router_mint_py' FROM router_mint_py
      UNION ALL
      SELECT sender, transaction_hash, 'router_redeem_py' FROM router_redeem_py
      UNION ALL
      SELECT sender, transaction_hash, 'router_add_liquidity' FROM router_add_liquidity
      UNION ALL
      SELECT sender, transaction_hash, 'router_remove_liquidity' FROM router_remove_liquidity
      UNION ALL
      SELECT sender, transaction_hash, 'router_swap' FROM router_swap
      UNION ALL
      SELECT sender, transaction_hash, 'router_swap_yt' FROM router_swap_yt
    )
    SELECT
      user_address,
      array_agg(DISTINCT transaction_hash) AS tx_hashes,
      array_agg(DISTINCT action) AS actions,
      COUNT(DISTINCT transaction_hash) AS tx_count
    FROM all_interactions
    GROUP BY user_address
    ORDER BY tx_count DESC
  `;
}

async function queryUserActions(sql: postgres.Sql, address: string) {
  return sql`
    WITH all_interactions AS (
      SELECT caller AS user_address, transaction_hash, block_number, 'sy_deposit' AS action FROM sy_deposit
      UNION ALL
      SELECT caller, transaction_hash, block_number, 'sy_redeem' FROM sy_redeem
      UNION ALL
      SELECT caller, transaction_hash, block_number, 'yt_mint_py' FROM yt_mint_py
      UNION ALL
      SELECT caller, transaction_hash, block_number, 'yt_redeem_py' FROM yt_redeem_py
      UNION ALL
      SELECT caller, transaction_hash, block_number, 'yt_redeem_py_post_expiry' FROM yt_redeem_py_post_expiry
      UNION ALL
      SELECT "user" AS user_address, transaction_hash, block_number, 'yt_interest_claimed' FROM yt_interest_claimed
      UNION ALL
      SELECT sender, transaction_hash, block_number, 'market_mint' FROM market_mint
      UNION ALL
      SELECT sender, transaction_hash, block_number, 'market_burn' FROM market_burn
      UNION ALL
      SELECT sender, transaction_hash, block_number, 'market_swap' FROM market_swap
      UNION ALL
      SELECT sender, transaction_hash, block_number, 'router_mint_py' FROM router_mint_py
      UNION ALL
      SELECT sender, transaction_hash, block_number, 'router_redeem_py' FROM router_redeem_py
      UNION ALL
      SELECT sender, transaction_hash, block_number, 'router_add_liquidity' FROM router_add_liquidity
      UNION ALL
      SELECT sender, transaction_hash, block_number, 'router_remove_liquidity' FROM router_remove_liquidity
      UNION ALL
      SELECT sender, transaction_hash, block_number, 'router_swap' FROM router_swap
      UNION ALL
      SELECT sender, transaction_hash, block_number, 'router_swap_yt' FROM router_swap_yt
    )
    SELECT
      user_address,
      transaction_hash,
      block_number,
      action
    FROM all_interactions
    WHERE user_address = ${address}
    ORDER BY block_number ASC
  `;
}

async function main(): Promise<void> {
  const sql = postgres(DATABASE_URL!);

  try {
    let output;

    if (ADDRESS_FILTER) {
      console.log(`Filtering for address: ${ADDRESS_FILTER}\n`);
      const result = await queryUserActions(sql, ADDRESS_FILTER);
      output = { address: ADDRESS_FILTER, total_actions: result.length, actions: result };
    } else {
      const result = await queryAllUsers(sql);
      output = { total_unique_users: result.length, users: result };
    }

    const json = JSON.stringify(output, null, 2);

    // Write to file
    mkdirSync(OUTPUT_DIR, { recursive: true });
    writeFileSync(OUTPUT_FILE, json);

    console.log(json);
    console.log(`\nWritten to: ${OUTPUT_FILE}`);
  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  console.error('Query failed:', error);
  process.exit(1);
});
