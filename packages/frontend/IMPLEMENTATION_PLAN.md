# Frontend Implementation Plan: Spec Compliance Gaps

> Generated: 2025-12-29 | Source: SPEC.md Section 7 (Frontend Architecture) cross-referenced with codebase analysis

## Executive Summary

This plan addresses **5 specific gaps** between the SPEC.md requirements and the current frontend implementation. Each gap includes exact file locations, implementation steps, validation criteria, and failure modes.

---

## Gap 1: Near-Expiry Warning Banners

### Spec Requirement (Section 7.2)
> "Warning banners displayed as expiry approaches. Trading remains enabled (user responsibility)."

### Current State
- `ExpiryBadge` and `ExpiryCountdown` exist in `src/widgets/display/ExpiryCountdown.tsx`
- These only display time remaining, no warning semantics
- No threshold-based warning system

### Implementation Steps

#### Step 1.1: Create NearExpiryWarning Component
**File**: `src/shared/ui/NearExpiryWarning.tsx` (new)

```typescript
interface NearExpiryWarningProps {
  expiryTimestamp: number;
  thresholds?: { days: number; severity: 'info' | 'warning' | 'critical' }[];
  context?: 'swap' | 'mint' | 'portfolio';
}
```

**Implementation Details**:
- Default thresholds: `[{ days: 7, severity: 'info' }, { days: 3, severity: 'warning' }, { days: 1, severity: 'critical' }]`
- Uses existing `daysToExpiry()` from `src/shared/math/yield.ts:15`
- Severity maps to Tailwind classes: `bg-blue-500/10`, `bg-amber-500/10`, `bg-red-500/10`
- Context-aware messaging:
  - `swap`: "Market expires in X days. Trading will cease at expiry."
  - `mint`: "Position will mature in X days."
  - `portfolio`: "Claim any accrued yield before expiry."

**Validation**:
1. Unit test: Component renders correct severity for each threshold
2. Visual test: Check all three severity levels appear correctly
3. Edge case: Expired markets show "Expired" state (not warning)

**Failure Modes**:
- Missing threshold prop silently uses defaults
- Expired positions handled by `isExpired()` check before rendering warning

#### Step 1.2: Create useExpiryStatus Hook
**File**: `src/shared/hooks/useExpiryStatus.ts` (new)

```typescript
export function useExpiryStatus(expiryTimestamp: number): {
  isExpired: boolean;
  daysRemaining: number;
  isNearExpiry: boolean;
  severity: 'none' | 'info' | 'warning' | 'critical';
}
```

**Implementation Details**:
- Wraps existing `isExpired()` and `daysToExpiry()` from `src/shared/math/yield.ts`
- Reactive: Updates when timestamp changes
- Single source of truth for expiry logic across all components

**Validation**:
1. Test: Returns correct severity at threshold boundaries
2. Test: Handles edge case of expiry at midnight

#### Step 1.3: Integrate into SwapForm
**File**: `src/features/swap/ui/SwapForm.tsx` (line ~509, after toggle groups)

**Change**:
```typescript
// After the toggle groups, before FormInputSection
{!market.isExpired && (
  <NearExpiryWarning expiryTimestamp={market.expiry} context="swap" />
)}
```

**Validation**:
1. E2E test: Warning appears when market is 3 days from expiry
2. Manual: Verify warning doesn't block swap action

#### Step 1.4: Integrate into MintForm
**File**: `src/features/mint/ui/MintForm.tsx` (line ~155, after FormHeader)

**Change**:
```typescript
// After FormHeader, before FormInputSection
<NearExpiryWarning expiryTimestamp={market.expiry} context="mint" />
```

**Validation**:
1. E2E test: Warning visible during mint flow
2. Manual: Ensure ExpiryBadge and NearExpiryWarning don't redundantly show same info

---

## Gap 2: YT Expiry Notifications in Portfolio

### Spec Requirement (Section 7.2)
> "Dashboard warnings only (no email/push). Users responsible for claiming interest before expiry. YT becomes worthless at expiry (by design)."

