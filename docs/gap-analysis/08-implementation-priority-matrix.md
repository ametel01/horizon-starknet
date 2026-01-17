# 8. Implementation Priority Matrix

## 8.1 Priority 0 - Critical (Blocks Integrations)

> **✅ TWAP Oracle System - IMPLEMENTED**
>
> The following items have been fully implemented and are no longer blockers:
> - Market Observation Buffer (ring buffer in `oracle_lib.cairo`)
> - lnImpliedRateCumulative tracking
> - observe(seconds_agos[]) for historical queries
> - increase_observations_cardinality_next() for buffer expansion
> - get_oracle_state() readiness check
> - get_pt_to_sy_rate/get_pt_to_asset_rate for PT TWAP prices
> - get_lp_to_sy_rate/get_lp_to_asset_rate for LP TWAP prices
> - get_yt_to_sy_rate/get_yt_to_asset_rate for YT TWAP prices
> - Pre-deployed Oracle Contract (PyLpOracle)
> - Pragma integration via PragmaIndexOracle
>
> See: `contracts/src/libraries/oracle_lib.cairo`, `contracts/src/oracles/py_lp_oracle.cairo`

| Gap | Impact | Effort | Blocking |
|-----|--------|--------|----------|
| **Multi-Reward YT** | Reward distribution for multi-reward assets | High | Reward token integrations |

## 8.2 Priority 1 - High (User Experience)

> **✅ Reserve Fee & Treasury System - IMPLEMENTED**
>
> The following items have been implemented:
> - MarketFactory treasury address and reserve_fee_percent
> - set_treasury() and set_default_reserve_fee_percent() admin functions
> - Per-router fee overrides (overridden_fee map, set_override_fee(), get_market_config())
>
> See: `contracts/src/market/market_factory.cairo`

> **✅ Single-Sided Liquidity Router - IMPLEMENTED**
>
> The following items have been implemented:
> - add_liquidity_single_sy / add_liquidity_single_sy_with_approx
> - add_liquidity_single_pt
> - add_liquidity_single_token
> - add_liquidity_single_token_keep_yt
> - remove_liquidity_single_sy / remove_liquidity_single_pt / remove_liquidity_single_token
>
> See: `contracts/src/router.cairo`

> **✅ Token Aggregation - IMPLEMENTED**
>
> The following items have been implemented:
> - swap_exact_token_for_pt / swap_exact_pt_for_token
> - swap_exact_token_for_yt / swap_exact_yt_for_token
> - TokenInput/TokenOutput/SwapData structs for DEX aggregator integration
> - IAggregatorRouter interface compatible with Fibrous, AVNU
>
> See: `contracts/src/router.cairo`, `contracts/src/interfaces/i_aggregator_router.cairo`

> **✅ RouterStatic - IMPLEMENTED**
>
> The following items have been implemented:
> - get_pt_to_sy_rate / get_lp_to_sy_rate / get_lp_to_pt_rate
> - preview_swap_exact_sy_for_pt / preview_swap_exact_pt_for_sy
> - preview_add_liquidity_single_sy / preview_remove_liquidity_single_sy
> - preview_swap_exact_token_for_pt / preview_add_liquidity_single_token
> - get_market_info
>
> See: `contracts/src/router_static.cairo`

> **✅ PYIndex Integration - IMPLEMENTED**
>
> AMM prices underlying assets (not raw SY). PYIndex is fetched per-call from YT contract.
> Uses asset-based curve: proportion = pt_reserve / (pt_reserve + sy_to_asset(sy_reserve, py_index))
>
> See: `contracts/src/market/market_math_fp.cairo`

> **✅ SY assetInfo() - IMPLEMENTED**
>
> Returns (AssetType, ContractAddress, u8) containing asset classification, underlying address, and decimals.
>
> See: `contracts/src/interfaces/i_sy.cairo`, `contracts/src/components/sy_component.cairo`

| Gap | Impact | Effort | Affected Users |
|-----|--------|--------|----------------|
| **RewardManager/PendleGauge** | LP incentive programs, yield farming | High | All LPs |
| **Factory Protocol Fees (rewardFeeRate)** | Reward fee capture at factory level | Medium | Protocol treasury |
| **SY EIP-2612 Permit** | Gasless approvals | Medium | All users |

## 8.3 Priority 2 - Medium (Feature Completeness)

> **✅ ApproxParams - IMPLEMENTED**
>
> ApproxParams struct (guess_min, guess_max, guess_offchain, max_iteration, eps) used in:
> - swap_exact_sy_for_pt_with_approx
> - add_liquidity_single_sy_with_approx
>
> See: `contracts/src/interfaces/i_router.cairo`, `contracts/src/router.cairo`

