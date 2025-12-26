# Horizon Protocol Analytics Spec Context (LLM-Ready)

## 0) Scope and Goal

**Goal:** Define a top-tier analytics surface for **Horizon Protocol** (a Pendle-like PT/YT yield tokenization protocol on Starknet) with clear formulas and a data model mapping, using information provided in this conversation.

**Primary audience:** an LLM or engineer implementing:

* indexer + materialized views
* analytics API
* frontend charts (protocol + market + wallet)

**Key positioning:** move beyond generic DeFi KPIs (TVL/volume/fees) into **yield-derivatives-native analytics**: implied vs realized, term structure, convergence to par, execution quality, and wallet P&L.

---

## 1) Protocol Summary (from conversation)

### 1.1 What Horizon is

* A **Pendle-style yield tokenization protocol** on **Starknet**, implemented in **Cairo**.
* Supports **SY/PT/YT** model:

  * **SY**: standardized yield wrapper for underlying yield-bearing asset.
  * **PT**: principal token (converges to 1 SY at maturity).
  * **YT**: yield token (claims yield stream until maturity).
* Market = **PT/SY AMM** with maturity-based curve behavior.

### 1.2 Why analytics must be yield-native

Core user questions are rates/term-structure questions:

* What is the **implied fixed APY** now?
* How does implied yield compare to **realized underlying yield**?
* How do **PT prices converge to par** as maturity approaches?
* How liquid is the market (depth/impact/slippage)?

---

## 2) Current Analytics Page (as observed via pasted text)

### 2.1 Current sections and graphs

**Overview KPIs**

* Total TVL ($6.52M)
* Active markets (1)
* 24h Volume ($16.25)
* 24h Swaps (3)
* 24h Fees (<$0.01)
* Unique Users (3, last 24h)

**TVL**

* TVL chart (time series)
* SY Reserve ($3.25M)
* PT Reserve ($3.27M)
* TVL by Market (pie / breakdown)

  * hrzSTRK 100%

**Volume**

* 7D volume breakdown (SY volume 69%, PT volume 31%)
* Trading Volume chart (time series)
* 24h / 7d / 30d volumes and swaps

**Fees**

* Fee Revenue chart (time series)
* 24h / 7d / 30d fees
* Fee Breakdown by Market
* Recent Fee Collections table (admin withdrawals)

**About Analytics text**

* TVL = sum of SY and PT reserves across markets
* Volume = swap activity including PT/SY trades
* Fee Revenue = protocol fees from swaps; fee collection log is admin withdrawals
* Historical data grows as indexer snapshots accumulate

### 2.2 Redundancy / cleanup recommendation

* Keep TVL/volume/fees (table stakes), but **collapse repeated sections**:

  * TVL appears as KPI + section + chart + breakdown.
  * Volume and Fees similarly repeated.
* Low-signal early-stage KPIs (e.g., “Unique users = 3”) can be hidden behind a toggle until scale.

---

## 3) “Top-tier” analytics additions (recommended)

### 3.1 Yield-native analytics (highest priority)

1. **Implied APY over time (per market)**
2. **Yield curve / term structure view** (implied APY vs time-to-maturity across markets)
3. **PT price and YT price charts** (spot over time; PT convergence intuition)
4. **Time-to-maturity + decay visualization**
5. **Yield accrual / claims flow** (cashflow views for YT holders)

### 3.2 Liquidity & execution quality (advanced but high value)

6. **Slippage / depth curve** (trade size vs price impact)
7. **Price impact distribution** (p50/p95 impact daily)
8. **Spread proxy** (effective vs reference mid)

### 3.3 LP-focused analytics

9. **LP APY decomposition**

* fee APR/APY
* (optional) incentives APR
* exposure to implied rate shifts and underlying exchange rate drift

### 3.4 User & ecosystem analytics

10. **PT holders vs YT holders over time**
11. **User actions breakdown** (mint/split/swap/redeem/claim)
12. **Wallet-level “beat implied” scoreboard** + position P&L timeline

---

## 4) Direct “Pendle v2 gaps” and Horizon differentiation

### 4.1 Key gaps to beat

* **Term structure (yield curve) not first-class** → Horizon adds a curve dashboard and curve-change views.
* **Time-decay intuition under-visualized** → Horizon shows PT pull-to-par and YT decay.
* **Realized vs implied attribution weak** → Horizon provides realized-vs-implied charts and “beat implied” reports.
* **Position P&L timeline often missing/limited** → Horizon provides full timeline views for PT/YT/LP.
* **Execution quality rarely shown** → Horizon provides impact/slippage distributions and depth curves.

### 4.2 “Minimum set” that visibly beats Pendle UX

Ship these 4 charts first:

1. Yield curve (implied APY vs time-to-expiry across markets)
2. PT convergence to par (PT price vs 1.0 line)
3. Implied vs realized underlying APY (and spread)
4. Price impact distribution (Δ ln-rate per swap, impact vs trade size)

---

## 5) Indexer Schema Context (Drizzle ORM)

