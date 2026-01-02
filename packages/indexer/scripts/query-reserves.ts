import postgres from "postgres";

import { createScriptLogger } from "../src/lib/logger";

const log = createScriptLogger("query-reserves");

async function main() {
  const databaseUrl = process.env["DATABASE_URL"];
  if (!databaseUrl) {
    log.fatal("DATABASE_URL environment variable is required");
    process.exit(1);
  }

  const sql = postgres(databaseUrl);

  const swaps = await sql`
    SELECT sy_reserve_after, pt_reserve_after, block_number, transaction_hash
    FROM market_swap
    ORDER BY block_number DESC
    LIMIT 5
  `;
  log.info({ count: swaps.length }, "Latest market_swap reserves");
  for (const s of swaps) {
    log.info(
      {
        syReserve: s["sy_reserve_after"],
        syDigits: String(s["sy_reserve_after"]).length,
        ptReserve: s["pt_reserve_after"],
        ptDigits: String(s["pt_reserve_after"]).length,
        block: s["block_number"],
      },
      "Swap reserve"
    );
  }

  const rates = await sql`
    SELECT sy_reserve, pt_reserve, block_number
    FROM market_implied_rate_updated
    ORDER BY block_number DESC
    LIMIT 5
  `;
  log.info(
    { count: rates.length },
    "Latest market_implied_rate_updated reserves"
  );
  for (const r of rates) {
    log.info(
      {
        syReserve: r["sy_reserve"],
        syDigits: String(r["sy_reserve"]).length,
        ptReserve: r["pt_reserve"],
        ptDigits: String(r["pt_reserve"]).length,
        block: r["block_number"],
      },
      "Rate reserve"
    );
  }

  const state = await sql`
    SELECT market, sy_reserve, pt_reserve
    FROM market_current_state
  `;
  log.info({ count: state.length }, "market_current_state reserves");
  for (const s of state) {
    log.info(
      {
        market: s["market"],
        syReserve: s["sy_reserve"],
        syDigits: String(s["sy_reserve"]).length,
        ptReserve: s["pt_reserve"],
        ptDigits: String(s["pt_reserve"]).length,
      },
      "Market state"
    );
  }

  await sql.end();
}
main().catch((e) => {
  log.fatal({ error: e }, "Script failed");
  process.exit(1);
});
