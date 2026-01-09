# 8. Implementation Priority Matrix

## 8.1 Priority 0 - Critical (Blocks Integrations)

> **✅ TWAP Oracle System - IMPLEMENTED**
>
> The following items have been fully implemented and are no longer blockers:
> - Market Observation Buffer (ring buffer in `oracle_lib.cairo`)
> - lnImpliedRateCumulative tracking
> - observe(secondsAgos[]) for historical queries
> - increaseObservationsCardinalityNext() for buffer expansion
> - getOracleState(market, duration) readiness check
> - getPtToSyRate/getPtToAssetRate for PT TWAP prices
> - getLpToSyRate/getLpToAssetRate for LP TWAP prices
> - getYtToSyRate/getYtToAssetRate for YT TWAP prices
> - Pre-deployed Oracle Contract (PendlePtLpOracle)
> - Pragma integration via PragmaIndexOracle
>
> See: `contracts/src/oracles/oracle_lib.cairo`, `contracts/src/oracles/pendle_pt_lp_oracle.cairo`

| Gap | Impact | Effort | Blocking |
|-----|--------|--------|----------|
| **Multi-Reward YT** | Reward distribution for multi-reward assets | High | Reward token integrations |
| **Single-sided liquidity Router** | One-click LP from PT or SY only | Medium | Convenience for LPs |
| **Token aggregation** | Trade from any token via DEX | High | DEX aggregator integration |

## 8.2 Priority 1 - High (User Experience)

> **✅ Reserve Fee & Treasury System - IMPLEMENTED**
>
> The following items have been implemented:
> - MarketFactory treasury address and reserve_fee_percent
> - set_treasury() and set_default_reserve_fee_percent() admin functions
> - Router fee overrides (overridden_fee, set_override_fee(), get_market_config())
>
> See: `contracts/src/market/market_factory.cairo`

| Gap | Impact | Effort | Affected Users |
|-----|--------|--------|----------------|
| **Aggregator Integration (AVNU, etc)** | Volume, discovery | High | All users |
| **addLiquiditySingleToken** | LP from any token | High | New users |
| **swapExactTokenForPt/Yt** | Buy PT/YT from any token | High | All traders |
| **PYIndex Integration** | AMM prices underlying, not raw SY | High | All traders, LPs |
| **RewardManager/PendleGauge** | LP incentive programs, yield farming | High | All LPs |
| **Factory Protocol Fees** | interestFeeRate, rewardFeeRate (factory-level) | Medium | Protocol treasury |
| **SY Multi-Token Support** | Curve LP, Yearn vaults | Medium | Yield seekers |
| **SY assetInfo()** | Risk assessment, integrations | Low | Integrators |
| **RouterStatic** | Frontend quotes | Low | All users |

## 8.3 Priority 2 - Medium (Feature Completeness)

| Gap | Impact | Effort |
|-----|--------|--------|
| ApproxParams (caller hints) | Frontend gas optimization | Medium |
| LimitOrderData integration | Advanced trading | Medium |
| multicall batching | Gas savings, UX | Medium |
| addLiquiditySingleTokenKeepYt | Convenience pattern | Medium |
| addLiquidityDualTokenAndPt | Mixed deposits | Medium |
| removeLiquidityDualTokenAndPt | Mixed withdrawals | Medium |
| Flash swap callback | Atomic arbitrage, composability | Medium |
| skim() balance reconciliation | Token recovery | Low |
| Separate burn receivers | LP exit flexibility | Low |
| Storage packing | Gas optimization | Medium |
| Fee config from factory | Centralized management | Low |
| Treasury address in MarketState | Fee destination | Low |
| LP fee on add liquidity | Protocol LP capture | Low |
| Exponential fee formula | Pendle economic parity | Medium |
| Signed integer arithmetic | Code elegance | Medium |
| SY slippage protection | Direct call safety | Low |
| SY burnFromInternalBalance | Router efficiency | Low |
| SY reentrancy guard | Explicit protection | Low |
| SY EIP-2612 Permit | Gasless approvals | Medium |
| SY reward system | Multi-reward assets | High |
| Asset type classification | Risk assessment | Low |
| Permit signatures | UX improvement | Low |
| Batch operations (boostMarkets, etc) | Gas efficiency | Medium |
| redeemDueInterestAndRewards | Combined redemption | Medium |
| Factory expiryDivisor | Standardized expiry dates | Low |
| Factory cache toggle | Optional parity vs Pendle | Low |
| Factory VERSION constant | Contract versioning | Low |
| MarketFactory yieldContractFactory reference | Cross-factory queries | Low |
| MarketFactory VERSION constant | Contract versioning | Low |
| MarketFactory minInitialAnchor validation | Parameter bounds | Low |

## 8.4 Priority 3 - Future (Ecosystem)

| Gap | Impact | Effort |
|-----|--------|--------|
| veToken system | Governance | Very High |
| Gauge contracts | LP incentives | Very High |
| Voting controller | Emission allocation | Very High |
| Fee distribution | Protocol economics | High |
| MarketFactory vePendle integration | LP boost mechanics | Very High |
| MarketFactory gaugeController integration | Emission distribution | Very High |
