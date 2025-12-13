# Frontend Update Plan

## Overview

This document outlines the required frontend changes following smart contract updates:
- ERC-4626 support in SY contract
- Dynamic decimals (SY reads decimals from underlying)
- YT flash swap functions (`swap_exact_sy_for_yt`, `swap_exact_yt_for_sy`)
- Dual-market deployment (nstSTRK + sSTRK)

## Completed Changes

### Phase 1: Address Structure Update (DONE)

Updated address loading to support new dual-market JSON structure.

**Files Modified:**
- `src/lib/constants/addresses.ts` - New types and `getStaticMarkets()` function
- `src/lib/starknet/contracts.ts` - Removed old test setup contract functions

**New Address Types:**
```typescript
interface YieldTokenInfo {
  name: string;
  symbol: string;
  address: string;
  isERC4626: boolean;
}

interface SYTokenInfo {
  address: string;
  underlying: string;
}

interface MarketAddresses {
  PT: string;
  YT: string;
  Market: string;
}

export interface MarketInfo {
  key: string;
  marketAddress: string;
  ptAddress: string;
  ytAddress: string;
  syAddress: string;
  underlyingAddress: string;
  yieldTokenName: string;
  yieldTokenSymbol: string;
  isERC4626: boolean;
  expiry: number;
}
```

### Phase 2: On-Chain Market Discovery (DONE)

Added functionality to read markets from MarketFactory on-chain instead of static JSON.

**Contract Changes:**
- Added `get_all_markets()` to MarketFactory interface
- Added `get_market_count()` to MarketFactory interface
- Added `get_market_at(index)` to MarketFactory interface

**Frontend Changes:**
- `src/hooks/useMarkets.ts` - New hooks:
  - `useMarketAddresses()` - Fetches all market addresses from MarketFactory on-chain
  - `useMarketCount()` - Gets total number of markets
  - Updated `useKnownMarkets()` to use on-chain data with static fallback
  - Updated `useDashboardMarkets()` to use dynamic market discovery

- `src/hooks/useContracts.ts` - Simplified:
  - Removed old `testSY`, `testPT`, `testYT`, `testMarket` properties
  - Added `getMockYieldToken(address)` dynamic getter

---

## Remaining Work

### Phase 3: Dynamic Decimal Support (TODO)

**Problem:** The frontend assumes all tokens use 18 decimals (WAD).

**Affected files:**
- `src/hooks/useMint.ts` - Uses `toWad()` which hardcodes 18 decimals
- `src/hooks/useSwap.ts` - Amount parsing assumes 18 decimals
- `src/hooks/useRedeem.ts` - Output calculations use WAD
- `src/hooks/useLiquidity.ts` - LP calculations assume 18 decimals
- `src/lib/math/wad.ts` - Core math utilities hardcode 18 decimals

**Impact:** If underlying tokens have different decimals (e.g., USDC with 6), all calculations will be off by orders of magnitude.

**Required Changes:**

1. Add decimal-aware math functions to `src/lib/math/wad.ts`:
```typescript
export function parseAmount(value: string | number, decimals: number): bigint;
export function formatAmount(value: bigint, decimals: number, displayDecimals?: number): string;
export function convertDecimals(amount: bigint, fromDecimals: number, toDecimals: number): bigint;
```

2. Create `src/hooks/useTokenDecimals.ts`:
```typescript
export function useTokenDecimals(tokenAddress: string | undefined): {
  decimals: number;
  isLoading: boolean;
}
```

3. Update all hooks to use dynamic decimals instead of `toWad()`.

### Phase 4: YT Flash Swap Integration (TODO)

**Problem:** No UI for YT flash swaps despite Router supporting them.

**Required Changes:**

1. Create `src/hooks/useYtSwap.ts`:
```typescript
export function useSwapSyForYt(): { swap: (params: SwapYtParams) => Promise<string> }
export function useSwapYtForSy(): { swap: (params: SwapYtParams) => Promise<string> }
```

2. Update `src/components/forms/SwapForm.tsx`:
- Add YT as a tradeable token option
- Add swap mode selector: buy_pt, sell_pt, buy_yt, sell_yt

### Phase 5: Exchange Rate Display (TODO)

**Required Changes:**

1. Create `src/hooks/useExchangeRate.ts`:
```typescript
export function useExchangeRate(syAddress: string | undefined): {
  rate: bigint;
  isLoading: boolean;
}
```

2. Create `src/components/display/ExchangeRateDisplay.tsx` to show current exchange rate in mint/redeem forms.

---

## File Changes Summary

### Completed
- `src/lib/constants/addresses.ts` - New dual-market address structure
- `src/lib/starknet/contracts.ts` - Simplified, removed test setup functions
- `src/hooks/useMarkets.ts` - On-chain market discovery
- `src/hooks/useContracts.ts` - Removed test setup contracts

### New Files (Completed)
- None (all changes were modifications)

### New Files (TODO)
- `src/hooks/useTokenDecimals.ts`
- `src/hooks/useYtSwap.ts`
- `src/hooks/useExchangeRate.ts`
- `src/components/display/ExchangeRateDisplay.tsx`
- `src/app/trade/yt/page.tsx` (optional)

### Files to Modify (TODO)
- `src/lib/math/wad.ts` - Dynamic decimal functions
- `src/hooks/useMint.ts` - Dynamic decimals
- `src/hooks/useSwap.ts` - Dynamic decimals + YT option
- `src/hooks/useRedeem.ts` - Dynamic decimals
- `src/hooks/useLiquidity.ts` - Dynamic decimals
- `src/components/forms/SwapForm.tsx` - YT swap modes
- `src/components/forms/MintForm.tsx` - Exchange rate display

---

## Testing Checklist

- [x] Verify address loading works with new JSON structure
- [x] Test market discovery from MarketFactory on-chain
- [x] Frontend typecheck passes
- [ ] Test minting with 18-decimal tokens
- [ ] Test decimal conversion functions
- [ ] Test market selector with multiple markets
- [ ] Test PT/SY swaps still work
- [ ] Test YT flash swap (buy YT)
- [ ] Test YT flash swap (sell YT)
- [ ] Test exchange rate display updates
- [ ] Test slippage calculations with dynamic decimals
- [ ] E2E test full flow: mint → swap → redeem

---

## Implementation Order

1. **Phase 1** - Address structure (DONE)
2. **Phase 2** - On-chain market discovery (DONE)
3. **Phase 3** - Dynamic decimals (TODO - critical for non-18 decimal tokens)
4. **Phase 4** - YT flash swaps (TODO - new feature)
5. **Phase 5** - Exchange rate display (TODO - nice-to-have)