### Current State
- `SimplePortfolio.tsx` shows "Matured" text for expired positions (line 229)
- No urgent warning for near-expiry YT positions
- No "claim before expiry" reminder

### Implementation Steps

#### Step 2.1: Create YieldExpiryAlert Component
**File**: `src/features/portfolio/ui/YieldExpiryAlert.tsx` (new)

```typescript
interface YieldExpiryAlertProps {
  expiryTimestamp: number;
  claimableAmount: bigint;
  claimableUsd: number;
  onClaim: () => void;
  isClaiming: boolean;
}
```

**Implementation Details**:
- Only renders if: `daysRemaining <= 7 && claimableAmount > 0n`
- Critical variant (red) if: `daysRemaining <= 1`
- Message: "Your YT position has ${claimableUsd} in unclaimed yield. Claim before {expiryDate} or it will be lost."
- Includes inline "Claim Now" button
- Accessible: `role="alert"`, `aria-live="assertive"` for critical

**Validation**:
1. Test: Only appears when both conditions met (near expiry AND claimable > 0)
2. Test: Critical styling at 1 day threshold
3. E2E: Click "Claim Now" triggers claim flow

#### Step 2.2: Integrate into SimplePositionCard
**File**: `src/widgets/portfolio/SimplePortfolio.tsx` (line ~259, before claimable yield section)

**Current code at line 259**:
```typescript
{/* Claimable Yield */}
{hasClaimableYield && (
  <div className="border-primary/30 bg-primary/10 mb-4 rounded-lg border p-3">
```

**Change to**:
```typescript
{/* YT Expiry Alert (near-expiry with claimable yield) */}
{hasClaimableYield && daysToExpiry(market.expiry) <= 7 && !market.isExpired && (
  <YieldExpiryAlert
    expiryTimestamp={market.expiry}
    claimableAmount={yieldData.claimable}
    claimableUsd={yieldData.claimableUsd ?? 0}
    onClaim={handleClaim}
    isClaiming={isClaiming}
  />
)}

{/* Standard Claimable Yield (not near expiry) */}
{hasClaimableYield && (daysToExpiry(market.expiry) > 7 || market.isExpired) && (
  <div className="border-primary/30 bg-primary/10 mb-4 rounded-lg border p-3">
    ...existing code...
  </div>
)}
```

**Dependencies**:
- Import `daysToExpiry` from `@shared/math/yield`
- Create `YieldExpiryAlert` component

**Validation**:
1. E2E: Position with 5 days to expiry shows alert, not standard card
2. E2E: Position with 10 days to expiry shows standard card
3. Test: Alert has correct ARIA attributes

#### Step 2.3: Add Portfolio-Level Summary Alert
**File**: `src/widgets/portfolio/SimplePortfolio.tsx` (line ~123, before positions list)

**Change**: Add summary alert above position list if any position is near expiry:

```typescript
{/* Portfolio-level expiry warning */}
{activePositions.some(p =>
  daysToExpiry(p.market.expiry) <= 7 &&
  p.yield.claimable > 0n &&
  !p.market.isExpired
) && (
  <Alert variant="warning">
    <AlertTitle>Yield expiring soon</AlertTitle>
    <AlertDescription>
      You have positions with yield that will expire soon.
      Claim your yield before expiry to avoid loss.
    </AlertDescription>
  </Alert>
)}
```

**Validation**:
1. E2E: Alert appears when any position meets criteria
2. Manual: Alert is visually prominent but not blocking

---

## Gap 3: Interest Claim Threshold Warning

### Spec Requirement (Section 7.2)
> "Frontend shows warning if claim amount is too small relative to gas."

### Current State
- `useClaimYield()` at `src/features/yield/model/useYield.ts` has no gas comparison
- `GasEstimate` component exists at `src/shared/ui/GasEstimate.tsx`
- No integration between claimable value and gas cost

### Implementation Steps

