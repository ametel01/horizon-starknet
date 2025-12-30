```yaml
protocol: Horizon (Starknet)
artifact: "Research Artifact (code + interviews)"
last_updated: "2025-12-29"
design_philosophy:
  - correctness_over_features: "v1 minimal; expand later"
  - pendle_compatibility: "Pendle mental model, Cairo/Starknet adaptation"
  - composability: "PT/YT/Market non-upgradeable for safe integrations"
  - conservative_parameters: "3–6 month expiries; fixed defaults; iterate from learnings"

executive_summary:
  description: "Pendle-style yield tokenization on Starknet (PT/YT) + PT/SY AMM with logit curve"
  primitives: ["SY", "PT", "YT", "Market", "Router", "Factory", "MarketFactory", "IndexOracle(s)", "Indexer", "Frontend"]

core_tokens:
  SY (Standardized Yield):
    source: "contracts/src/tokens/sy.cairo"
    meaning: "1 SY = 1 share of underlying vault (shares, not assets)"
    deposit_redeem_unit: "shares (1:1 with underlying shares)"
    exchange_rate:
      purpose: "convert shares -> assets valuation / index for yield accrual"
      modes:
        - erc4626_mode:
            switch: "is_erc4626 flag"
            read: "vault.convert_to_assets(WAD)"
        - oracle_mode:
            read: "IIndexOracle.index()"
    events:
      - OracleRateUpdated: "emitted on exchange-rate change; tracked in bps"
    access_control:
      - PAUSER_ROLE: "pause deposits"
      - owner: "upgrade SY"
    invariant:
      - "SY balance tracks underlying shares 1:1; exchange rate reflects underlying vault/index only"

  PT (Principal Token):
    source: "contracts/src/tokens/pt.cairo"
    semantics: "principal claim; redeemable 1:1 for SY at/after expiry"
    mint_burn_authz: "only YT can mint/burn (assert_only_yt)"
    deployment_pattern:
      - "PT deployed by YT"
      - "YT calls initialize_yt() to set circular reference"
      - anti_frontrun: "only deployer (YT) can initialize_yt(); deployer stored"
    expiry:
      - is_expired: "block_timestamp >= expiry"

  YT (Yield Token):
    source: "contracts/src/tokens/yt.cairo"
    semantics: "yield rights until expiry; captures underlying rate appreciation"
    interest_model: "PY Index watermark (monotonic index) with per-user accrual"
    formula:
      interest: "yt_balance * (current_index - user_index) / user_index"
    storage:
      - py_index_stored: "global watermark; only increases"
      - user_py_index: "per-user last index"
      - user_interest: "per-user accrued (unclaimed)"
    transfer_hooks:
      - "_update_user_interest(sender)"
      - "_update_user_interest(recipient)"
      - "called before transfers to keep accrual consistent"
    PT_deployment: "YT constructor deploys PT via deploy_syscall (PT class hash)"
    redemption_modes:
      pre_expiry: "mint_py / redeem_py require PT + YT (paired)"
      post_expiry: "redeem_py_post_expiry requires PT only; YT worthless"
    economics_note:
      - "interest formula intentionally rewards earlier YT holders (lower entry index => higher proportional accrual)"

factory_system:
  Factory (Yield contracts deployment):
    source: "contracts/src/factory.cairo"
    creates: "YT (which deploys PT) for (SY, expiry)"
    flow:
      - "create_yield_contracts(sy, expiry)"
      - validate:
          - "sy != 0"
          - "expiry in future"
          - "no existing (sy, expiry) pair"
      - deploy:
          - "deploy YT with salt=deploy_count"
          - "YT deploys PT internally"
      - registries:
          - "pt_registry[(sy, expiry)] = PT"
          - "yt_registry[(sy, expiry)] = YT"
          - "valid_pts[pt]=true"
          - "valid_yts[yt]=true"
    upgradeability: "owner can update yt_class_hash, pt_class_hash (affects new deployments only)"
    salt: "deploy_count increments only on successful deployment (atomicity invariant)"

  MarketFactory (AMM deployment):
    source: "contracts/src/market/market_factory.cairo"
    creates: "one Market per PT"
    flow:
      - "create_market(pt, scalar_root, initial_anchor, fee_rate)"
      - validate_bounds:
          scalar_root: "[1 WAD, 1000 WAD]"
          initial_anchor: "<= 4.6 WAD (ln implied rate cap ~100x)"
          fee_rate: "<= 0.1 WAD (10%)"
      - deploy Market with PT
      - Market reads {SY, YT, expiry} from PT
    uniqueness: "market_registry[pt] enforces 1 market per PT"
    upgradeability: "owner can update market class hash (new markets only)"

amm_market_system:
  Market (PT/SY AMM + LP token):
    sources:
      - amm: "contracts/src/market/amm.cairo"
      - math: "contracts/src/market/market_math.cairo"
    pair: "PT / SY (not PT/underlying)"
    lp_token: "Market contract is ERC20 LP token"
    minimum_liquidity:
      MINIMUM_LIQUIDITY: 1000
      behavior: "first mint locks 1000 LP to dead address (0x1) to prevent inflation attack"
    stored_reserves: "AMM uses stored reserves, not raw token balances (donations don't affect accounting)"

  pricing_curve (Pendle-style logit):
    core:
      exchangeRate: "ln(p/(1-p))/rateScalar + rateAnchor"
      proportion: "pt_reserve / (pt_reserve + sy_reserve)"
      rateScalar: "scalar_root * SECONDS_PER_YEAR / time_to_expiry"
      rateAnchor: "recomputed post-trade to preserve implied-rate continuity"
    time_dynamics:
      - time_decay: "rateScalar increases as expiry nears => curve flattens"
      - convergence: "PT price -> 1 SY as t -> expiry"
      - fee_decay: "effective_fee = fee_rate * time_to_expiry / SECONDS_PER_YEAR (0 at expiry)"
    bounds_constants:
      - SECONDS_PER_YEAR: 31_536_000
      - MIN_PROPORTION: 0.001 WAD
      - MAX_PROPORTION: 0.999 WAD
      - MAX_LN_IMPLIED_RATE: 4.6 WAD
    swap_methods:
      - swap_exact_pt_for_sy: "direct calc"
      - swap_exact_sy_for_pt: "binary search (tol=1000 wei, max_iter=64)"
      - swap_sy_for_exact_pt: "direct calc"
      - swap_pt_for_exact_sy: "binary search (tol=1000 wei, max_iter=64)"
    binary_search_notes:
      - "used for SY->PT exactness and PT->exact SY paths"
      - tolerance: 1000 wei
      - max_iterations: 64
      - large_trade_coverage: "tested up to 90% of reserves"

router_system:
  Router:
    source: "contracts/src/router.cairo"
    role: "single user entry point; composes SY/PT/YT/Market ops"
    protections:
      - ReentrancyGuardComponent: true
      - deadline_param: "all ops require completion before timestamp"
      - PausableComponent: true
    mint_flow (PT+YT from SY):
      entry: "mint_py_from_sy(yt, receiver, amount_sy_in, min_py_out, deadline)"
      steps:
        - "transfer SY from user"
        - "approve YT to spend SY"
        - "YT.mint_py(receiver, amount)"
        - "slippage check: pt_out >= min_py_out and yt_out >= min_py_out"
    YT_trading (flash pattern through PT/SY market):
      swap_exact_sy_for_yt:
        - "user deposits SY"
        - "router mints PT+YT from SY"
        - "router sells PT to market for SY"
        - "user receives YT + recovered SY"
      swap_exact_yt_for_sy:
        - "user provides YT + SY collateral"
        - "router buys PT from market using SY"
        - "router redeems PT+YT for SY"
        - "user receives net SY + refund"

oracle_system:
  current: PragmaIndexOracle:
    source: "contracts/src/oracles/pragma_index_oracle.cairo"
    purpose: "derive exchange-rate index for non-ERC4626 assets from Pragma TWAP(s)"
    modes:
      - single_feed: "denominator_pair_id=0 => direct index from one feed"
      - dual_feed: "index = numerator_price / denominator_price"
    watermark_rule: "stored_index = max(oracle_index, stored_index) (monotonic, only up)"
    config_defaults:
      - twap_window: "1h (min 5m)"
      - max_staleness: "24h"
    emergency:
      - "admin can set index upward only"
  planned: protocol_maintained_chainlink_twap:
    status: "planned migration from Pragma"
    storage: "ring buffer of (timestamp, price), size 32–128"
    update: "poke(asset_id) on state-changing actions (mint/redeem/swap)"
    compute: "TWAP = Σ(price_i*Δt_i)/Σ(Δt_i) walking backward in buffer"
    edge_cases:
      - sparse_obs: "fallback to bounded-age spot with staleness checks"
      - min_obs: "require N observations within window else revert/fallback"
    claimed_benefits:
      - "predictable capped gas"
      - "Chainlink reliability + broader coverage"
      - "protocol-controlled observation frequency"

math_libraries:
  fixed_point:
    source: "contracts/src/libraries/math_fp.cairo"
    scale: "WAD = 1e18"
    constants: {WAD: 1e18, HALF_WAD: 5e17, WAD_E: 2.718281828459045235e18}
    impl: "cairo_fp (64.64) internally; WAD conversions at boundaries"
    funcs: ["wad_mul","wad_div","exp_wad","exp_neg_wad","ln_wad","pow_wad","sqrt_wad"]
  market_constants:
    source: "contracts/src/market/market_math.cairo"
    constants:
      - SECONDS_PER_YEAR: 31_536_000
      - MIN_PROPORTION: 0.001 WAD
      - MAX_PROPORTION: 0.999 WAD
      - MINIMUM_LIQUIDITY: 1000
      - MAX_LN_IMPLIED_RATE: 4.6 WAD

upgradeability_model:
  upgradeable_owner_controlled (affects new deployments or stateless entry):
    - Factory: "set_class_hashes for new PT/YT only"
    - MarketFactory: "set_market_class_hash for new Markets only"
    - Router: "stateless entry point; upgrade doesn't alter existing positions"
    - SY: "long-lived wrapper; upgrade for oracle/asset fixes"
  immutable_non_upgradeable (per-deployment trust anchor):
    - PT: "per-expiry, immutable"
    - YT: "per-expiry, immutable"
    - Market: "per-PT, immutable"
  class_hash_distribution:
    flow:
      - "Factory.set_class_hashes(new_yt, new_pt) -> future PT/YT use new code"
      - "MarketFactory.set_market_class_hash(new) -> future markets use new code"
      - "existing deployments unchanged (no rug on active positions)"

security_invariants:
  core_invariants:
    - "only YT can mint/burn PT (PT.assert_only_yt)"
    - "SY tracks underlying shares 1:1 (not assets)"
    - "PY index watermark monotonic (only increases)"
    - "MINIMUM_LIQUIDITY locked on first LP mint"
    - "MarketFactory bounds scalar_root/anchor/fee_rate"
    - "reentrancy protection: Router + YT use OZ guard"
    - "Factory deploy_count increments only on success"
  first_depositor_attack_defense:
    mechanisms:
      - "MINIMUM_LIQUIDITY lock to dead address"
      - "stored reserves, not balances (donations ineffective)"
      - "WAD normalization reduces rounding surface"
    conclusion: "MINIMUM_LIQUIDITY=1000 sufficient for WAD-scale; victim loss bounded and negligible for reasonable deposits"
  audit_status:
    - external_audit: "not started (internal review only)"
    - alpha_exit_requires: "external audit with no critical findings"
  incident_response:
    status: "not formalized"
    controls:
      - SY: "PAUSER_ROLE pauses deposits only"
      - Router: "pausable"
      - "no automated circuit breakers"
  known_research_items:
    resolved:
      - reentrancy: "resolved; YT has ReentrancyGuard; see SECURITY.md"
      - min_liquidity_analysis: "resolved; tests + economic bounds"
      - fuzz_math: "complete"
      - binary_search_large_trades: "complete"
    open:
      - "MEV/frontrunning analysis for Starknet sequencer"
      - "oracle edge cases tests"
      - "incident response formalization"
      - "LP economics modeling"
      - "external audit"

frontend:
  source: "packages/frontend/CLAUDE.md"
  stack: "Next.js 16 + React 19 + TanStack Query + starknet.js + Tailwind CSS 4 + shadcn/ui"
  architecture: "Feature-Sliced Design (FSD)"
  layout: ["app","widgets","features","entities","shared"]
  data_flow: "user action -> feature hook -> contract call -> wallet sig -> tx -> query invalidation -> UI update"
  linting:
    - "ESLint forbids legacy imports (@/components, @/hooks)"
    - "requires FSD imports (@shared/*, @features/*)"
  ux_policies:
    rate_display: "Pendle-style APY formatting (continuous-rate conversion)"
    near_expiry_warnings:
      thresholds: {info: "7d", warning: "3d", critical: "1d"}
      behavior: "banners shown; trading remains enabled; expired markets disabled via preflight"
    yt_expiry_notifications:
      - "dashboard-only; no email/push"
      - "YieldExpiryAlert + portfolio summary"
      - "critical styling at 1d"
      - "user responsible to claim before expiry; YT worthless at expiry"
    claim_gas_sanity:
      - "no on-chain min claim threshold"
      - "frontend warns if claim value < 2x estimated gas; allows 'Claim Anyway'"
    error_handling:
      - "custom parsing + actionable hints for slippage/deadline/expiry"
      - "preflight disables swap/mint when expired"

indexer:
  path: "packages/indexer/"
  stack: "Bun + Apibara DNA 2.1.0 + Drizzle ORM + PostgreSQL 16"
  indexer_types:
    static_contract_indexers:
      fixed_addresses: true
      modules:
        - factory.indexer.ts
        - market-factory.indexer.ts
        - router.indexer.ts
    factory_pattern_indexers:
      dynamic_discovery: true
      restart_resilience: "knownContracts sets"
      modules:
        - sy.indexer.ts
        - yt.indexer.ts
        - market.indexer.ts
  events_and_storage:
    tables_total: 24
    views_total: 15
    event_tables_naming: "{contract}_{event} (snake_case)"
    schema_conventions:
      - "_id UUID primary key"
      - "_cursor for reorg tracking"
      - "numeric(78) for WAD precision"
  materialized_views:
    refresh: "~30m"
    function: "refresh_all_materialized_views()"
    purpose: "portfolio + analytics; realtime via direct events"
  networks:
    mainnet: {start_block: 4643300, deployment_date: "2025-12-23"}
    sepolia: {start_block: 4194445}
    devnet: {start_block: 0}

operations:
  commands:
    contracts: ["make build","make test","./deploy/scripts/deploy.sh mainnet"]
    frontend: ["bun run dev","bun run codegen"]
    indexer: ["bun run dev:mainnet","bun run db:studio"]
  environments: ["devnet (mock oracle)","fork (mainnet fork, real Pragma TWAP)","sepolia","mainnet"]

tokenomics_governance (planned):
  token: "planned"
  governance_model:
    current: "owner EOA; multisig planned; DAO later"
    future: "govern protocol params"
  incentives_model_options:
    - "fixed emissions per market"
    - "gauge voting (Curve/Pendle style)"
    - "veToken boosted LP"
  listing_policy:
    - "permissionless SY deployment if oracle support + ERC4626 or custom IIndexOracle"
    - "permissionless market creation within parameter bounds"

economics:
  fees:
    swap_fee: "time-decaying fee_rate * time_to_expiry / SECONDS_PER_YEAR"
    caps: "fee_rate <= 10% enforced"
    expiry: "fees -> 0 at expiry"
  lp_economics_status: "not formally modeled yet (noted considerations: early LPs higher fees vs higher IL; both decay near expiry)"
  liquidity_bootstrap: "not planned; options under consideration; recommendation: protocol seeding + MM partnership for initial Starknet markets"
  aggregator_integration:
    status: "not started (AVNU/Fibrous)"
    concerns: "MEV vectors"

tests_coverage:
  total: "~514 passing tests across 20+ files"
  highlights:
    amm_math_fuzz: {tests: 20, runs_each: 256, file: "tests/fuzz/fuzz_market_math.cairo"}
    invariants: {tests: 4, file: "test_market_invariants.cairo"}
    reentrancy: {tests: 16, file: "test_reentrancy.cairo"}
    large_trades: {tests: 16, file: "test_market_large_trades.cairo"}
    first_depositor: {tests: 10, file: "test_market_first_depositor.cairo"}
    yt_interest: {tests: 20, file: "test_yt_interest.cairo"}
    router_yt_swaps: {tests: 18, file: "test_router_yt_swaps.cairo"}
    fee_decay: {tests: 16, file: "test_market_fees.cairo"}
    errors: {tests: 9, file: "test_errors.cairo"}

v1_scope_and_alpha_exit:
  v1_in_scope:
    - "single market per PT"
    - "3–6 month expiries"
    - "fixed defaults for scalar_root/anchor/fee_rate"
    - "basic frontend w/ Pendle-style rate display"
  v1_out_of_scope:
    - "multiple markets per PT"
    - "gauge voting incentives"
    - "cross-chain"
    - "automated position management"
    - "advanced analytics beyond existing views"
  alpha_exit_criteria:
    - "external audit with no critical findings"
    - "meaningful sustained TVL (TBD)"
    - "time in production without incidents"
    - "core features stable + tested"
```
