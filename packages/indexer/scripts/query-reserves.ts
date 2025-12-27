import postgres from "postgres";

async function main() {
  const sql = postgres(process.env.DATABASE_URL!);

  const swaps = await sql`
    SELECT sy_reserve_after, pt_reserve_after, block_number, transaction_hash
    FROM market_swap
    ORDER BY block_number DESC
    LIMIT 5
  `;
  console.log("Latest market_swap reserves:");
  for (const s of swaps) {
    console.log("  sy_reserve:", s.sy_reserve_after, "(", String(s.sy_reserve_after).length, "digits)");
    console.log("  pt_reserve:", s.pt_reserve_after, "(", String(s.pt_reserve_after).length, "digits)");
    console.log("  block:", s.block_number);
    console.log();
  }

  const rates = await sql`
    SELECT sy_reserve, pt_reserve, block_number
    FROM market_implied_rate_updated
    ORDER BY block_number DESC
    LIMIT 5
  `;
  console.log("Latest market_implied_rate_updated reserves:");
  for (const r of rates) {
    console.log("  sy_reserve:", r.sy_reserve, "(", String(r.sy_reserve).length, "digits)");
    console.log("  pt_reserve:", r.pt_reserve, "(", String(r.pt_reserve).length, "digits)");
    console.log("  block:", r.block_number);
    console.log();
  }

  const state = await sql`
    SELECT market, sy_reserve, pt_reserve
    FROM market_current_state
  `;
  console.log("market_current_state reserves:");
  for (const s of state) {
    console.log("  market:", s.market);
    console.log("  sy_reserve:", s.sy_reserve, "(", String(s.sy_reserve).length, "digits)");
    console.log("  pt_reserve:", s.pt_reserve, "(", String(s.pt_reserve).length, "digits)");
    console.log();
  }

  await sql.end();
}
main().catch(e => { console.error(e); process.exit(1); });