### 5.1 Indexing architecture

* **One table per event type**, across factory, market factory, SY, YT, market AMM, router.
* Rationale (stated): avoid race conditions, enable independent scaling, reorg handling.

### 5.2 Event tables included in pasted schema excerpt

**Factory**

* `factory_yield_contracts_created` (sy, expiry, pt, yt, underlying metadata)
* `factory_class_hashes_updated`

**Market Factory**

* `market_factory_market_created` (market address, pt, yt, sy, expiry, fee_rate, scalar_root, initial_anchor, underlying)
* `market_factory_class_hash_updated`

**SY**

* `sy_deposit`
* `sy_redeem`
* `sy_oracle_rate_updated`

**YT**

* `yt_mint_py`
* `yt_redeem_py`
* `yt_redeem_py_post_expiry`
* `yt_interest_claimed`
* `yt_expiry_reached`

**Market (AMM)**

* `market_mint`
* `market_burn`
* `market_swap`
* `market_implied_rate_updated`
* `market_fees_collected`

**Router**

* `router_mint_py`
* `router_redeem_py`
* `router_add_liquidity`
* `router_remove_liquidity`
* `router_swap`
* `router_swap_yt`

### 5.3 Enriched router views

* `enriched_router_swap`
* `enriched_router_swap_yt`
* `enriched_router_add_liquidity`
* `enriched_router_remove_liquidity`
* `enriched_router_mint_py`
* `enriched_router_redeem_py`

Purpose: join router actions with underlying market data for frontend analytics.

### 5.4 Aggregated/materialized views (analytics-ready)

* `market_daily_stats`
* `market_hourly_stats`
* `user_positions_summary`
* `user_lp_positions`
* `protocol_daily_stats`
* `market_current_state`
* `user_trading_stats`
* `rate_history`
* `exchange_rate_history`

---

## 6) Market Math Library Context (Pendle-style logit AMM)

### 6.1 State and parameters

`MarketState`:

* `sy_reserve`, `pt_reserve`, `total_lp`
* `scalar_root` (rate sensitivity root)
* `initial_anchor`
* `fee_rate` (WAD)
* `expiry`
* `last_ln_implied_rate` (cached ln-rate for anchor calc)

### 6.2 Time and scaling constants

* `SECONDS_PER_YEAR = 31_536_000`
* `MIN_TIME_TO_EXPIRY = 1`
* rate scalar behavior: increases as expiry approaches:
  `rate_scalar = scalar_root * SECONDS_PER_YEAR / time_to_expiry` (WAD math)

### 6.3 Curve definition (logit)

* Proportion:

  * `p = pt_reserve / (pt_reserve + sy_reserve)` (WAD)
* Logit:

  * `logit(p) = ln(p/(1-p))`
* Exchange rate (as described):

  * `exchange_rate = logit(p_new)/rate_scalar + rate_anchor`
  * exchange rate is floored to `>= 1` (WAD)

### 6.4 Anchor recalculation (continuity)

Anchor chosen to preserve continuity using stored `last_ln_implied_rate` and current proportion:

* target exchange rate computed from `ln_implied_rate` and time-to-expiry
* `rate_anchor = target_exchange_rate - logit(p)/rate_scalar` (with sign handling and floors)

### 6.5 Implied rate and PT price

* Implied APY:

  * `apy = exp(ln_implied_rate) - 1`
* PT price (SY per PT) via time discount:

  * `pt_price = exp(-ln_implied_rate * time_to_expiry / SECONDS_PER_YEAR)`

### 6.6 Fees

Time-adjusted fee decay:

* `fee_adj = fee_rate * min(time_to_expiry, 1y) / 1y`
* Fees go to 0 at expiry.

### 6.7 Swap outputs

* PT→SY (exact PT in):

  * compute exchange rate at new PT reserve
  * `sy_out_before_fee = pt_in / exchange_rate`
  * apply `fee_adj`
* SY→PT (exact SY in):

  * fee first
  * binary search for `pt_out` consistent with curve (exchange rate depends on pt_out)

Binary search tolerance/iters:

* `BINARY_SEARCH_TOLERANCE = 1000`
* `MAX_ITERATIONS = 64`

---

## 7) Analytics Derived Primitives (recommended standardization)

Define a canonical set of computed fields per market per timestamp:

* `t = max(expiry - ts, 1)` seconds
* `ln_r(ts)` = ln implied rate (WAD)
* `apy_implied(ts) = exp(ln_r) - 1` (WAD)
* `pt_price(ts) = exp(-ln_r * t / year)` (WAD, SY per PT)
* `fee_adj(ts) = fee_rate * min(t, 1y) / 1y`

**Strong requirement:** ensure DB fields are unambiguous:

* Prefer storing **`ln_implied_rate_*`** explicitly (not “implied_rate” unless it’s exp’d).
* Avoid mixing ln-rates and rates/APYs under the same name.

---

## 8) Chart Specs (LLM-ready)