#### Step 3.1: Create useClaimGasCheck Hook
**File**: `src/features/yield/model/useClaimGasCheck.ts` (new)

```typescript
interface ClaimGasCheck {
  isWorthClaiming: boolean;
  claimableUsd: number;
  estimatedGasUsd: number;
  ratio: number; // claimable / gas
  formattedGas: string;
  isLoading: boolean;
}

export function useClaimGasCheck(
  ytAddress: string,
  claimableAmount: bigint
): ClaimGasCheck
```

**Implementation Details**:
1. Build claim call using `getYTContract(ytAddress, account).populate('redeem_due_interest', [address])`
2. Pass to existing `useEstimateFee()` hook from `src/shared/hooks/useEstimateFee.ts`
3. Compare claimable value (from `claimableUsd` in position) to gas (convert STRK to USD using price)
4. Threshold: `isWorthClaiming = ratio > 2.0` (claim must be worth 2x gas cost)

**Dependencies**:
- `useEstimateFee` from `@shared/hooks`
- `getYTContract` from `@shared/starknet/contracts`
- Price data for STRK→USD conversion (from existing price hooks)

**Validation**:
1. Test: Returns `isWorthClaiming: false` when gas > claimable/2
2. Test: Handles loading state correctly
3. Test: Edge case: Zero claimable returns `isWorthClaiming: false`

#### Step 3.2: Create ClaimValueWarning Component
**File**: `src/features/yield/ui/ClaimValueWarning.tsx` (new)

```typescript
interface ClaimValueWarningProps {
  claimableUsd: number;
  estimatedGasUsd: number;
  onProceedAnyway: () => void;
}
```

**Implementation Details**:
- Warning text: "This claim costs ~${gasUsd} in gas fees for ${claimableUsd} in yield. Consider waiting for more yield to accumulate."
- Yellow/amber warning styling
- "Claim Anyway" button for users who want to proceed
- Hidden when `claimableUsd > estimatedGasUsd * 2`

**Validation**:
1. Test: Renders when ratio < 2
2. Test: Hidden when ratio >= 2
3. E2E: "Claim Anyway" button works

#### Step 3.3: Integrate into SimplePositionCard
**File**: `src/widgets/portfolio/SimplePortfolio.tsx` (line ~268, inside claimable yield section)

**Change**:
```typescript
{hasClaimableYield && (
  <div className="border-primary/30 bg-primary/10 mb-4 rounded-lg border p-3">
    <div className="flex items-center justify-between">
      <div>
        <div className="text-primary text-sm">Claimable Yield</div>
        <div className="text-primary font-medium">
          {formatWadCompact(yieldData.claimable)} {tokenSymbol}
        </div>
      </div>
      <Button size="sm" variant="default" onClick={handleClaim} disabled={isClaiming}>
        {isClaiming ? 'Claiming...' : 'Claim'}
      </Button>
    </div>

    {/* NEW: Gas cost warning */}
    <ClaimGasWarning
      ytAddress={market.ytAddress}
      claimableAmount={yieldData.claimable}
      claimableUsd={yieldData.claimableUsd}
    />
  </div>
)}
```

**Note**: May need to restructure claim button to be inside `ClaimGasWarning` for conditional rendering.

**Validation**:
1. E2E: Warning appears for small claims
2. E2E: Warning hidden for substantial claims
3. Manual: Gas estimation loads asynchronously, doesn't block UI

---

## Gap 4: Enhanced Error Handling UX

### Spec Requirement (Section 7.2 & 15.3)
> "Currently basic error display (shows wallet/RPC errors). Planned: Custom error parsing with actionable suggestions."

### Current State
- Comprehensive error mapping in `src/shared/lib/errors.ts` (534 lines)
- Functions exist: `getErrorHelpText()`, `getModeAwareErrorMessage()`
- Limited integration: `TxStatus` component uses basic error display

### Implementation Steps

