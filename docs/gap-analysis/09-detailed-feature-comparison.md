# 9. Detailed Feature Comparison

## 9.1 Complete Feature Matrix

**Oracle/TWAP references for this matrix:** [SYBase.sol](https://github.com/pendle-finance/Pendle-SY-Public/blob/main/contracts/core/StandardizedYield/SYBase.sol), [IIndexOracle.sol](https://github.com/pendle-finance/Pendle-SY-Public/blob/main/contracts/interfaces/IIndexOracle.sol), [OracleLib.sol](https://github.com/pendle-finance/pendle-core-v2-public/blob/main/contracts/core/Market/OracleLib.sol), [PendleMarketV6.sol](https://github.com/pendle-finance/pendle-core-v2-public/blob/main/contracts/core/Market/PendleMarketV6.sol), [PendlePYOracleLib.sol](https://github.com/pendle-finance/pendle-core-v2-public/blob/main/contracts/oracles/PtYtLpOracle/PendlePYOracleLib.sol), [PendleLpOracleLib.sol](https://github.com/pendle-finance/pendle-core-v2-public/blob/main/contracts/oracles/PtYtLpOracle/PendleLpOracleLib.sol), [PendlePYLpOracle.sol](https://github.com/pendle-finance/pendle-core-v2-public/blob/main/contracts/oracles/PtYtLpOracle/PendlePYLpOracle.sol), [PendleChainlinkOracleFactory.sol](https://github.com/pendle-finance/pendle-core-v2-public/blob/main/contracts/oracles/PtYtLpOracle/chainlink/PendleChainlinkOracleFactory.sol), [PendleChainlinkOracle.sol](https://github.com/pendle-finance/pendle-core-v2-public/blob/main/contracts/oracles/PtYtLpOracle/chainlink/PendleChainlinkOracle.sol), [PendleChainlinkOracleWithQuote.sol](https://github.com/pendle-finance/pendle-core-v2-public/blob/main/contracts/oracles/PtYtLpOracle/chainlink/PendleChainlinkOracleWithQuote.sol). Horizon: [contracts/src/market/amm.cairo](../contracts/src/market/amm.cairo), [contracts/src/oracles/pragma_index_oracle.cairo](../contracts/src/oracles/pragma_index_oracle.cairo).

```
FEATURE                              PENDLE V2    HORIZON      GAP LEVEL
═══════════════════════════════════════════════════════════════════════════

CORE TOKENS
  SY exchange_rate()                    ✓            ✓         None
  SY deposit/redeem                     ✓            ✓         None
  SY dual oracle support                ✗            ✓         None (EXCEEDS)
  SY OracleRateUpdated event            ✗            ✓         None (EXCEEDS)
  SY built-in upgradeability            ✗            ✓         None (EXCEEDS)
  SY slippage protection                ✓            ✓         None ✅ IMPLEMENTED
  SY burnFromInternalBalance            ✓            ✓         None ✅ IMPLEMENTED
  SY reentrancy guard                   ✓            ✓         None ✅ IMPLEMENTED
  SY getTokensIn/Out()                  ✓            ✓         None ✅ IMPLEMENTED
  SY isValidTokenIn/Out()               ✓            ✓         None ✅ IMPLEMENTED
  SY assetInfo()                        ✓            ✓         None ✅ IMPLEMENTED
  SY previewDeposit/Redeem()            ✓            ✓         None ✅ IMPLEMENTED
  SY EIP-2612 Permit                    ✓            ✗         N/A (Starknet)
  SY native ETH support                 ✓            ✗         N/A (Starknet)
  SY getRewardTokens()                  ✓            ✓         None ✅ (SYWithRewards)
  SY claimRewards()                     ✓            ✓         None ✅ (SYWithRewards)
  SY SYBaseWithRewards                  ✓            ✓         None ✅ IMPLEMENTED
  SY pausable transfers                 ✓            ✓         None (EXCEEDS) ✅
  SY negative yield watermark           ✓            ✓         None ✅ IMPLEMENTED
  PT 1:1 redemption                     ✓            ✓         None
  PT only-YT-mints                      ✓            ✓         None
  PT emergency pause                    ✗            ✓         None (EXCEEDS)
  PT VERSION constant                   ✓            ✗         LOW
  PT reentrancy guard exposure          ✓            ✗         LOW
  YT interest tracking                  ✓            ✓         None
  YT post-expiry index freeze           ✓            ✓         None
  YT interest formula                   normalized   normalized  None
  YT UserInterest struct packing        ✓            ✗         LOW
  YT multi-reward                       ✓            ✗         HIGH
  YT syReserve tracking                 ✓            ✓         None
  YT post-expiry treasury               ✓            ✓         None
  YT protocol fee on interest           ✓            ✓         None
  YT same-block index caching           ✓            ✓         None
  YT batch mint/redeem                  ✓            ✓         None
  YT claim interest on redeem           ✓            ✓         None
  YT flash mint                         ✓            ✗         MEDIUM

AMM/MARKET (MarketMathCore)
  Logit-based curve                     ✓            ✓         None
  Rate scalar time decay                ✓            ✓         None
  Rate anchor continuity                ✓            ✓         None
  MINIMUM_LIQUIDITY                     ✓            ✓         None
  MAX_MARKET_PROPORTION (96%)           ✓            ✓         None
  Binary search for swaps               ✓            ✓         None
  Dual math implementations             ✗            ✓         None (EXCEEDS)
  4 swap function variants              ✗            ✓         None (EXCEEDS)
  PYIndex integration                   ✓            ✓         None
  Reserve fee splitting                 ✓            ✓         None
  Fee collection                        Auto-compound Manual   HIGH
  Treasury address                      ✓            ✓         None
  LP fee on add liquidity               ✓            ✗         MEDIUM
  Fee formula (exponential)             ✓            ✓         None
  Signed integer arithmetic             ✓            ✓         None
  Rounding protection (rawDivUp)        ✓            ✓         None
  setInitialLnImpliedRate()             ✓            ✓         None
  TWAP oracle                           ✓            ✓         None
  Observation buffer                    ✓            ✓         None
  PT/LP price oracle                    ✓            ✓         None

MARKET CONTRACT (PendleMarketV6)
  mint() add liquidity                  ✓            ✓         None
  burn() remove liquidity               ✓            ✓         None
  swap functions                        ✓            ✓         None
  Emergency pause                       ✗            ✓         None (EXCEEDS)
  Admin scalar adjustment               ✗            ✓         None (EXCEEDS)
  Rich event emissions                  Basic        Detailed  None (EXCEEDS)
  TWAP observation buffer (65k)         ✓            ✓         None
  observe(secondsAgos[])                ✓            ✓         None
  increaseObservationsCardinality       ✓            ✓         None
  RewardManager/PendleGauge             ✓            ✗         HIGH
  redeemRewards(user)                   ✓            ✗         HIGH
  getRewardTokens()                     ✓            ✗         HIGH
  Flash swap callback                   ✓            ✗         MEDIUM
  skim() balance reconciliation         ✓            ✗         MEDIUM
  Separate burn receivers               ✓            Single    MEDIUM
  Storage packing                       ✓            u256      MEDIUM (gas)
  Fee config from factory               ✓            In-contract MEDIUM

ROUTER ARCHITECTURE
  Diamond/Proxy pattern                 ✓            Monolithic⚠️ Different
  11+ action contracts                  ✓            1 router  ⚠️ Simpler
  Emergency pause                       ✗            ✓         None (EXCEEDS)
  RBAC system                           ✗            ✓         None (EXCEEDS)
  ReentrancyGuard                       ✓            ✓         None
  Deadline enforcement                  ✓            ✓         None
  Slippage protection                   ✓            ✓         None

ROUTER CORE FUNCTIONS
  Mint PT+YT                            ✓            ✓         None
  Redeem PT+YT                          ✓            ✓         None
  Post-expiry redeem                    ✓            ✓         None
  PT/SY swaps (4 variants)              ✓            ✓         None
  YT swaps                              ✓            ✓         None
  Convenience wrappers                  ✗            ✓         None (EXCEEDS)
  YT flash mechanism                    Callback     Mint+Sell ⚠️ Different

SINGLE-SIDED LIQUIDITY
  addLiquiditySinglePt                  ✓            ✗         HIGH
  addLiquiditySingleSy                  ✓            ✗         HIGH
  addLiquiditySingleToken               ✓            ✗         HIGH
  addLiquiditySingleTokenKeepYt         ✓            ✗         MEDIUM
  removeLiquiditySinglePt               ✓            ✗         HIGH
  removeLiquiditySingleSy               ✓            ✗         HIGH
  removeLiquiditySingleToken            ✓            ✗         HIGH
  addLiquidityDualTokenAndPt            ✓            ✗         MEDIUM
  removeLiquidityDualTokenAndPt         ✓            ✗         MEDIUM

TOKEN AGGREGATION
  TokenInput struct                     ✓            ✗         HIGH
  TokenOutput struct                    ✓            ✗         HIGH
  swapExactTokenForPt                   ✓            ✗         HIGH
  swapExactPtForToken                   ✓            ✗         HIGH
  swapExactTokenForYt                   ✓            ✗         HIGH
  swapExactYtForToken                   ✓            ✗         HIGH
  swapTokensToTokens                    ✓            ✗         HIGH
  Aggregator integration (AVNU etc)     ✓            ✗         HIGH

ADVANCED ROUTER
  ApproxParams (caller hints)           ✓            Internal  MEDIUM
  LimitOrderData                        ✓            ✗         MEDIUM
  multicall batching                    ✓            ✗         MEDIUM
  boostMarkets                          ✓            ✗         MEDIUM
  redeemDueInterestAndRewards           ✓            ✗         MEDIUM
  RouterStatic previews                 ✓            ✗         MEDIUM
  Permit signatures                     ✓            ✗         MEDIUM
  Cross-chain operations                ✓            ✗         LOW

FACTORY (YieldContractFactory)
  Create PT/YT pair                     ✓            ✓         None
  Get PT/YT by (SY, expiry)             ✓            ✓         None
  Validate deployed tokens              ✓            ✓         None
  Upgradeable                           ✓            ✓         None
  Enriched events                       Basic        Rich      None (EXCEEDS)
  RBAC integration                      ✗            ✓         None (EXCEEDS)
  Class hash updates                    ✗            ✓         None (EXCEEDS)
  interestFeeRate                       ✓            ✗         HIGH
  rewardFeeRate                         ✓            ✗         HIGH
  treasury address                      ✓            ✓         None
  setInterestFeeRate()                  ✓            ✗         HIGH
  setRewardFeeRate()                    ✓            ✗         HIGH
  setTreasury()                         ✓            ✓         None
  expiryDivisor                         ✓            ✗         MEDIUM
  setExpiryDivisor()                    ✓            ✗         MEDIUM
  doCacheIndexSameBlock                 ✓            ✓         LOW (always-on)
  VERSION constant                      ✓            ✗         LOW

MARKET FACTORY (PendleMarketFactoryV6Upg)
  Create market from PT                  ✓            ✓         None
  Validate markets                       ✓            ✓         None
  Get all markets                        ✓            ✓         None
  Upgradeable                            ✓            ✓         None
  Parameter validation                   ✓            ✓         None
  Enriched events                        Basic        Rich      None (EXCEEDS)
  RBAC integration                       ✗            ✓         None (EXCEEDS)
  Market pagination                      ✗            ✓         None (EXCEEDS)
  Active markets filter                  ✗            ✓         None (EXCEEDS)
  Market by index                        ✗            ✓         None (EXCEEDS)
  Class hash updates                     ✗            ✓         None (EXCEEDS)
  treasury address                       ✓            ✓         None (line 95)
  default_reserve_fee_percent            ✓            ✓         None (line 97)
  set_treasury()                         ✓            ✓         None (line 507)
  set_default_reserve_fee_percent()      ✓            ✓         None (line 517)
  get_market_config(market, router)      ✓            ✓         None (lines 484-493)
  Router fee overrides                   ✓            ✓         None (line 100)
  set_override_fee()                     ✓            ✓         None (lines 531-556)
  vePendle integration                   ✓            ✗         Future
  gaugeController integration            ✓            ✗         Future
  yieldContractFactory reference         ✓            ✗         MEDIUM
  VERSION constant                       ✓            ✗         LOW
  minInitialAnchor validation            ✓            ✗         LOW

ORACLE SYSTEM (Two Distinct Types)

YIELD INDEX ORACLE (SY Exchange Rate)
  ERC-4626 native                       ✓            ✓         None
  Custom oracle interface               ✓            ✓         None
  TWAP window                           ✓            ✓         None
  Staleness check                       ✓            ✓         None
  Monotonic watermark                   ✓            ✓         None
  Single-feed mode                      ✓            ✓         None
  Dual-feed ratio mode                  ✗            ✓         None (EXCEEDS)
  Emergency pause                       ✗            ✓         None (EXCEEDS)
  Emergency index override              ✗            ✓         None (EXCEEDS)
  RBAC for config changes               ✗            ✓         None (EXCEEDS)
  Rich events (IndexUpdated)            ✗            ✓         None (EXCEEDS)
  Pragma integration                    N/A          ✓         N/A (Starknet)
  Chainlink integration                 ✓            ✗         MEDIUM
  Oracle factory                        ✓            ✗         MEDIUM

MARKET TWAP ORACLE (PT/YT/LP Pricing) - ~95% Implemented
  Observation buffer (8.7k slots)       ✓            ✓         None (oracle_lib.cairo)
  lnImpliedRateCumulative               ✓            ✓         None (oracle_lib.cairo)
  observe(secondsAgos[])                ✓            ✓         None (amm.cairo:1003-1062)
  increaseObservationsCardinalityNext   ✓            ✓         None (amm.cairo:1066-1083)
  getOracleState(market, duration)      ✓            ✓         None (py_lp_oracle.cairo:262-290)
  getPtToSyRate(duration)               ✓            ✓         None (py_lp_oracle.cairo:47-75)
  getPtToAssetRate(duration)            ✓            ✓         None (py_lp_oracle.cairo:142-175)
  getYtToSyRate(duration)               ✓            ✓         None (py_lp_oracle.cairo:77-100)
  getYtToAssetRate(duration)            ✓            ✓         None (py_lp_oracle.cairo:177-210)
  getLpToSyRate(duration)               ✓            ✓         None (py_lp_oracle.cairo:102-140)
  getLpToAssetRate(duration)            ✓            ✓         None (py_lp_oracle.cairo:212-260)
  Pre-deployed oracle contract          ✓            ✓         None (PyLpOracle)
  getLnImpliedRateTwap                  ✓            ✓         None (py_lp_oracle.cairo)
  checkOracleState                      ✓            ✓         None (py_lp_oracle.cairo)
  Chainlink wrapper (latestRoundData)   ✓            ✗         OPTIONAL
  Reentrancy guard check                ✓            N/A       N/A (Cairo inherent)
  SY/PY index adjustment                ✓            ✓         None (py_lp_oracle.cairo)
  Oracle factory                        ✓            ✗         OPTIONAL

GOVERNANCE
  veToken                               ✓            ✗         Future
  Gauge contracts                       ✓            ✗         Future
  Voting controller                     ✓            ✗         Future
  Gauge controller                      ✓            ✗         Future
  LP boost                              ✓            ✗         Future
  Fee distribution                      ✓            ✗         Future
  Multi-reward gauges                   ✓            ✗         Future
```

## 9.2 Parity Summary

| Category | Implementation | Gap Count | Critical Gaps | Notes |
|----------|---------------|-----------|---------------|-------|
| Core Tokens | 90% | 8 | 2 (multi-reward YT) | ✅ **SY: 95% complete** (2 gaps: EIP-2612 Permit N/A, native ETH N/A); YT: 4 gaps (multi-reward, reward registry, flash mint, packing); PT: 2 gaps; Horizon exceeds in 7 areas |
| AMM/Market | 85% | 6 | 0 | ✅ **Core math: 100%** (PYIndex, reserve fees, TWAP oracle, **fee auto-compounding all implemented**); Remaining: RewardManager/PendleGauge, flash callbacks, rate-impact fees (Phase 2); Horizon exceeds in 5 areas |
| Router | 55% | 29 | 14 (single-sided×7, token aggregation×8) | Core ops: 85%; Missing: single-sided liquidity, token aggregation, batch ops; Horizon exceeds in 3 areas (pause, RBAC, wrappers) |
| Factory | 70% | 8 | 4 (interestFeeRate, rewardFeeRate, setters) | Core deployment: 100%; Missing: factory-level fee schedule; Horizon exceeds in 3 areas (enriched events, RBAC, class hash updates) |
| MarketFactory | 95% | 5 | 0 | ✅ **Treasury/fee infrastructure: 100%** (treasury, reserve_fee_percent, router overrides, get_market_config); Remaining: governance integration (vePendle, gaugeController); Horizon exceeds in 6 areas (pagination, active filter, events, RBAC) |
| Oracle | 95% | 2 | 0 | ✅ **Yield Index Oracle: 75%** with 5 areas Horizon EXCEEDS; ✅ **Market TWAP Oracle: 95%** - full PT/YT/LP price functions in `py_lp_oracle.cairo`; 2 optional gaps (Chainlink wrapper, Oracle factory) |
| Governance | 0% | 7 | All (by design) | |

**Oracle/TWAP references (Pendle V2 code):** [OracleLib.sol](https://github.com/pendle-finance/pendle-core-v2-public/blob/main/contracts/core/Market/OracleLib.sol), [PendleMarketV6.sol](https://github.com/pendle-finance/pendle-core-v2-public/blob/main/contracts/core/Market/PendleMarketV6.sol), [PendlePYOracleLib.sol](https://github.com/pendle-finance/pendle-core-v2-public/blob/main/contracts/oracles/PtYtLpOracle/PendlePYOracleLib.sol), [PendleLpOracleLib.sol](https://github.com/pendle-finance/pendle-core-v2-public/blob/main/contracts/oracles/PtYtLpOracle/PendleLpOracleLib.sol), [PendlePYLpOracle.sol](https://github.com/pendle-finance/pendle-core-v2-public/blob/main/contracts/oracles/PtYtLpOracle/PendlePYLpOracle.sol). Horizon: [contracts/src/market/amm.cairo](../contracts/src/market/amm.cairo), [contracts/src/libraries/oracle_lib.cairo](../contracts/src/libraries/oracle_lib.cairo), [contracts/src/oracles/py_lp_oracle.cairo](../contracts/src/oracles/py_lp_oracle.cairo), [contracts/src/oracles/pragma_index_oracle.cairo](../contracts/src/oracles/pragma_index_oracle.cairo).
