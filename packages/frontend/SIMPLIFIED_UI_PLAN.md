# Simplified UI Mode Implementation Plan

## Overview

Create an alternative "Simple Mode" for the Horizon Protocol frontend that abstracts DeFi complexity, targeting users who want straightforward yield earning without understanding tokenization mechanics.

## Goals

1. **Toggle between Simple/Advanced modes** - Clear, globally accessible switch
2. **Hide technical jargon** - Replace SY/PT/YT terminology with user-friendly language
3. **Aggregate multi-step flows** - Combine deposit → wrap → mint into single multicall
4. **Financial tone, minimal jargon** - Professional but accessible language
5. **Use existing theme** - shadcn components, semantic colors only

---

## Design Principles

### Language Translation

| Advanced Term | Simple Term |
|--------------|-------------|
| PT (Principal Token) | Fixed-Rate Position |
| YT (Yield Token) | Variable-Rate Position |
| SY (Standardized Yield) | Wrapped Token (hidden from user) |
| Mint PT + YT | Split into Positions |
| Implied APY | Current Rate |
| Long Yield | Variable Yield |
| Fixed Yield | Guaranteed Rate |
| Redeem | Withdraw |
| Maturity/Expiry | Position End Date |
| TVL | Total Deposited |
| Liquidity Provision | Earn Trading Fees (hidden in simple mode) |

### What to Hide in Simple Mode

- SY token entirely (abstract as intermediate step)
- Slippage tolerance controls (use 0.5% default)
- Price impact details (show only if > 1%)
- LP/Pools functionality (advanced only)
- Technical APY breakdowns
- Exchange rate details
- Min output calculations

### What to Show in Simple Mode

- Deposit amount input
- Expected returns (APY as percentage)
- Position end date
- Current balance
- Single "Deposit" or "Withdraw" action button
- Clear success/error feedback

---

## Implementation Plan

### Phase 1: Core Infrastructure

#### 1.1 Create Mode Context

Create a React context to manage Simple/Advanced mode globally.

**File:** `src/contexts/ui-mode-context.tsx`

```typescript
type UIMode = 'simple' | 'advanced';

interface UIModeContextValue {
  mode: UIMode;
  setMode: (mode: UIMode) => void;
  isSimple: boolean;
  isAdvanced: boolean;
}
```

Features:
- Persist preference to localStorage
- Default to 'simple' for new users
- Provide throughout app via context

#### 1.2 Create Mode Toggle Component

**File:** `src/components/mode-toggle.tsx`

Design:
- Use existing `Switch` component from shadcn
- Label: "Simple" | "Advanced" with clear visual state
- Position: Header, right side near wallet connect
- Tooltip explaining the modes
- Subtle animation on toggle

```
┌─────────────────────────────────────────────────────┐
│ [Logo] Horizon     Markets │ Earn │ Portfolio  [Simple ◉──○ Advanced] [Connect] │
└─────────────────────────────────────────────────────┘
```

#### 1.3 Update Header Component

**File:** `src/components/layout/header.tsx`

- Add ModeToggle component
- Responsive: collapse to icon on mobile
- Position between nav and wallet button

---

### Phase 2: Simplified Components

#### 2.1 SimpleEarnForm (replaces MintForm in simple mode)

**File:** `src/components/forms/simple-earn-form.tsx`

Single-step flow combining:
1. Approve underlying token
2. Wrap to SY
3. Mint PT + YT

UI Elements:
- Token selector (underlying assets: nstSTRK, sSTRK, wstETH)
- Amount input with "Max" button
- APY display: "Earn up to X% fixed rate"
- Position end date: "Matures on [Date]"
- Single "Deposit & Earn" button
- Transaction status

