# 10. Code Location Reference

## 10.1 Horizon Contract Files

| Contract | Location | Lines |
|----------|----------|-------|
| SY Token | `contracts/src/tokens/sy.cairo` | ~407 |
| SY Component | `contracts/src/components/sy_component.cairo` | ~577 |
| SYWithRewards | `contracts/src/tokens/sy_with_rewards.cairo` | ~300+ |
| RewardManager Component | `contracts/src/components/reward_manager_component.cairo` | ~400+ |
| ISY Interface | `contracts/src/interfaces/i_sy.cairo` | ~99 |
| ISYWithRewards Interface | `contracts/src/interfaces/i_sy_with_rewards.cairo` | ~140 |
| PT Token | `contracts/src/tokens/pt.cairo` | ~246 |
| YT Token | `contracts/src/tokens/yt.cairo` | ~722 |
| Market AMM | `contracts/src/market/amm.cairo` | ~1400 |
| Market Math | `contracts/src/market/market_math.cairo` | ~752 |
| Market Math FP | `contracts/src/market/market_math_fp.cairo` | ~647 |
| Market Factory | `contracts/src/market/market_factory.cairo` | ~429 |
| Factory | `contracts/src/factory.cairo` | ~308 |
| Router | `contracts/src/router.cairo` | ~900 |
| Oracle Library | `contracts/src/libraries/oracle_lib.cairo` | ~672 |
| PT/YT/LP Oracle | `contracts/src/oracles/py_lp_oracle.cairo` | ~319 |
| Pragma Index Oracle | `contracts/src/oracles/pragma_index_oracle.cairo` | ~448 |

## 10.2 Key Code Locations for Gap Implementation