### 8.1 Protocol dashboard (high level)

**Inputs:** `protocol_daily_stats`, `market_current_state`

* TVL (sum over markets; if using SY terms, compute `sy + pt*pt_price`)
* Volume (SY volume + PT volume)
* Fees
* Active markets
* Unique users (optional toggle early-stage)

### 8.2 Market-level “Yield Derivatives” panel

**Inputs:** `market_daily_stats`, `rate_history`, `exchange_rate_history`

1. Implied APY time series

   * `apy_implied_close(day) = exp(ln_r_close) - 1`
2. PT price time series + par line

   * `pt_price_close(day) = exp(-ln_r_close * t_close/yr)`
3. Implied vs realized underlying APY

   * realized from `exchange_rate_close/open` (annualized or rolling)
4. Time-to-expiry line / countdown

### 8.3 Yield curve / term structure

**Inputs:** `market_current_state`, `market_daily_stats`

* snapshot curve: `(t_now/yr, apy_implied_now)` for all markets
* historical curve: same for a chosen day
* curve change: Δ1d/Δ7d per point

### 8.4 Execution-quality panel

**Inputs:** `market_swap` (or `enriched_router_swap`)

* Effective price per swap:

  * `price = sy_in / pt_out` or `sy_out / pt_in`
* Price impact:

  * `Δln_r = ln_r_after - ln_r_before` (convert to bps for display)
* Daily impact quantiles (p50, p95)
* Impact vs trade size scatter

### 8.5 LP returns panel

**Inputs:** `market_daily_stats`, `market_current_state`, `user_lp_positions`

* Fee APR:

  * `fee_apr ≈ total_fees_day / tvl_day * 365`
* Utilization:

  * `(sy_volume + pt_volume) / (sy_reserve + pt_reserve)` (same-unit caveat; better in SY terms)
* LP position timeline + decomposition (fees + rate move + underlying move)

### 8.6 Wallet analytics

**Inputs:** `user_positions_summary`, `yt_interest_claimed`, `user_lp_positions`

* YT cashflow timeline: cumulative claimed SY
* Position exposure: PT vs YT balances
* “Beat implied” scoreboard (requires clean entry ln-rate; recommended to store `avg_entry_ln_implied_rate`)

---

## 9) Recommended Additional Materialized Views

### 9.1 `market_prices_snapshot_daily` (or hourly)

Purpose: centralize pricing/apy computations server-side.

Suggested columns:

* `market, day/hour, expiry`
* `time_to_expiry`
* `ln_implied_rate` (close)
* `apy_implied`
* `pt_price_in_sy`
* `tvl_in_sy = sy_reserve + pt_reserve * pt_price_in_sy`
* `fee_apr`
* `realized_underlying_return` (daily/rolling)
* `impact_p50_bps`, `impact_p95_bps` (from swaps)

### 9.2 `market_execution_stats_daily`

* swap count, median impact, p95 impact, median effective price, etc.

### 9.3 `user_position_timeseries` (optional)

If you want truly top-tier wallet analytics without heavy query cost, build a periodic snapshot per user/market.

---

## 10) Implementation Priorities

### Phase 1 (quick wins; uses existing data)

1. Yield curve (term structure)
2. PT convergence chart
3. Implied vs realized APY
4. Price impact distributions

### Phase 2 (wallet + LP excellence)

5. Wallet P&L timeline (YT cashflows, PT exposure)
6. LP fee APR and decomposition
7. “Beat implied” per wallet/position

### Phase 3 (advanced market microstructure)

8. Slippage/depth curves computed from curve math (or sampled)
9. Spread proxies and liquidity health score

---

## 11) Key Decisions / Constraints Highlighted

* Fees are **time-decayed to 0 at expiry**.
* Curve uses **logit-based** pricing with **rateScalar increasing** as expiry approaches.
* PT price should **converge to 1 SY** at expiry (par).
* Analytics should prioritize yield primitives; generic KPIs should be compacted.
* Avoid field ambiguity: clarify whether stored “implied_rate” is ln-rate, exp’d rate, or APY.

---

## 12) Open Items (for completeness)

Not provided in conversation; needed for perfect P&L in USD:

* USD price feeds / oracle mapping for underlying and SY
* explicit PT/YT spot pricing method for every timestamp (derivable, but best stored)
* fee split model between LPs and protocol (how `market_fees_collected` relates to pool accrual)

---

## 13) Copy-Paste “LLM Instruction Block” (optional)

**Task:** implement Horizon analytics that outclasses Pendle-style dashboards by focusing on yield-derivatives primitives. Use indexed views (`market_daily_stats`, `market_hourly_stats`, `rate_history`, `exchange_rate_history`, swaps) and Pendle-style math (logit curve, ln implied rate, PT discount formula). Prioritize charts: yield curve, PT pull-to-par, implied vs realized APY, execution-quality impact distribution, wallet cashflows and P&L attribution. Ensure all “implied rate” naming is unambiguous (ln-rate vs APY vs exp’d rate).