```
┌─────────────────────────────────────────┐
│ Earn Fixed Yield                        │
├─────────────────────────────────────────┤
│ Deposit                                 │
│ ┌─────────────────────────────────────┐ │
│ │ [nstSTRK ▼]        [____100___] Max │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ You'll Receive                          │
│ ┌─────────────────────────────────────┐ │
│ │ Fixed-Rate Position    100.00       │ │
│ │ Variable-Rate Position 100.00       │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ 📈 Fixed Rate: 8.5% APY             │ │
│ │ 📅 Matures: March 15, 2025          │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ [        Deposit & Earn        ]        │
└─────────────────────────────────────────┘
```

#### 2.2 SimpleWithdrawForm

**File:** `src/components/forms/simple-withdraw-form.tsx`

Handles:
- Pre-maturity: Redeem PT + YT → SY → underlying
- Post-maturity: Redeem PT → underlying

UI Elements:
- Position selector (show user's positions)
- Amount input or "Withdraw All"
- Expected return amount
- Single "Withdraw" button

#### 2.3 SimplePortfolio

**File:** `src/components/portfolio/simple-portfolio.tsx`

Simplified position display:
- Total deposited value (USD)
- Total earnings (USD)
- Active positions as cards
- Each card: Asset, Amount, Fixed Rate, Maturity Date, Withdraw button

Hide:
- LP positions
- Claimable yield details
- PT/YT breakdown (show as single "position")

#### 2.4 SimpleMarketCard

**File:** `src/components/markets/simple-market-card.tsx`

Simplified market display:
- Asset name and icon
- "Current Fixed Rate: X%"
- "Matures: [Date]"
- "Total Deposited: $X"
- "Earn Now" CTA button

Hide:
- PT/YT reserves
- Implied APY calculations
- Technical market state

---

### Phase 3: Multicall Integration

#### 3.1 Create Combined Transaction Hook

**File:** `src/hooks/use-simple-deposit.ts`

```typescript
interface UseSimpleDepositParams {
  market: Market;
  underlyingToken: Address;
  amount: bigint;
}

// Combines into single multicall:
// 1. Approve underlying → SY contract
// 2. Deposit underlying → SY (wrap)
// 3. Approve SY → Router
// 4. Mint PT + YT from SY
```

#### 3.2 Create Combined Withdraw Hook

**File:** `src/hooks/use-simple-withdraw.ts`

```typescript
interface UseSimpleWithdrawParams {
  market: Market;
  ptAmount: bigint;
  ytAmount: bigint;
}

// Pre-maturity multicall:
// 1. Approve PT → Router
// 2. Approve YT → Router
// 3. Redeem PT + YT → SY
// 4. Unwrap SY → underlying

// Post-maturity:
// 1. Approve PT → Router
// 2. Redeem PT → underlying
```

#### 3.3 Transaction Builder Utility

**File:** `src/lib/transaction-builder.ts`

Utility to build multicall arrays:
- `buildDepositAndEarnCalls()`
- `buildWithdrawCalls()`
- Handle approval checks efficiently
- Estimate gas for combined operations

---

### Phase 4: Page Integration

#### 4.1 Update Earn Page (`/mint`)

**File:** `src/app/mint/page.tsx`

```tsx
function EarnPage() {
  const { isSimple } = useUIMode();

  return isSimple ? <SimpleEarnForm /> : <AdvancedMintTabs />;
}
```

- Simple mode: Show `SimpleEarnForm`
- Advanced mode: Show existing tabbed interface

#### 4.2 Update Portfolio Page

**File:** `src/app/portfolio/page.tsx`

- Simple mode: Show `SimplePortfolio`
- Advanced mode: Show existing detailed view

#### 4.3 Update Markets/Dashboard Page

**File:** `src/app/page.tsx`

- Simple mode: Show `SimpleMarketCard` components
- Advanced mode: Show existing `MarketCard` components

#### 4.4 Navigation Updates

Simple mode navigation:
- Markets (home)
- Earn (deposit)
- Portfolio (positions)

Hide in simple mode:
- Trade page (or show with simplified UI)
- Pools page (LP is advanced)

---

### Phase 5: Polish & UX

#### 5.1 Onboarding Tooltip

First-time users see tooltip on mode toggle:
> "Simple mode shows you straightforward yield earning. Switch to Advanced for full protocol features."

#### 5.2 Mode-Aware Help Text

Update all info panels to use mode-appropriate language:
- Simple: "Your deposit earns a fixed rate until the position matures"
- Advanced: "PT tokens represent your principal, redeemable 1:1 at maturity"

#### 5.3 Transition Animation

Smooth transition when switching modes:
- Fade out current view
- Fade in new view
- Preserve form state where possible

#### 5.4 Error Messages

Simplified error messages:
- Advanced: "Insufficient SY balance for mint operation"
- Simple: "Not enough tokens to deposit"

---

## File Structure

```
src/
├── contexts/
│   └── ui-mode-context.tsx          # NEW: Mode context
├── components/
│   ├── mode-toggle.tsx              # NEW: Toggle component
│   ├── forms/
│   │   ├── simple-earn-form.tsx     # NEW: Combined deposit form
│   │   └── simple-withdraw-form.tsx # NEW: Combined withdraw form
│   ├── portfolio/
│   │   └── simple-portfolio.tsx     # NEW: Simplified positions
│   └── markets/
│       └── simple-market-card.tsx   # NEW: Simplified market card
├── hooks/
│   ├── use-simple-deposit.ts        # NEW: Combined deposit hook
│   └── use-simple-withdraw.ts       # NEW: Combined withdraw hook
└── lib/
    └── transaction-builder.ts       # NEW: Multicall builder
```

---

## Component Styling Guidelines

All components must use:

1. **Existing shadcn components:** Card, Button, Input, Badge, Switch, etc.
2. **Semantic color variables only:**
   - `bg-background`, `bg-card`, `bg-muted`
   - `text-foreground`, `text-muted-foreground`
   - `border-border`, `border-input`
   - `text-primary`, `bg-primary`
   - `text-destructive` for errors
3. **Existing spacing scale:** Tailwind classes (`p-4`, `gap-2`, `space-y-4`)
4. **Existing typography:** `font-sans`, `font-mono` for numbers
5. **Existing radius:** `rounded-md`, `rounded-lg` via CSS variables

**No hardcoded colors.** Use only:
```css
/* Allowed */
className="bg-card text-foreground border-border"
className="text-muted-foreground"
className="bg-primary text-primary-foreground"

/* NOT allowed */
className="bg-[#ff5500]"
className="text-orange-500"
style={{ color: 'rgb(255, 85, 0)' }}
```

---

## Testing Checklist

### Functional Tests
- [ ] Mode toggle persists across page navigation
- [ ] Mode toggle persists across browser refresh
- [ ] Simple deposit creates correct multicall (approve + wrap + mint)
- [ ] Simple withdraw handles pre/post maturity correctly
- [ ] Form validation works in simple mode
- [ ] Transaction status displays correctly

### UI Tests
- [ ] Toggle is clearly visible in header
- [ ] Toggle state is visually obvious
- [ ] All simple mode components use semantic colors only
- [ ] Responsive design works on mobile
- [ ] Dark mode works correctly
- [ ] No DeFi jargon visible in simple mode

### Integration Tests
- [ ] Full deposit flow works end-to-end
- [ ] Full withdraw flow works end-to-end
- [ ] Portfolio displays correct positions
- [ ] Market cards link to correct earn flows

---

## Migration Strategy

1. **Phase 1:** Add mode context and toggle (no UI changes)
2. **Phase 2:** Build simple components alongside existing
3. **Phase 3:** Wire up conditional rendering
4. **Phase 4:** Test thoroughly in both modes
5. **Phase 5:** Deploy with simple mode as default

No breaking changes to existing advanced UI.

---

## Success Metrics

- Users can deposit and earn without knowing what PT/YT means
- Single transaction for deposit flow (vs. 3 separate actions)
- Mode preference is remembered
- Advanced users can still access full functionality
- No visual regressions in advanced mode
