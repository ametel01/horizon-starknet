# Frontend Improvements Implementation Plan

This document outlines the implementation plan for closing the frontend gaps identified in the Pendle comparison.

---

## Table of Contents

1. [SDK Package for Developers](#1-sdk-package-for-developers)
2. [Accurate Price Impact Calculation](#2-accurate-price-impact-calculation)
3. [APY Breakdown Display](#3-apy-breakdown-display)
4. [Enhanced Position Tracking](#4-enhanced-position-tracking)
5. [Implementation Timeline](#5-implementation-timeline)

---

## 1. SDK Package for Developers

### Current State
- All contract interactions are embedded in React hooks
- No reusable SDK for external developers
- Transaction building is tightly coupled to UI

### Target State
- Standalone `@horizon/sdk` package
- Framework-agnostic (works with any frontend)
- Type-safe contract interactions
- Quote/preview functions without state
- Transaction builders returning `Call[]`

### Implementation Plan

#### 1.1 Package Structure

```
packages/
├── frontend/          # Existing Next.js app
└── sdk/               # NEW: Standalone SDK
    ├── package.json
    ├── tsconfig.json
    ├── src/
    │   ├── index.ts           # Main exports
    │   ├── client.ts          # HorizonClient class
    │   ├── contracts/
    │   │   ├── index.ts
    │   │   ├── market.ts      # Market contract wrapper
    │   │   ├── router.ts      # Router contract wrapper
    │   │   ├── sy.ts          # SY contract wrapper
    │   │   ├── pt.ts          # PT contract wrapper
    │   │   └── yt.ts          # YT contract wrapper
    │   ├── math/
    │   │   ├── index.ts
    │   │   ├── wad.ts         # WAD arithmetic
    │   │   ├── yield.ts       # APY calculations
    │   │   ├── amm.ts         # AMM curve math
    │   │   └── market.ts      # Market state calculations
    │   ├── quotes/
    │   │   ├── index.ts
    │   │   ├── swap.ts        # Swap quotes
    │   │   ├── liquidity.ts   # LP quotes
    │   │   └── mint.ts        # Mint/redeem quotes
    │   ├── builders/
    │   │   ├── index.ts
    │   │   ├── swap.ts        # Swap transaction builders
    │   │   ├── liquidity.ts   # LP transaction builders
    │   │   └── mint.ts        # Mint/redeem builders
    │   ├── types/
    │   │   ├── index.ts
    │   │   ├── market.ts
    │   │   ├── quotes.ts
    │   │   └── transactions.ts
    │   └── constants/
    │       ├── index.ts
    │       ├── addresses.ts
    │       └── abis.ts
    └── tests/
        ├── math.test.ts
        ├── quotes.test.ts
        └── builders.test.ts
```

#### 1.2 Core SDK API

```typescript
// packages/sdk/src/client.ts

import { RpcProvider, Account, Call } from 'starknet';

export interface HorizonClientConfig {
  provider: RpcProvider;
  network: 'mainnet' | 'sepolia' | 'devnet';
  account?: Account; // Optional for read-only operations
}

export class HorizonClient {
  private provider: RpcProvider;
  private network: Network;
  private account?: Account;
  private addresses: NetworkAddresses;

  constructor(config: HorizonClientConfig) {
    this.provider = config.provider;
    this.network = config.network;
    this.account = config.account;
    this.addresses = getAddresses(config.network);
  }

  // === Market Data ===
  async getMarkets(): Promise<MarketData[]>
  async getMarket(address: string): Promise<MarketData>
  async getMarketState(address: string): Promise<MarketState>

  // === Quotes (Read-only) ===
  quotes = {
    swapSyForPt: (market: string, syIn: bigint) => Promise<SwapQuote>,
    swapPtForSy: (market: string, ptIn: bigint) => Promise<SwapQuote>,
    swapSyForYt: (market: string, syIn: bigint) => Promise<SwapQuote>,
    swapYtForSy: (market: string, ytIn: bigint) => Promise<SwapQuote>,
    addLiquidity: (market: string, sy: bigint, pt: bigint) => Promise<LiquidityQuote>,
    removeLiquidity: (market: string, lp: bigint) => Promise<LiquidityQuote>,
    mintPy: (yt: string, syIn: bigint) => Promise<MintQuote>,
    redeemPy: (yt: string, pyIn: bigint) => Promise<RedeemQuote>,
  }

  // === Transaction Builders ===
  build = {
    swapSyForPt: (params: SwapParams) => Call[],
    swapPtForSy: (params: SwapParams) => Call[],
    swapSyForYt: (params: SwapParams) => Call[],
    swapYtForSy: (params: SwapParams) => Call[],
    addLiquidity: (params: LiquidityParams) => Call[],
    removeLiquidity: (params: RemoveLiquidityParams) => Call[],
    mintPy: (params: MintParams) => Call[],
    redeemPy: (params: RedeemParams) => Call[],
    claimYield: (params: ClaimParams) => Call[],
  }

  // === Execute (requires account) ===
  async execute(calls: Call[]): Promise<TransactionResult>
}
```

#### 1.3 Quote Types

```typescript
// packages/sdk/src/types/quotes.ts

export interface SwapQuote {
  amountIn: bigint;
  amountOut: bigint;
  minAmountOut: bigint;      // After slippage
  priceImpact: number;       // As decimal (0.01 = 1%)
  effectivePrice: bigint;    // WAD
  impliedApy: {
    before: number;
    after: number;
  };
  route: 'direct' | 'flash'; // PT direct, YT via flash swap
  fees: {
    swapFee: bigint;
    protocolFee: bigint;
  };
}

export interface LiquidityQuote {
  syIn: bigint;
  ptIn: bigint;
  lpOut: bigint;
  minLpOut: bigint;
  shareOfPool: number;       // As decimal
  impliedApy: number;
}

export interface MintQuote {
  syIn: bigint;
  ptOut: bigint;
  ytOut: bigint;
  pyIndex: bigint;
}
```

#### 1.4 Math Module (Extracted from Frontend)

```typescript
// packages/sdk/src/math/amm.ts

import { WAD, wadMul, wadDiv, expWad, lnWad } from './wad';

export interface MarketState {
  syReserve: bigint;
  ptReserve: bigint;
  totalLp: bigint;
  scalarRoot: bigint;
  initialAnchor: bigint;
  feeRate: bigint;
  expiry: bigint;
  lastLnImpliedRate: bigint;
}

const SECONDS_PER_YEAR = 31_536_000n;

export function getTimeToExpiry(expiry: bigint, now: bigint): bigint {
  if (now >= expiry) return 1n; // MIN_TIME_TO_EXPIRY
  return expiry - now;
}

export function getRateScalar(scalarRoot: bigint, timeToExpiry: bigint): bigint {
  const timeInYears = wadDiv(timeToExpiry * WAD, SECONDS_PER_YEAR * WAD);
  return wadDiv(scalarRoot, timeInYears);
}

export function getProportion(state: MarketState): bigint {
  const total = state.ptReserve + state.syReserve;
  return wadDiv(state.ptReserve * WAD, total * WAD);
}

export function getLnImpliedRate(state: MarketState, timeToExpiry: bigint): bigint {
  const proportion = getProportion(state);
  const rateScalar = getRateScalar(state.scalarRoot, timeToExpiry);

  // ln_odds = ln(proportion / (1 - proportion))
  const odds = wadDiv(proportion, WAD - proportion);
  const lnOdds = lnWad(odds);

  // ln_implied_rate = anchor - rate_scalar * ln_odds
  return state.initialAnchor - wadMul(rateScalar, lnOdds);
}

export function getPtPrice(lnImpliedRate: bigint, timeToExpiry: bigint): bigint {
  const timeInYears = wadDiv(timeToExpiry * WAD, SECONDS_PER_YEAR * WAD);
  const exponent = wadMul(lnImpliedRate, timeInYears);
  // pt_price = e^(-ln_implied_rate * time_in_years)
  return expWad(-exponent);
}

export function getImpliedApy(lnImpliedRate: bigint): number {
  // implied_apy = e^(ln_implied_rate) - 1
  const rate = expWad(lnImpliedRate);
  return Number(rate - WAD) / Number(WAD);
}
```

#### 1.5 Swap Quote Implementation

```typescript
// packages/sdk/src/quotes/swap.ts

import { MarketState, getLnImpliedRate, getPtPrice, getImpliedApy } from '../math/amm';
import { WAD, wadMul, wadDiv } from '../math/wad';

export interface SwapExactSyForPtParams {
  state: MarketState;
  exactSyIn: bigint;
  currentTime: bigint;
  slippageBps: number;
}

export function quoteSwapExactSyForPt(params: SwapExactSyForPtParams): SwapQuote {
  const { state, exactSyIn, currentTime, slippageBps } = params;
  const timeToExpiry = getTimeToExpiry(state.expiry, currentTime);

  // Calculate ln_implied_rate before swap
  const lnRateBefore = getLnImpliedRate(state, timeToExpiry);
  const apyBefore = getImpliedApy(lnRateBefore);

  // Calculate PT price
  const ptPrice = getPtPrice(lnRateBefore, timeToExpiry);

  // Base output (ignoring price impact)
  const basePtOut = wadDiv(exactSyIn * WAD, ptPrice);

  // Apply constant product for price impact
  // k = sy_reserve * pt_reserve
  // new_sy = sy_reserve + sy_in
  // new_pt = k / new_sy
  // pt_out = pt_reserve - new_pt
  const k = state.syReserve * state.ptReserve;
  const newSyReserve = state.syReserve + exactSyIn;
  const newPtReserve = k / newSyReserve;
  const ptOutBeforeFee = state.ptReserve - newPtReserve;

  // Apply fee
  const fee = wadMul(ptOutBeforeFee, state.feeRate);
  const ptOut = ptOutBeforeFee - fee;

  // Calculate price impact
  const priceImpact = Number(basePtOut - ptOut) / Number(basePtOut);

  // Calculate effective price
  const effectivePrice = wadDiv(exactSyIn * WAD, ptOut * WAD);

  // Calculate implied APY after swap
  const newState = { ...state, syReserve: newSyReserve, ptReserve: newPtReserve };
  const lnRateAfter = getLnImpliedRate(newState, timeToExpiry);
  const apyAfter = getImpliedApy(lnRateAfter);

  // Apply slippage
  const slippageMultiplier = BigInt(10000 - slippageBps);
  const minAmountOut = (ptOut * slippageMultiplier) / 10000n;

  return {
    amountIn: exactSyIn,
    amountOut: ptOut,
    minAmountOut,
    priceImpact,
    effectivePrice,
    impliedApy: {
      before: apyBefore,
      after: apyAfter,
    },
    route: 'direct',
    fees: {
      swapFee: fee,
      protocolFee: 0n, // TODO: Add when fee distribution implemented
    },
  };
}
```

#### 1.6 Transaction Builder

```typescript
// packages/sdk/src/builders/swap.ts

import { Call, uint256 } from 'starknet';
import { SwapQuote } from '../types/quotes';

export interface BuildSwapParams {
  routerAddress: string;
  marketAddress: string;
  syAddress: string;
  receiver: string;
  quote: SwapQuote;
}

export function buildSwapSyForPt(params: BuildSwapParams): Call[] {
  const { routerAddress, marketAddress, syAddress, receiver, quote } = params;

  const calls: Call[] = [];

  // 1. Approve SY to router
  calls.push({
    contractAddress: syAddress,
    entrypoint: 'approve',
    calldata: [
      routerAddress,
      uint256.bnToUint256(quote.amountIn).low,
      uint256.bnToUint256(quote.amountIn).high,
    ],
  });

  // 2. Execute swap
  calls.push({
    contractAddress: routerAddress,
    entrypoint: 'swap_exact_sy_for_pt',
    calldata: [
      marketAddress,
      receiver,
      uint256.bnToUint256(quote.amountIn).low,
      uint256.bnToUint256(quote.amountIn).high,
      uint256.bnToUint256(quote.minAmountOut).low,
      uint256.bnToUint256(quote.minAmountOut).high,
    ],
  });

  return calls;
}
```

#### 1.7 Integration with Frontend

```typescript
// packages/frontend/src/hooks/useSwapWithSdk.ts

import { useCallback, useMemo } from 'react';
import { HorizonClient } from '@horizon/sdk';
import { useStarknet } from '../providers/StarknetProvider';
import { useMarketState } from './useMarket';

export function useSwapWithSdk(marketAddress: string) {
  const { provider, account, network } = useStarknet();
  const { data: marketState } = useMarketState(marketAddress);

  const client = useMemo(() => {
    return new HorizonClient({ provider, network, account });
  }, [provider, network, account]);

  const getQuote = useCallback(async (
    direction: 'syToPt' | 'ptToSy',
    amountIn: bigint,
    slippageBps: number = 50
  ) => {
    if (!marketState) return null;

    if (direction === 'syToPt') {
      return client.quotes.swapSyForPt(marketAddress, amountIn);
    } else {
      return client.quotes.swapPtForSy(marketAddress, amountIn);
    }
  }, [client, marketAddress, marketState]);

  const executeSwap = useCallback(async (quote: SwapQuote) => {
    if (!account) throw new Error('Wallet not connected');

    const calls = client.build.swapSyForPt({
      market: marketAddress,
      receiver: account.address,
      quote,
    });

    return client.execute(calls);
  }, [client, marketAddress, account]);

  return { getQuote, executeSwap };
}
```

#### 1.8 Package Configuration

```json
// packages/sdk/package.json
{
  "name": "@horizon/sdk",
  "version": "0.1.0",
  "main": "dist/index.js",
  "module": "dist/index.mjs",
  "types": "dist/index.d.ts",
  "files": ["dist"],
  "scripts": {
    "build": "tsup src/index.ts --format cjs,esm --dts",
    "test": "vitest",
    "lint": "eslint src"
  },
  "dependencies": {
    "starknet": "^6.0.0",
    "bignumber.js": "^9.1.2"
  },
  "devDependencies": {
    "tsup": "^8.0.0",
    "typescript": "^5.0.0",
    "vitest": "^1.0.0"
  },
  "peerDependencies": {
    "starknet": "^6.0.0"
  }
}
```

---

## 2. Accurate Price Impact Calculation

### Current State

```typescript
// Current simplified calculation in SwapForm.tsx
const ptOut = (ptReserve * syIn) / (syReserve + syIn);
// This is basic constant product, doesn't match AMM curve
```

### Target State
- Match on-chain AMM curve exactly
- Show accurate price impact %
- Display implied APY change
- Show effective rate vs spot rate

### Implementation Plan

#### 2.1 Port AMM Math from Contracts

```typescript
// packages/frontend/src/lib/math/amm.ts

import BigNumber from 'bignumber.js';

const WAD = new BigNumber('1e18');
const SECONDS_PER_YEAR = new BigNumber(31_536_000);

export interface MarketMathParams {
  syReserve: bigint;
  ptReserve: bigint;
  scalarRoot: bigint;
  initialAnchor: bigint;
  feeRate: bigint;
  expiry: bigint;
  currentTime: bigint;
}

/**
 * Replicate on-chain AMM curve calculation
 */
export function calculateSwapExactSyForPt(
  params: MarketMathParams,
  exactSyIn: bigint
): {
  ptOut: bigint;
  fee: bigint;
  newLnImpliedRate: bigint;
  priceImpact: number;
} {
  const {
    syReserve,
    ptReserve,
    scalarRoot,
    initialAnchor,
    feeRate,
    expiry,
    currentTime,
  } = params;

  // 1. Calculate time to expiry
  const timeToExpiry = expiry > currentTime ? expiry - currentTime : 1n;
  const timeInYears = new BigNumber(timeToExpiry.toString())
    .div(SECONDS_PER_YEAR);

  // 2. Calculate rate scalar
  const rateScalar = new BigNumber(scalarRoot.toString())
    .div(WAD)
    .div(timeInYears);

  // 3. Calculate current proportion and ln_implied_rate
  const syRes = new BigNumber(syReserve.toString());
  const ptRes = new BigNumber(ptReserve.toString());
  const total = syRes.plus(ptRes);
  const proportion = ptRes.div(total);

  // ln(odds) = ln(p / (1-p))
  const odds = proportion.div(new BigNumber(1).minus(proportion));
  const lnOdds = ln(odds);

  // ln_implied_rate = anchor - rate_scalar * ln_odds
  const anchor = new BigNumber(initialAnchor.toString()).div(WAD);
  const lnImpliedRateBefore = anchor.minus(rateScalar.times(lnOdds));

  // 4. Calculate PT price
  // pt_price = e^(-ln_implied_rate * time_in_years)
  const exponent = lnImpliedRateBefore.times(timeInYears).negated();
  const ptPrice = exp(exponent);

  // 5. Calculate base PT out (before price impact)
  const syInBN = new BigNumber(exactSyIn.toString());
  const basePtOut = syInBN.div(ptPrice.times(WAD));

  // 6. Apply AMM curve (constant product variant)
  const k = syRes.times(ptRes);
  const newSyReserve = syRes.plus(syInBN);
  const newPtReserve = k.div(newSyReserve);
  const ptOutBeforeFee = ptRes.minus(newPtReserve);

  // 7. Apply fee
  const feeRateBN = new BigNumber(feeRate.toString()).div(WAD);
  const fee = ptOutBeforeFee.times(feeRateBN);
  const ptOut = ptOutBeforeFee.minus(fee);

  // 8. Calculate new ln_implied_rate
  const newTotal = newSyReserve.plus(newPtReserve);
  const newProportion = newPtReserve.div(newTotal);
  const newOdds = newProportion.div(new BigNumber(1).minus(newProportion));
  const newLnOdds = ln(newOdds);
  const lnImpliedRateAfter = anchor.minus(rateScalar.times(newLnOdds));

  // 9. Calculate price impact
  const priceImpact = basePtOut.minus(ptOut).div(basePtOut).toNumber();

  return {
    ptOut: BigInt(ptOut.integerValue().toString()),
    fee: BigInt(fee.integerValue().toString()),
    newLnImpliedRate: BigInt(lnImpliedRateAfter.times(WAD).integerValue().toString()),
    priceImpact,
  };
}

// Helper: Natural logarithm using Taylor series
function ln(x: BigNumber): BigNumber {
  // ln(x) = 2 * sum((((x-1)/(x+1))^(2n+1)) / (2n+1))
  const z = x.minus(1).div(x.plus(1));
  let result = new BigNumber(0);
  let term = z;

  for (let n = 0; n < 50; n++) {
    result = result.plus(term.div(2 * n + 1));
    term = term.times(z).times(z);
  }

  return result.times(2);
}

// Helper: Exponential using Taylor series
function exp(x: BigNumber): BigNumber {
  let result = new BigNumber(1);
  let term = new BigNumber(1);

  for (let n = 1; n < 50; n++) {
    term = term.times(x).div(n);
    result = result.plus(term);
    if (term.abs().lt(1e-18)) break;
  }

  return result;
}
```

#### 2.2 Update SwapForm Component

```typescript
// packages/frontend/src/components/forms/SwapForm.tsx

import { calculateSwapExactSyForPt } from '@/lib/math/amm';
import { lnRateToApy } from '@/lib/math/yield';

export function SwapForm({ market }: { market: MarketData }) {
  const [amountIn, setAmountIn] = useState<bigint>(0n);
  const [quote, setQuote] = useState<SwapQuote | null>(null);

  // Calculate quote when amount changes
  useEffect(() => {
    if (amountIn === 0n || !market.state) {
      setQuote(null);
      return;
    }

    const result = calculateSwapExactSyForPt({
      syReserve: market.state.syReserve,
      ptReserve: market.state.ptReserve,
      scalarRoot: market.scalarRoot,
      initialAnchor: market.initialAnchor,
      feeRate: market.feeRate,
      expiry: market.expiry,
      currentTime: BigInt(Math.floor(Date.now() / 1000)),
    }, amountIn);

    const apyBefore = lnRateToApy(market.state.lnImpliedRate);
    const apyAfter = lnRateToApy(result.newLnImpliedRate);

    setQuote({
      amountOut: result.ptOut,
      priceImpact: result.priceImpact,
      fee: result.fee,
      impliedApy: { before: apyBefore, after: apyAfter },
    });
  }, [amountIn, market]);

  return (
    <div>
      <TokenInput
        value={amountIn}
        onChange={setAmountIn}
        token={market.syAddress}
        label="You pay"
      />

      {quote && (
        <div className="mt-4 space-y-2">
          {/* Output */}
          <div className="flex justify-between">
            <span>You receive</span>
            <span>{formatWad(quote.amountOut)} PT</span>
          </div>

          {/* Price Impact */}
          <div className="flex justify-between">
            <span>Price Impact</span>
            <span className={quote.priceImpact > 0.01 ? 'text-red-500' : ''}>
              {(quote.priceImpact * 100).toFixed(2)}%
            </span>
          </div>

          {/* Implied APY Change */}
          <div className="flex justify-between">
            <span>Implied APY</span>
            <span>
              {(quote.impliedApy.before * 100).toFixed(2)}% →{' '}
              {(quote.impliedApy.after * 100).toFixed(2)}%
            </span>
          </div>

          {/* Fee */}
          <div className="flex justify-between text-sm text-gray-500">
            <span>Swap Fee</span>
            <span>{formatWad(quote.fee)} PT</span>
          </div>
        </div>
      )}
    </div>
  );
}
```

#### 2.3 Add Price Impact Warning Component

```typescript
// packages/frontend/src/components/display/PriceImpactWarning.tsx

interface PriceImpactWarningProps {
  priceImpact: number;
}

export function PriceImpactWarning({ priceImpact }: PriceImpactWarningProps) {
  if (priceImpact < 0.01) return null; // < 1%

  const severity = priceImpact < 0.03 ? 'warning' : 'error';
  const colors = {
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    error: 'bg-red-50 border-red-200 text-red-800',
  };

  return (
    <div className={`p-3 rounded-lg border ${colors[severity]}`}>
      <div className="flex items-center gap-2">
        <AlertTriangle className="w-4 h-4" />
        <span className="font-medium">High Price Impact</span>
      </div>
      <p className="text-sm mt-1">
        This trade has a {(priceImpact * 100).toFixed(2)}% price impact.
        {severity === 'error' && ' Consider reducing your trade size.'}
      </p>
    </div>
  );
}
```

---

## 3. APY Breakdown Display

### Current State

```typescript
// Only shows single implied APY
<div>Implied APY: {formatPercent(market.impliedApy)}</div>
```

### Target State
- Show all APY components
- Underlying yield breakdown
- Swap fee APY for LPs
- Total combined APY

### Implementation Plan

#### 3.1 APY Data Types

```typescript
// packages/frontend/src/types/apy.ts

export interface UnderlyingYield {
  interestApy: number;     // From SY appreciation
  rewardsApr: number;      // From external rewards (future)
  totalApy: number;
}

export interface MarketApyBreakdown {
  // For PT holders
  ptFixedApy: number;      // Implied APY (what PT buyer locks in)

  // Underlying asset yield
  underlying: UnderlyingYield;

  // For LP holders
  lpApy: {
    ptYield: number;       // From PT portion
    syYield: number;       // From SY portion (underlying)
    swapFees: number;      // From trading fees
    rewards: number;       // From protocol incentives (future)
    total: number;
  };

  // For YT holders
  ytApy: {
    longYieldApy: number;  // If underlying beats implied
    breakEvenApy: number;  // Underlying APY needed to break even
  };
}
```

#### 3.2 APY Calculation Functions

```typescript
// packages/frontend/src/lib/math/apy-breakdown.ts

import { WAD } from './wad';

export interface ApyCalculationParams {
  // Market state
  syReserve: bigint;
  ptReserve: bigint;
  lnImpliedRate: bigint;
  expiry: bigint;

  // Underlying token data
  syExchangeRate: bigint;
  previousExchangeRate: bigint;
  rateTimeDelta: number;        // Seconds between rate snapshots

  // Fee data
  swapVolume24h: bigint;        // 24h volume in SY terms
  feeRate: bigint;

  // Price data (optional, for USD conversion)
  syPriceUsd?: number;
}

export function calculateApyBreakdown(
  params: ApyCalculationParams
): MarketApyBreakdown {
  const {
    syReserve,
    ptReserve,
    lnImpliedRate,
    expiry,
    syExchangeRate,
    previousExchangeRate,
    rateTimeDelta,
    swapVolume24h,
    feeRate,
  } = params;

  const now = BigInt(Math.floor(Date.now() / 1000));
  const timeToExpiry = expiry > now ? expiry - now : 1n;
  const yearsToExpiry = Number(timeToExpiry) / 31_536_000;

  // 1. PT Fixed APY (implied rate)
  const ptFixedApy = Math.exp(Number(lnImpliedRate) / 1e18) - 1;

  // 2. Underlying Interest APY
  // APY = (current_rate / previous_rate)^(365/days) - 1
  const currentRate = Number(syExchangeRate) / 1e18;
  const prevRate = Number(previousExchangeRate) / 1e18;
  const daysDelta = rateTimeDelta / 86400;
  const interestApy = daysDelta > 0
    ? Math.pow(currentRate / prevRate, 365 / daysDelta) - 1
    : 0;

  // 3. Swap Fee APY for LPs
  // fee_apy = (daily_fees / tvl) * 365
  const totalReserves = Number(syReserve + ptReserve) / 1e18;
  const volume24h = Number(swapVolume24h) / 1e18;
  const feeRateNum = Number(feeRate) / 1e18;
  const dailyFees = volume24h * feeRateNum * 0.2; // 20% to LPs
  const swapFeeApy = totalReserves > 0
    ? (dailyFees / totalReserves) * 365
    : 0;

  // 4. LP APY Components
  const ptPortion = Number(ptReserve) / Number(syReserve + ptReserve);
  const syPortion = 1 - ptPortion;

  const lpPtYield = ptFixedApy * ptPortion;
  const lpSyYield = interestApy * syPortion;
  const lpSwapFees = swapFeeApy;
  const lpRewards = 0; // TODO: Add when gauge implemented
  const lpTotalApy = lpPtYield + lpSyYield + lpSwapFees + lpRewards;

  // 5. YT Long Yield APY
  // If you buy YT, you're betting underlying > implied
  const ytPrice = 1 - Math.exp(-ptFixedApy * yearsToExpiry);
  const breakEvenApy = ptFixedApy; // Need underlying to exceed this

  // If underlying beats implied, profit = (underlying - implied) * exposure
  const ytExposure = 1 / ytPrice; // Leverage from YT price
  const longYieldApy = interestApy > ptFixedApy
    ? (interestApy - ptFixedApy) * ytExposure
    : -(ptFixedApy - interestApy) * ytExposure;

  return {
    ptFixedApy,
    underlying: {
      interestApy,
      rewardsApr: 0, // TODO: Add reward tracking
      totalApy: interestApy,
    },
    lpApy: {
      ptYield: lpPtYield,
      syYield: lpSyYield,
      swapFees: lpSwapFees,
      rewards: lpRewards,
      total: lpTotalApy,
    },
    ytApy: {
      longYieldApy,
      breakEvenApy,
    },
  };
}
```

#### 3.3 APY Breakdown Component

```typescript
// packages/frontend/src/components/display/ApyBreakdown.tsx

import { MarketApyBreakdown } from '@/types/apy';

interface ApyBreakdownProps {
  breakdown: MarketApyBreakdown;
  view: 'pt' | 'yt' | 'lp';
}

export function ApyBreakdown({ breakdown, view }: ApyBreakdownProps) {
  return (
    <div className="space-y-4">
      {view === 'pt' && (
        <div className="p-4 bg-green-50 rounded-lg">
          <div className="text-sm text-green-600">Fixed APY</div>
          <div className="text-2xl font-bold text-green-700">
            {formatPercent(breakdown.ptFixedApy)}
          </div>
          <div className="text-xs text-green-600 mt-1">
            Guaranteed at maturity
          </div>
        </div>
      )}

      {view === 'yt' && (
        <div className="space-y-3">
          <div className="p-4 bg-purple-50 rounded-lg">
            <div className="text-sm text-purple-600">Long Yield APY</div>
            <div className={`text-2xl font-bold ${
              breakdown.ytApy.longYieldApy >= 0 ? 'text-green-700' : 'text-red-700'
            }`}>
              {formatPercent(breakdown.ytApy.longYieldApy)}
            </div>
          </div>
          <div className="flex justify-between text-sm">
            <span>Break-even APY</span>
            <span>{formatPercent(breakdown.ytApy.breakEvenApy)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span>Current Underlying APY</span>
            <span>{formatPercent(breakdown.underlying.totalApy)}</span>
          </div>
        </div>
      )}

      {view === 'lp' && (
        <div className="space-y-3">
          <div className="p-4 bg-blue-50 rounded-lg">
            <div className="text-sm text-blue-600">Total LP APY</div>
            <div className="text-2xl font-bold text-blue-700">
              {formatPercent(breakdown.lpApy.total)}
            </div>
          </div>

          <div className="text-sm font-medium">Breakdown</div>

          <div className="space-y-2">
            <ApyRow
              label="PT Yield"
              value={breakdown.lpApy.ptYield}
              tooltip="Your share of PT fixed yield"
            />
            <ApyRow
              label="Underlying Yield"
              value={breakdown.lpApy.syYield}
              tooltip="Yield from SY portion"
            />
            <ApyRow
              label="Swap Fees"
              value={breakdown.lpApy.swapFees}
              tooltip="20% of trading fees"
            />
            {breakdown.lpApy.rewards > 0 && (
              <ApyRow
                label="Rewards"
                value={breakdown.lpApy.rewards}
                tooltip="Protocol incentives"
              />
            )}
          </div>
        </div>
      )}

      {/* Underlying breakdown (always shown) */}
      <div className="border-t pt-3 mt-3">
        <div className="text-xs text-gray-500 mb-2">Underlying Asset Yield</div>
        <div className="flex justify-between text-sm">
          <span>Interest APY</span>
          <span>{formatPercent(breakdown.underlying.interestApy)}</span>
        </div>
        {breakdown.underlying.rewardsApr > 0 && (
          <div className="flex justify-between text-sm">
            <span>Rewards APR</span>
            <span>{formatPercent(breakdown.underlying.rewardsApr)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function ApyRow({ label, value, tooltip }: {
  label: string;
  value: number;
  tooltip: string;
}) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-sm text-gray-600 flex items-center gap-1">
        {label}
        <Tooltip content={tooltip}>
          <Info className="w-3 h-3" />
        </Tooltip>
      </span>
      <span className="text-sm font-medium">
        {formatPercent(value)}
      </span>
    </div>
  );
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}
```

#### 3.4 Hook for APY Data

```typescript
// packages/frontend/src/hooks/useApyBreakdown.ts

import { useQuery } from '@tanstack/react-query';
import { calculateApyBreakdown } from '@/lib/math/apy-breakdown';

export function useApyBreakdown(marketAddress: string) {
  const { data: market } = useMarket(marketAddress);
  const { data: syData } = useSyData(market?.syAddress);
  const { data: volume } = useMarketVolume(marketAddress);

  return useQuery({
    queryKey: ['apy-breakdown', marketAddress],
    queryFn: () => {
      if (!market || !syData) return null;

      return calculateApyBreakdown({
        syReserve: market.state.syReserve,
        ptReserve: market.state.ptReserve,
        lnImpliedRate: market.state.lnImpliedRate,
        expiry: market.expiry,
        syExchangeRate: syData.currentRate,
        previousExchangeRate: syData.previousRate,
        rateTimeDelta: syData.rateTimeDelta,
        swapVolume24h: volume?.volume24h ?? 0n,
        feeRate: market.feeRate,
      });
    },
    enabled: !!market && !!syData,
    staleTime: 60_000, // 1 minute
  });
}
```

---

## 4. Enhanced Position Tracking

### Current State

```typescript
// Basic balance tracking
{
  syBalance, ptBalance, ytBalance, lpBalance,
  claimableYield
}
```

### Target State
- USD value for all positions
- P&L calculation (unrealized + realized)
- Historical yield tracking
- Batch claim operations

### Implementation Plan

#### 4.1 Enhanced Position Types

```typescript
// packages/frontend/src/types/position.ts

export interface PositionValue {
  amount: bigint;
  valueInSy: bigint;
  valueUsd: number;
}

export interface EnhancedPosition {
  market: MarketData;

  // Token balances with values
  sy: PositionValue;
  pt: PositionValue;
  yt: PositionValue;
  lp: PositionValue;

  // Yield tracking
  yield: {
    claimable: bigint;
    claimableUsd: number;
    claimed: bigint;        // Historical claimed
    claimedUsd: number;
  };

  // LP details
  lpDetails: {
    sharePercent: number;
    underlyingSy: bigint;
    underlyingPt: bigint;
    fees: bigint;           // Accrued fees
  };

  // P&L
  pnl: {
    unrealizedSy: bigint;   // Current value - cost basis
    unrealizedUsd: number;
    realizedSy: bigint;     // From closed positions
    realizedUsd: number;
    totalPnlPercent: number;
  };

  // Redemption status
  redemption: {
    canRedeemPtYt: boolean;
    canRedeemPtPostExpiry: boolean;
    ptRedemptionValue: bigint; // What PT is worth at maturity
  };
}

export interface PortfolioSummary {
  totalValueUsd: number;
  totalPnlUsd: number;
  totalPnlPercent: number;
  totalClaimableUsd: number;
  positions: EnhancedPosition[];
}
```

#### 4.2 Price Oracle Hook

```typescript
// packages/frontend/src/hooks/usePrices.ts

import { useQuery } from '@tanstack/react-query';

// Token price mapping (from Pragma or external API)
export interface TokenPrices {
  strk: number;
  eth: number;
  nstStrk: number;
  sStrk: number;
  wstEth: number;
}

export function usePrices() {
  return useQuery({
    queryKey: ['token-prices'],
    queryFn: async (): Promise<TokenPrices> => {
      // Option 1: Fetch from Pragma
      // const pragma = new PragmaClient();
      // return pragma.getSpotPrices(['STRK', 'ETH', ...]);

      // Option 2: Fetch from CoinGecko/similar
      const response = await fetch(
        'https://api.coingecko.com/api/v3/simple/price?ids=starknet,ethereum&vs_currencies=usd'
      );
      const data = await response.json();

      return {
        strk: data.starknet?.usd ?? 0,
        eth: data.ethereum?.usd ?? 0,
        // Derive LST prices from exchange rates
        nstStrk: data.starknet?.usd * 1.05, // ~5% premium
        sStrk: data.starknet?.usd * 1.03,
        wstEth: data.ethereum?.usd * 1.15,
      };
    },
    staleTime: 60_000, // 1 minute
    refetchInterval: 60_000,
  });
}

export function useSyPriceUsd(syAddress: string): number {
  const { data: prices } = usePrices();
  const { data: syData } = useSyData(syAddress);

  if (!prices || !syData) return 0;

  // Map SY to base token price
  const basePrice = getSyBasePrice(syAddress, prices);
  const exchangeRate = Number(syData.exchangeRate) / 1e18;

  return basePrice * exchangeRate;
}
```

#### 4.3 Position Value Calculator

```typescript
// packages/frontend/src/lib/position/value.ts

import { EnhancedPosition, PositionValue } from '@/types/position';
import { MarketData } from '@/types/market';

export function calculatePositionValue(
  balance: bigint,
  priceInSy: bigint,
  syPriceUsd: number
): PositionValue {
  const valueInSy = (balance * priceInSy) / WAD;
  const valueUsd = Number(valueInSy) / 1e18 * syPriceUsd;

  return {
    amount: balance,
    valueInSy,
    valueUsd,
  };
}

export function calculatePtPriceInSy(
  lnImpliedRate: bigint,
  timeToExpiry: bigint
): bigint {
  // pt_price = e^(-ln_rate * time_in_years)
  const timeInYears = Number(timeToExpiry) / 31_536_000;
  const rate = Number(lnImpliedRate) / 1e18;
  const price = Math.exp(-rate * timeInYears);
  return BigInt(Math.floor(price * 1e18));
}

export function calculateYtPriceInSy(
  lnImpliedRate: bigint,
  timeToExpiry: bigint
): bigint {
  // yt_price = 1 - pt_price
  const ptPrice = calculatePtPriceInSy(lnImpliedRate, timeToExpiry);
  return WAD - ptPrice;
}

export function calculateLpValue(
  lpBalance: bigint,
  totalLp: bigint,
  syReserve: bigint,
  ptReserve: bigint,
  ptPriceInSy: bigint
): { valueInSy: bigint; underlyingSy: bigint; underlyingPt: bigint } {
  if (totalLp === 0n) {
    return { valueInSy: 0n, underlyingSy: 0n, underlyingPt: 0n };
  }

  // LP share of reserves
  const underlyingSy = (lpBalance * syReserve) / totalLp;
  const underlyingPt = (lpBalance * ptReserve) / totalLp;

  // Value in SY terms
  const ptValueInSy = (underlyingPt * ptPriceInSy) / WAD;
  const valueInSy = underlyingSy + ptValueInSy;

  return { valueInSy, underlyingSy, underlyingPt };
}
```

#### 4.4 P&L Tracking

```typescript
// packages/frontend/src/lib/position/pnl.ts

// Store cost basis in localStorage
const COST_BASIS_KEY = 'horizon_cost_basis';

export interface CostBasis {
  marketAddress: string;
  tokenType: 'sy' | 'pt' | 'yt' | 'lp';
  totalCost: bigint;      // Total SY spent
  totalAmount: bigint;    // Total tokens acquired
  avgCost: bigint;        // Average cost per token (WAD)
}

export function loadCostBasis(): Map<string, CostBasis> {
  try {
    const data = localStorage.getItem(COST_BASIS_KEY);
    if (!data) return new Map();

    const entries = JSON.parse(data, (key, value) => {
      if (typeof value === 'string' && value.startsWith('0x')) {
        return BigInt(value);
      }
      return value;
    });

    return new Map(entries);
  } catch {
    return new Map();
  }
}

export function saveCostBasis(basis: Map<string, CostBasis>) {
  const entries = Array.from(basis.entries());
  const data = JSON.stringify(entries, (key, value) => {
    if (typeof value === 'bigint') {
      return '0x' + value.toString(16);
    }
    return value;
  });
  localStorage.setItem(COST_BASIS_KEY, data);
}

export function updateCostBasis(
  market: string,
  tokenType: 'sy' | 'pt' | 'yt' | 'lp',
  amountIn: bigint,
  costInSy: bigint
) {
  const basis = loadCostBasis();
  const key = `${market}-${tokenType}`;

  const existing = basis.get(key) || {
    marketAddress: market,
    tokenType,
    totalCost: 0n,
    totalAmount: 0n,
    avgCost: 0n,
  };

  const newTotalCost = existing.totalCost + costInSy;
  const newTotalAmount = existing.totalAmount + amountIn;
  const newAvgCost = newTotalAmount > 0n
    ? (newTotalCost * WAD) / newTotalAmount
    : 0n;

  basis.set(key, {
    ...existing,
    totalCost: newTotalCost,
    totalAmount: newTotalAmount,
    avgCost: newAvgCost,
  });

  saveCostBasis(basis);
}

export function calculateUnrealizedPnl(
  currentAmount: bigint,
  currentPriceInSy: bigint,
  avgCostInSy: bigint
): { pnlSy: bigint; pnlPercent: number } {
  const currentValue = (currentAmount * currentPriceInSy) / WAD;
  const costBasis = (currentAmount * avgCostInSy) / WAD;
  const pnlSy = currentValue - costBasis;
  const pnlPercent = costBasis > 0n
    ? Number((pnlSy * 10000n) / costBasis) / 100
    : 0;

  return { pnlSy, pnlPercent };
}
```

#### 4.5 Enhanced usePositions Hook

```typescript
// packages/frontend/src/hooks/useEnhancedPositions.ts

import { useQuery } from '@tanstack/react-query';
import { useAccount } from './useAccount';
import { useMarkets } from './useMarkets';
import { usePrices } from './usePrices';
import { loadCostBasis, calculateUnrealizedPnl } from '@/lib/position/pnl';
import {
  calculatePositionValue,
  calculatePtPriceInSy,
  calculateYtPriceInSy,
  calculateLpValue,
} from '@/lib/position/value';
import { EnhancedPosition, PortfolioSummary } from '@/types/position';

export function useEnhancedPositions(): {
  data: PortfolioSummary | null;
  isLoading: boolean;
} {
  const { address } = useAccount();
  const { data: markets } = useMarkets();
  const { data: prices } = usePrices();

  return useQuery({
    queryKey: ['enhanced-positions', address],
    queryFn: async (): Promise<PortfolioSummary> => {
      if (!address || !markets || !prices) {
        return {
          totalValueUsd: 0,
          totalPnlUsd: 0,
          totalPnlPercent: 0,
          totalClaimableUsd: 0,
          positions: [],
        };
      }

      const costBasis = loadCostBasis();
      const positions: EnhancedPosition[] = [];

      for (const market of markets) {
        // Fetch balances
        const [syBal, ptBal, ytBal, lpBal, claimable] = await Promise.all([
          getSyBalance(market.syAddress, address),
          getPtBalance(market.ptAddress, address),
          getYtBalance(market.ytAddress, address),
          getLpBalance(market.address, address),
          getClaimableYield(market.ytAddress, address),
        ]);

        // Skip if no position
        if (syBal + ptBal + ytBal + lpBal === 0n) continue;

        // Calculate prices
        const now = BigInt(Math.floor(Date.now() / 1000));
        const timeToExpiry = market.expiry > now ? market.expiry - now : 1n;
        const ptPrice = calculatePtPriceInSy(market.state.lnImpliedRate, timeToExpiry);
        const ytPrice = calculateYtPriceInSy(market.state.lnImpliedRate, timeToExpiry);
        const syPriceUsd = getSyPriceUsd(market.syAddress, prices);

        // Calculate position values
        const sy = calculatePositionValue(syBal, WAD, syPriceUsd);
        const pt = calculatePositionValue(ptBal, ptPrice, syPriceUsd);
        const yt = calculatePositionValue(ytBal, ytPrice, syPriceUsd);

        // LP value
        const lpValue = calculateLpValue(
          lpBal,
          market.state.totalLp,
          market.state.syReserve,
          market.state.ptReserve,
          ptPrice
        );
        const lp: PositionValue = {
          amount: lpBal,
          valueInSy: lpValue.valueInSy,
          valueUsd: Number(lpValue.valueInSy) / 1e18 * syPriceUsd,
        };

        // P&L calculation
        const ptCostBasis = costBasis.get(`${market.address}-pt`);
        const ptPnl = ptCostBasis
          ? calculateUnrealizedPnl(ptBal, ptPrice, ptCostBasis.avgCost)
          : { pnlSy: 0n, pnlPercent: 0 };

        // Build position
        positions.push({
          market,
          sy,
          pt,
          yt,
          lp,
          yield: {
            claimable,
            claimableUsd: Number(claimable) / 1e18 * syPriceUsd,
            claimed: 0n, // TODO: Track historical claims
            claimedUsd: 0,
          },
          lpDetails: {
            sharePercent: market.state.totalLp > 0n
              ? Number((lpBal * 10000n) / market.state.totalLp) / 100
              : 0,
            underlyingSy: lpValue.underlyingSy,
            underlyingPt: lpValue.underlyingPt,
            fees: 0n, // TODO: Track accrued fees
          },
          pnl: {
            unrealizedSy: ptPnl.pnlSy,
            unrealizedUsd: Number(ptPnl.pnlSy) / 1e18 * syPriceUsd,
            realizedSy: 0n,
            realizedUsd: 0,
            totalPnlPercent: ptPnl.pnlPercent,
          },
          redemption: {
            canRedeemPtYt: ptBal > 0n && ytBal > 0n && !market.isExpired,
            canRedeemPtPostExpiry: ptBal > 0n && market.isExpired,
            ptRedemptionValue: ptBal, // 1:1 at maturity
          },
        });
      }

      // Calculate totals
      const totalValueUsd = positions.reduce(
        (sum, p) => sum + p.sy.valueUsd + p.pt.valueUsd + p.yt.valueUsd + p.lp.valueUsd,
        0
      );
      const totalPnlUsd = positions.reduce(
        (sum, p) => sum + p.pnl.unrealizedUsd + p.pnl.realizedUsd,
        0
      );
      const totalClaimableUsd = positions.reduce(
        (sum, p) => sum + p.yield.claimableUsd,
        0
      );

      return {
        totalValueUsd,
        totalPnlUsd,
        totalPnlPercent: totalValueUsd > 0 ? (totalPnlUsd / totalValueUsd) * 100 : 0,
        totalClaimableUsd,
        positions,
      };
    },
    enabled: !!address && !!markets && !!prices,
    staleTime: 30_000,
    refetchInterval: 30_000,
  });
}
```

#### 4.6 Portfolio Dashboard Component

```typescript
// packages/frontend/src/components/portfolio/PortfolioDashboard.tsx

import { useEnhancedPositions } from '@/hooks/useEnhancedPositions';
import { PositionCard } from './PositionCard';

export function PortfolioDashboard() {
  const { data: portfolio, isLoading } = useEnhancedPositions();

  if (isLoading) return <PortfolioSkeleton />;
  if (!portfolio || portfolio.positions.length === 0) {
    return <EmptyPortfolio />;
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <SummaryCard
          label="Total Value"
          value={formatUsd(portfolio.totalValueUsd)}
        />
        <SummaryCard
          label="Unrealized P&L"
          value={formatUsd(portfolio.totalPnlUsd)}
          subValue={`${portfolio.totalPnlPercent.toFixed(2)}%`}
          variant={portfolio.totalPnlUsd >= 0 ? 'positive' : 'negative'}
        />
        <SummaryCard
          label="Claimable Yield"
          value={formatUsd(portfolio.totalClaimableUsd)}
          action={
            <Button size="sm" onClick={handleClaimAll}>
              Claim All
            </Button>
          }
        />
        <SummaryCard
          label="Active Positions"
          value={portfolio.positions.length.toString()}
        />
      </div>

      {/* Position List */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Your Positions</h2>
        {portfolio.positions.map((position) => (
          <PositionCard key={position.market.address} position={position} />
        ))}
      </div>
    </div>
  );
}
```

#### 4.7 Position Card Component

```typescript
// packages/frontend/src/components/portfolio/PositionCard.tsx

import { EnhancedPosition } from '@/types/position';

interface PositionCardProps {
  position: EnhancedPosition;
}

export function PositionCard({ position }: PositionCardProps) {
  const { market, sy, pt, yt, lp, yield: yieldData, pnl, lpDetails } = position;

  return (
    <div className="border rounded-lg p-4">
      {/* Header */}
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="font-medium">{market.metadata?.yieldTokenSymbol}</h3>
          <p className="text-sm text-gray-500">
            Expires {formatExpiry(market.expiry)}
          </p>
        </div>
        <div className="text-right">
          <div className="font-medium">
            {formatUsd(sy.valueUsd + pt.valueUsd + yt.valueUsd + lp.valueUsd)}
          </div>
          <div className={`text-sm ${pnl.unrealizedUsd >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {pnl.unrealizedUsd >= 0 ? '+' : ''}{formatUsd(pnl.unrealizedUsd)}
            ({pnl.totalPnlPercent.toFixed(2)}%)
          </div>
        </div>
      </div>

      {/* Token Balances */}
      <div className="grid grid-cols-4 gap-4 mb-4">
        {sy.amount > 0n && (
          <TokenBalance label="SY" amount={sy.amount} valueUsd={sy.valueUsd} />
        )}
        {pt.amount > 0n && (
          <TokenBalance label="PT" amount={pt.amount} valueUsd={pt.valueUsd} />
        )}
        {yt.amount > 0n && (
          <TokenBalance label="YT" amount={yt.amount} valueUsd={yt.valueUsd} />
        )}
        {lp.amount > 0n && (
          <TokenBalance
            label="LP"
            amount={lp.amount}
            valueUsd={lp.valueUsd}
            subtitle={`${lpDetails.sharePercent.toFixed(2)}% of pool`}
          />
        )}
      </div>

      {/* LP Details */}
      {lp.amount > 0n && (
        <div className="bg-gray-50 rounded p-3 mb-4">
          <div className="text-sm font-medium mb-2">LP Composition</div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-gray-500">SY:</span>{' '}
              {formatWad(lpDetails.underlyingSy)}
            </div>
            <div>
              <span className="text-gray-500">PT:</span>{' '}
              {formatWad(lpDetails.underlyingPt)}
            </div>
          </div>
        </div>
      )}

      {/* Yield Section */}
      {yt.amount > 0n && yieldData.claimable > 0n && (
        <div className="flex items-center justify-between p-3 bg-green-50 rounded mb-4">
          <div>
            <div className="text-sm text-green-600">Claimable Yield</div>
            <div className="font-medium text-green-700">
              {formatWad(yieldData.claimable)} SY
              <span className="text-sm ml-1">
                ({formatUsd(yieldData.claimableUsd)})
              </span>
            </div>
          </div>
          <Button size="sm" onClick={() => handleClaimYield(market.ytAddress)}>
            Claim
          </Button>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        {position.redemption.canRedeemPtYt && (
          <Button variant="outline" size="sm">
            Redeem PT+YT
          </Button>
        )}
        {position.redemption.canRedeemPtPostExpiry && (
          <Button variant="outline" size="sm">
            Redeem PT
          </Button>
        )}
        {lp.amount > 0n && (
          <Button variant="outline" size="sm">
            Remove Liquidity
          </Button>
        )}
      </div>
    </div>
  );
}

function TokenBalance({
  label,
  amount,
  valueUsd,
  subtitle,
}: {
  label: string;
  amount: bigint;
  valueUsd: number;
  subtitle?: string;
}) {
  return (
    <div>
      <div className="text-xs text-gray-500">{label}</div>
      <div className="font-medium">{formatWadCompact(amount)}</div>
      <div className="text-xs text-gray-400">{formatUsd(valueUsd)}</div>
      {subtitle && <div className="text-xs text-gray-400">{subtitle}</div>}
    </div>
  );
}
```

---

## 5. Implementation Timeline

### Week 1-2: SDK Foundation

| Day | Task | Deliverable |
|-----|------|-------------|
| 1-2 | Set up SDK package structure | `packages/sdk/` scaffolding |
| 3-4 | Port math library from frontend | `src/math/` module |
| 5-6 | Implement quote functions | `src/quotes/` module |
| 7-8 | Implement transaction builders | `src/builders/` module |
| 9-10 | Add tests and documentation | Tests + README |

### Week 3: Price Impact & AMM Math

| Day | Task | Deliverable |
|-----|------|-------------|
| 1-2 | Port full AMM curve math | `lib/math/amm.ts` |
| 3-4 | Update SwapForm with accurate quotes | Updated `SwapForm.tsx` |
| 5 | Add price impact warnings | `PriceImpactWarning.tsx` |

### Week 4: APY Breakdown

| Day | Task | Deliverable |
|-----|------|-------------|
| 1-2 | Implement APY calculation functions | `lib/math/apy-breakdown.ts` |
| 3-4 | Create APY breakdown components | `ApyBreakdown.tsx` |
| 5 | Integrate into market views | Updated market pages |

### Week 5: Position Tracking

| Day | Task | Deliverable |
|-----|------|-------------|
| 1 | Set up price oracle hook | `usePrices.ts` |
| 2-3 | Implement position value calculation | `lib/position/` |
| 4 | Add P&L tracking with localStorage | `lib/position/pnl.ts` |
| 5 | Build portfolio dashboard | `PortfolioDashboard.tsx` |

### Week 6: Integration & Polish

| Day | Task | Deliverable |
|-----|------|-------------|
| 1-2 | Integrate SDK with frontend hooks | Updated hooks |
| 3-4 | End-to-end testing | Test coverage |
| 5 | Documentation and cleanup | Updated docs |

---

## Dependencies

### New Packages to Install

```bash
# SDK package
cd packages/sdk
bun add starknet bignumber.js
bun add -D tsup typescript vitest

# Frontend updates (if not already installed)
cd packages/frontend
bun add bignumber.js
```

### Environment Variables

```env
# For price oracle (optional)
NEXT_PUBLIC_COINGECKO_API_KEY=your_key

# For Pragma integration (optional)
NEXT_PUBLIC_PRAGMA_API_KEY=your_key
```

---

## Success Metrics

1. **SDK Package**
   - [ ] Published to npm as `@horizon/sdk`
   - [ ] Full TypeScript types
   - [ ] 80%+ test coverage
   - [ ] Documentation site

2. **Price Impact**
   - [ ] Quote matches on-chain output within 0.1%
   - [ ] Price impact displayed for all swaps
   - [ ] Warning shown for >1% impact

3. **APY Breakdown**
   - [ ] Shows all APY components
   - [ ] Updates in real-time
   - [ ] Tooltips explain each component

4. **Position Tracking**
   - [ ] USD values for all positions
   - [ ] P&L calculation working
   - [ ] Portfolio dashboard complete
   - [ ] Batch claim functionality

---

*Document created: December 2025*
*Target completion: 6 weeks*