#### Step 4.1: Audit Existing Error Integration
**Files to check**:
- `src/widgets/display/TxStatus.tsx` - How errors are displayed
- `src/features/swap/ui/SwapForm.tsx:729` - Error passed to TxStatus
- `src/features/mint/ui/MintForm.tsx:216` - Error passed to TxStatus

**Current TxStatus usage**:
```typescript
<TxStatus status={status} txHash={txHash} error={error} ... />
```

**Issue**: `error` is raw `Error | null`, not parsed with `parseContractError()`

#### Step 4.2: Enhance TxStatus Component
**File**: `src/widgets/display/TxStatus.tsx`

**Change**: Parse errors and display actionable suggestions

```typescript
import { parseContractError, getErrorHelpText, isSlippageError, isDeadlineError } from '@shared/lib/errors';

// Inside component
const parsedError = error ? parseContractError(error) : null;
const helpText = parsedError ? getErrorHelpText(parsedError) : null;

// In render
{status === 'error' && parsedError && (
  <div className="space-y-2">
    <div className="text-destructive">{parsedError}</div>
    {helpText && (
      <div className="text-muted-foreground text-sm">
        <span className="font-medium">Suggestion:</span> {helpText}
      </div>
    )}
    {isSlippageError(error) && (
      <Button size="sm" variant="outline" onClick={() => /* open settings */}>
        Increase Slippage
      </Button>
    )}
  </div>
)}
```

**Validation**:
1. Test: "HZN: slippage exceeded" shows "Try increasing your slippage tolerance"
2. Test: "HZN: deadline passed" shows appropriate message
3. E2E: Slippage action button opens settings panel

#### Step 4.3: Add Pre-flight Validation for Expired Markets
**File**: `src/features/swap/ui/SwapForm.tsx`

**Current**: No check for `market.isExpired` before swap

**Change** (around line 355):
```typescript
const canSwap =
  isConnected &&
  isValidAmount &&
  !hasInsufficientBalance &&
  !hasInsufficientCollateral &&
  !isSwapping &&
  !isSuccess &&
  !market.isExpired &&  // NEW: Prevent swaps on expired markets
  priceImpactWarning.canProceed;
```

**Change button text** (around line 765):
```typescript
: market.isExpired
  ? 'Market Expired'
```

**Validation**:
1. E2E: Expired market shows "Market Expired" button
2. E2E: Button is disabled for expired markets
3. Test: `canSwap` returns false when `market.isExpired`

#### Step 4.4: Add Pre-flight Validation for MintForm
**File**: `src/features/mint/ui/MintForm.tsx`

**Change** (around line 116):
```typescript
const buttonDisabled =
  !isConnected ||
  !amountSy ||
  amountSy === '0' ||
  !!validationError ||
  isLoading ||
  market.isExpired;  // NEW
```

**Change button text**:
```typescript
if (market.isExpired) return 'Market Expired';
```

**Validation**:
1. E2E: Minting disabled on expired markets
2. Manual: Error state is visually clear

---

## Gap 5: Rate Display Format (Pendle Parity)

### Spec Requirement (Section 7.2)
> "Match Pendle's display format for user familiarity (APY conversion from continuous rates)."

### Current State
- APY calculations in `src/shared/math/apy-breakdown.ts`
- Uses `Math.exp(lnRate) - 1` formula (line 47)
- Pendle uses the same formula, but display may differ

### Implementation Steps

#### Step 5.1: Verify Formula Accuracy
**File**: `src/shared/math/apy-breakdown.ts:47`

**Current**:
```typescript
export function calculatePtFixedApy(lnImpliedRate: bigint): number {
  const lnRate = fromWad(lnImpliedRate).toNumber();
  return Math.exp(lnRate) - 1;
}
```

**Pendle Formula** (from their docs): `APY = e^(ln_implied_rate) - 1`

**Status**: Formula is correct.

**Validation**:
1. Unit test: `calculatePtFixedApy(0.05 WAD)` returns ~5.127% (not 5%)
2. Cross-check with Pendle UI for same ln_implied_rate