> **✅ multicall Batching - IMPLEMENTED**
>
> multicall() function and Call struct implemented for batched operations.
>
> See: `contracts/src/router.cairo`

> **✅ addLiquiditySingleTokenKeepYt - IMPLEMENTED**
>
> See: `contracts/src/router.cairo`

> **✅ skim() Balance Reconciliation - IMPLEMENTED**
>
> Admin-only function to recover excess tokens accidentally sent to contract. Donates excess to reserves (benefits LPs).
>
> See: `contracts/src/market/amm.cairo`

> **✅ Separate Burn Receivers - IMPLEMENTED**
>
> burn_with_receivers() allows separate receiver addresses for SY and PT on LP burn.
>
> See: `contracts/src/market/amm.cairo`

> **✅ Exponential Fee Formula - IMPLEMENTED**
>
> fee_rate = exp(ln_fee_rate_root * timeToExpiry / SECONDS_PER_YEAR)
> Plus rate-impact fee multiplier.
>
> See: `contracts/src/market/market_math_fp.cairo`

> **✅ Fee Config from Factory - IMPLEMENTED**
>
> Market queries factory for fee configuration via get_market_config().
>
> See: `contracts/src/market/amm.cairo`, `contracts/src/market/market_factory.cairo`

> **✅ Treasury Address - IMPLEMENTED**
>
> Treasury queried from factory during swaps. Reserve fees transferred to treasury.
>
> See: `contracts/src/market/amm.cairo`

> **✅ SY Slippage Protection - IMPLEMENTED**
>
> min_shares_out (deposit) and min_token_out (redeem) parameters.
>
> See: `contracts/src/components/sy_component.cairo`

> **✅ SY burnFromInternalBalance - IMPLEMENTED**
>
> burn_from_internal_balance parameter in redeem() for Router efficiency pattern.
>
> See: `contracts/src/components/sy_component.cairo`

> **✅ SY Reentrancy Guard - IMPLEMENTED**
>
> Uses OpenZeppelin ReentrancyGuardComponent with before/after hooks.
>
> See: `contracts/src/tokens/sy.cairo`, `contracts/src/tokens/sy_with_rewards.cairo`

> **✅ SY Multi-Token Support - IMPLEMENTED**
>
> tokens_in and tokens_out maps with O(1) lookup via valid_tokens_in and valid_tokens_out.
>
> See: `contracts/src/components/sy_component.cairo`

> **✅ Swap Callback (Post-Execution) - IMPLEMENTED**
>
> IMarketCallback interface for post-execution notifications. Note: This is a notification hook after transfers complete (CEI pattern), not a flash swap.
>
> See: `contracts/src/interfaces/i_market_callback.cairo`, `contracts/src/market/amm.cairo`

> **✅ minInitialAnchor Validation - IMPLEMENTED**
>
> MIN_INITIAL_ANCHOR (1 WAD) and MAX_INITIAL_ANCHOR (~4.6 WAD) validation in MarketFactory.
>
> See: `contracts/src/market/market_factory.cairo`

> **✅ LP Rollover Operations - IMPLEMENTED**
>
> rollover_lp() function (Horizon-specific feature).
>
> See: `contracts/src/router.cairo`

> **✅ redeem_due_interest_and_rewards (Combined) - IMPLEMENTED**
>
> Combined redemption function in Router.
>
> See: `contracts/src/router.cairo`

| Gap | Impact | Effort |
|-----|--------|--------|
| LimitOrderData integration | Advanced trading | Medium |
| addLiquidityDualTokenAndPt | Mixed deposits | Medium |
| removeLiquidityDualTokenAndPt | Mixed withdrawals | Medium |
| Storage packing (further optimization) | Gas optimization | Medium |
| Signed integer arithmetic | Code elegance | Medium |
| Permit signatures | UX improvement | Low |
| Batch operations (boostMarkets, etc) | Gas efficiency | Medium |
| Factory expiryDivisor | Standardized expiry dates | Low |
| Factory VERSION constant | Contract versioning | Low |
| MarketFactory yieldContractFactory reference | Cross-factory queries | Low |
| MarketFactory VERSION constant | Contract versioning | Low |

## 8.4 Priority 3 - Future (Ecosystem)

| Gap | Impact | Effort |
|-----|--------|--------|
| veToken system | Governance | Very High |
| Gauge contracts | LP incentives | Very High |
| Voting controller | Emission allocation | Very High |
| Fee distribution (governance-based) | Protocol economics | High |
| MarketFactory vePendle integration | LP boost mechanics | Very High |
| MarketFactory gaugeController integration | Emission distribution | Very High |