**Reference (Pendle V2 code):** [OracleLib.sol](https://github.com/pendle-finance/pendle-core-v2-public/blob/main/contracts/core/Market/OracleLib.sol), [PendleMarketV6.sol](https://github.com/pendle-finance/pendle-core-v2-public/blob/main/contracts/core/Market/PendleMarketV6.sol), [PendlePYOracleLib.sol](https://github.com/pendle-finance/pendle-core-v2-public/blob/main/contracts/oracles/PtYtLpOracle/PendlePYOracleLib.sol), [PendleLpOracleLib.sol](https://github.com/pendle-finance/pendle-core-v2-public/blob/main/contracts/oracles/PtYtLpOracle/PendleLpOracleLib.sol), [PendlePYLpOracle.sol](https://github.com/pendle-finance/pendle-core-v2-public/blob/main/contracts/oracles/PtYtLpOracle/PendlePYLpOracle.sol), [PendleChainlinkOracleFactory.sol](https://github.com/pendle-finance/pendle-core-v2-public/blob/main/contracts/oracles/PtYtLpOracle/chainlink/PendleChainlinkOracleFactory.sol), [PendleChainlinkOracle.sol](https://github.com/pendle-finance/pendle-core-v2-public/blob/main/contracts/oracles/PtYtLpOracle/chainlink/PendleChainlinkOracle.sol), [PendleChainlinkOracleWithQuote.sol](https://github.com/pendle-finance/pendle-core-v2-public/blob/main/contracts/oracles/PtYtLpOracle/chainlink/PendleChainlinkOracleWithQuote.sol)

| Gap | Target File | Suggested Location |
|-----|-------------|-------------------|
| **Oracle Gaps (✅ IMPLEMENTED)** | | |
| Observation Buffer | ✅ `libraries/oracle_lib.cairo` | `Observation` struct + `Map<u16, Observation>` ring buffer (~670 lines) |
| lnImpliedRateCumulative | ✅ `libraries/oracle_lib.cairo` | `Observation.ln_implied_rate_cumulative` updated on each swap |
| observe(secondsAgos[]) | ✅ `market/amm.cairo:1003-1062` | `IMarketOracle::observe()` returns historical cumulative rates |
| increaseObservationsCardinalityNext | ✅ `market/amm.cairo:1066-1083` | `IMarketOracle::increase_observations_cardinality_next()` |
| getOracleState | ✅ `oracles/py_lp_oracle.cairo:262-290` | `PyLpOracle::get_oracle_state()` checks readiness |
| PT Rate Functions | ✅ `oracles/py_lp_oracle.cairo:47-175` | `get_pt_to_sy_rate()`, `get_pt_to_asset_rate()` |
| YT Rate Functions | ✅ `oracles/py_lp_oracle.cairo:77-210` | `get_yt_to_sy_rate()`, `get_yt_to_asset_rate()` |
| LP Rate Functions | ✅ `oracles/py_lp_oracle.cairo:102-260` | `get_lp_to_sy_rate()`, `get_lp_to_asset_rate()` |
| Pre-deployed Oracle | ✅ `oracles/py_lp_oracle.cairo` | `PyLpOracle` contract (~320 lines) |
| getLnImpliedRateTwap | ✅ `oracles/py_lp_oracle.cairo` | `get_ln_implied_rate_twap()` |
| checkOracleState | ✅ `oracles/py_lp_oracle.cairo` | `check_oracle_state()` |
| Pragma Wrapper | ❌ Optional | `oracles/pragma_pt_oracle.cairo`: Pragma-compatible interface for PT prices |
| Oracle Factory | ❌ Optional | `oracles/oracle_factory.cairo`: Factory for deploying oracle instances |
| **Market Gaps** | | |
| RewardManager/PendleGauge | `market/amm.cairo` + new `rewards/` | Inherit reward tracking, add redeemRewards() |
| Flash swap callback | `market/amm.cairo` | Add `data: Span<felt252>` param + callback logic |
| skim() | `market/amm.cairo` | New admin function |
| Separate burn receivers | `market/amm.cairo` | Update burn() signature |
| **Token Gaps** | | |
| Multi-reward YT | `tokens/yt.cairo` | Extend storage + claim |
| Chainlink Adapter | New file | `oracles/chainlink_adapter.cairo` |
| **Router Gaps** | | |
| Single-sided liquidity | `router.cairo` | New `add_liquidity_single_pt()`, `add_liquidity_single_sy()`, `add_liquidity_single_token()` |
| Token aggregation | `router.cairo` + interfaces | New `TokenInput/TokenOutput` structs, aggregator callback |
| swapExactTokenForPt | `router.cairo` | New function + aggregator integration |
| ApproxParams | `router.cairo` | Expose binary search params to callers |
| multicall | `router.cairo` | New `multicall(calls: Span<Call>)` function |
| RouterStatic | New file | `router_static.cairo` for view functions |
| Permit signatures | `router.cairo` | Add permit param to swap functions |
| redeemDueInterestAndRewards | `router.cairo` | Combined redemption across contracts |
| **Factory Gaps** | | |
| Protocol fee infrastructure | `factory.cairo` | Add `interest_fee_rate`, `reward_fee_rate` storage (treasury already present) |
| setInterestFeeRate | `factory.cairo` | New admin function with MAX_FEE_RATE validation |
| setRewardFeeRate | `factory.cairo` | New admin function with MAX_FEE_RATE validation |
| setTreasury | `factory.cairo` | New admin function |
| expiryDivisor | `factory.cairo` | Add `expiry_divisor` storage + validation in `create_yield_contracts()` |
| doCacheIndexSameBlock | `factory.cairo` + `yt.cairo` | Optional parity: add factory flag to disable cache (currently always-on) |
| **MarketFactory Gaps** | | |
| Protocol fee infrastructure | `market/market_factory.cairo` | ✅ **Implemented**: `treasury`, `default_reserve_fee_percent` storage |
| setTreasuryAndFeeReserve | `market/market_factory.cairo` | ✅ **Implemented**: `set_treasury()`, `set_default_reserve_fee_percent()` |
| Router fee overrides | `market/market_factory.cairo` | ✅ **Implemented**: `overridden_fee` mapping |
| setOverriddenFee | `market/market_factory.cairo` | ✅ **Implemented**: `set_override_fee()` with validation |
| getMarketConfig | `market/market_factory.cairo` | ✅ **Implemented**: Returns `{ treasury, ln_fee_rate_root, reserve_fee_percent }` |
| yieldContractFactory reference | `market/market_factory.cairo` | Add immutable factory address |
| **Governance Gaps** | | |
| Gauge System | New files | `gauge/` directory |