#### Step 5.2: Standardize Display Format
**File**: `src/shared/math/apy-breakdown.ts:54`

**Current**:
```typescript
export function formatApyPercent(apy: number): string {
  if (!Number.isFinite(apy)) return '-.--%-';
  return `${(apy * 100).toFixed(2)}%`;
}
```

**Pendle Format**: Typically shows 2 decimal places with color coding.

**Status**: Format matches Pendle.

**Validation**:
1. Visual comparison: Screenshot Pendle UI, compare to Horizon UI
2. Edge cases: Negative APY (YT in loss), very high APY (>1000%)

#### Step 5.3: Document Rate Conversion in Code Comments
**File**: `src/shared/math/apy-breakdown.ts` (add JSDoc)

```typescript
/**
 * Converts ln(implied_rate) to APY percentage.
 *
 * Formula: APY = e^(ln_rate) - 1
 *
 * This matches Pendle's display format for user familiarity.
 * Example: ln_rate of 0.05 WAD → APY of ~5.127%
 *
 * Note: The difference from simple percentage (5% vs 5.127%)
 * is due to continuous compounding.
 */
export function calculatePtFixedApy(lnImpliedRate: bigint): number {
```

---

## Implementation Priority

| Priority | Gap | Effort | Impact | Dependencies |
|----------|-----|--------|--------|--------------|
| **P1** | Gap 3: Claim Threshold Warning | Medium | High | Prevents user loss |
| **P1** | Gap 2: YT Expiry Notifications | Medium | High | Prevents user loss |
| **P2** | Gap 4: Error Handling UX | Low | Medium | Improves debugging |
| **P2** | Gap 1: Near-Expiry Warnings | Medium | Medium | User awareness |
| **P3** | Gap 5: Rate Display Format | Low | Low | Already compliant |

---

## File Change Summary

### New Files (5)
1. `src/shared/ui/NearExpiryWarning.tsx`
2. `src/shared/hooks/useExpiryStatus.ts`
3. `src/features/portfolio/ui/YieldExpiryAlert.tsx`
4. `src/features/yield/model/useClaimGasCheck.ts`
5. `src/features/yield/ui/ClaimValueWarning.tsx`

### Modified Files (5)
1. `src/features/swap/ui/SwapForm.tsx` - Add expiry warning + expired check
2. `src/features/mint/ui/MintForm.tsx` - Add expiry warning + expired check
3. `src/widgets/portfolio/SimplePortfolio.tsx` - Add YT expiry alert + gas warning
4. `src/widgets/display/TxStatus.tsx` - Parse errors with suggestions
5. `src/shared/math/apy-breakdown.ts` - Add documentation comments

---

## Validation Checklist

### Unit Tests
- [ ] `useExpiryStatus` returns correct severity at boundaries
- [ ] `useClaimGasCheck` returns `isWorthClaiming: false` when gas > claimable/2
- [ ] `calculatePtFixedApy` matches Pendle formula

### E2E Tests
- [ ] Near-expiry warning appears on SwapForm when market < 7 days
- [ ] YT expiry alert appears in portfolio for near-expiry positions
- [ ] Claim gas warning appears for small claims
- [ ] Expired market button shows "Market Expired"
- [ ] Error help text appears for slippage errors

### Manual Testing
- [ ] Visual: All warning severities display correctly
- [ ] Visual: Compare APY format to Pendle UI
- [ ] Accessibility: All alerts have correct ARIA attributes
- [ ] Mobile: Warnings don't overflow on small screens

---

## Rollback Plan

Each feature is isolated. If issues arise:

1. **NearExpiryWarning**: Remove import/usage from forms, component is standalone
2. **YieldExpiryAlert**: Revert to original SimplePositionCard code
3. **ClaimGasCheck**: Remove hook usage, claim button works without it
4. **TxStatus changes**: Revert to displaying raw error

All changes are additive except Gap 4's pre-flight checks, which disable functionality. Monitor for false positives in expired market detection.
