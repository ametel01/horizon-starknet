# UI/UX Laws Implementation Plan

**Horizon Protocol Frontend**
*Comprehensive plan to operationalize UI/UX laws using shadcn/ui components and existing semantic design tokens*

---

## Executive Summary

This document outlines a systematic approach to implement the 27 UI/UX laws documented in `UI-UX_LAWS.md` into the Horizon Protocol frontend. The implementation prioritizes:

1. **Shadcn/ui components** - All changes leverage existing components
2. **Semantic color tokens** - Use existing OKLCH-based color system
3. **Style consistency** - Standardize spacing, sizing, and visual hierarchy across all pages
4. **Progressive enhancement** - Changes are additive and non-breaking

---

## Current State Analysis

### Strengths
- Well-defined OKLCH color system with 15+ semantic tokens
- 25+ shadcn/ui components properly exported
- Comprehensive animation utilities (25+ animation classes)
- Thoughtful micro-interactions (press feedback, hover effects)
- Accessibility-aware focus states

### Gaps Identified
| Issue | UI/UX Law Violated | Impact |
|-------|-------------------|--------|
| Inconsistent button sizes across forms | Fitts's Law | Motor control inefficiency |
| Spacing variance (gap-1 to gap-6) | Gestalt Proximity | Visual confusion |
| All form options visible upfront | Hick's Law | Decision paralysis |
| No < 400ms response guarantee | Doherty Threshold | Perceived slowness |
| Accent color overuse | Von Restorff Effect | Diluted visual hierarchy |
| Missing focus styles on some elements | Feedback Principle | Accessibility gaps |
| Error display after interaction | Error Prevention | User frustration |

---

## Part 1: Design Token Standardization

### 1.1 Spacing Tokens (New)

Add to `globals.css` under `@layer utilities`:

```css
/* Spacing scale for consistent visual rhythm */
--space-section: 1.5rem;    /* 24px - Between form sections */
--space-group: 1rem;        /* 16px - Between related elements */
--space-element: 0.5rem;    /* 8px - Between component parts */
--space-tight: 0.25rem;     /* 4px - Compact spacing */
```

**Usage Pattern:**
- `space-y-6` → Form sections (input → output → actions)
- `space-y-4` → Related element groups
- `space-y-2` → Tight element stacking
- `gap-3` → Inline element spacing

### 1.2 Button Size Strategy (Fitts's Law)

Standardize button sizes by context:

| Context | Size Class | Height | Use Case |
|---------|-----------|--------|----------|
| Primary CTA | `size="xl"` | 48px (h-12) | Form submit buttons |
| Secondary Action | `size="lg"` | 40px (h-10) | Card actions, navigation |
| Inline Action | `size="default"` | 36px (h-9) | Toolbar buttons |
| Compact | `size="sm"` | 32px (h-8) | Dense UI, table actions |
| Icon Button | `size="icon"` | 36px | Toggle, expand buttons |

**Rule:** All form submit buttons MUST use `size="xl"` with `w-full`.

### 1.3 Color Usage Enforcement (60-30-10 Rule)

| Percentage | Token | Usage |
|------------|-------|-------|
| 60% | `bg-background`, `bg-card` | Page and card backgrounds |
| 30% | `bg-muted`, `text-muted-foreground`, `border` | Secondary UI, labels |
| 10% | `bg-primary`, `text-success`, `text-destructive` | CTAs, status indicators |

**Enforcement:** Create ESLint rule to warn on excessive accent color usage.

---

## Part 2: Component-Level Changes

### 2.1 Form Layout Template

Create `FormLayout` component to enforce consistent structure:

```tsx
// src/shared/ui/FormLayout.tsx
interface FormLayoutProps {
  children: React.ReactNode;
  className?: string;
}

export function FormLayout({ children, className }: FormLayoutProps) {
  return (
    <Card className={cn('relative overflow-hidden', className)}>
      <CardContent className="space-y-6 p-5">
        {children}
      </CardContent>
    </Card>
  );
}

// Sub-components for form sections
export function FormInputSection({ children }: { children: React.ReactNode }) {
  return <div className="space-y-4">{children}</div>;
}

export function FormOutputSection({ children }: { children: React.ReactNode }) {
  return (
    <Card className="bg-muted/50">
      <CardContent className="space-y-2 p-4">{children}</CardContent>
    </Card>
  );
}

export function FormInfoSection({ children }: { children: React.ReactNode }) {
  return (
    <Card size="sm" className="bg-muted">
      <CardContent className="p-3 text-sm">{children}</CardContent>
    </Card>
  );
}

export function FormActions({ children }: { children: React.ReactNode }) {
  return <div className="pt-2">{children}</div>;
}
```

### 2.2 Button Component Enhancement

Add semantic variants to support context-specific styling:

```tsx
// Add to buttonVariants in Button.tsx
formPrimary: 'h-12 w-full text-base font-medium bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/25',
formSecondary: 'h-10 w-full bg-secondary text-secondary-foreground hover:bg-secondary/80',
formDestructive: 'h-12 w-full text-base font-medium bg-destructive text-destructive-foreground hover:bg-destructive/90',
```

### 2.3 TokenInput Standardization

Ensure all `TokenInput` components use consistent styling:

```tsx
// Enforce in TokenInput.tsx
<div className="space-y-2">
  <Label className="text-muted-foreground text-xs uppercase tracking-wider">
    {label}
  </Label>
  <Input
    className="h-12 text-lg font-mono tabular-nums"
    // ... other props
  />
</div>
```

---

## Part 3: UI/UX Laws Implementation Matrix

### 3.1 Laws of Speed, Effort, and Motor Control

#### Fitts's Law
| Implementation | Files to Modify |
|----------------|-----------------|
| Standardize primary CTA to `h-12 w-full` | All `*Form.tsx` files |
| Use `size="icon-lg"` (h-10) for icon buttons | `SwapForm.tsx` (swap direction button) |
| Increase hit areas: min 44x44px | Add `touch-target` class to all interactive elements |

**Code Change Example:**
```tsx
// Before
<Button onClick={handleSwap} disabled={!canSwap}>
  {buttonText}
</Button>

// After
<Button
  onClick={handleSwap}
  disabled={!canSwap}
  size="xl"
  className="w-full touch-target"
>
  {buttonText}
</Button>
```

#### Steering Law
| Implementation | Files to Modify |
|----------------|-----------------|
| Widen slider track from 4px to 8px | `slider.tsx` |
| Add padding to dropdown items | `dropdown-menu.tsx`, `select.tsx` |
| Avoid narrow nested menus | Design guideline (no code change) |

#### Doherty Threshold (<400ms)
| Implementation | Files to Modify |
|----------------|-----------------|
| Add optimistic UI for swap/mint actions | `useSwap.ts`, `useMint.ts` |
| Immediate visual feedback on button press | Already implemented via `active:scale-[0.97]` |
| Skeleton loading for data fetches | Already available via `Skeleton` components |
| Reduce animation durations for micro-interactions | Audit `transition-micro` usage (currently 150ms) |

**Optimistic UI Pattern:**
```tsx
// In mutation hooks
const { mutate } = useMutation({
  mutationFn: executeSwap,
  onMutate: async (variables) => {
    // Cancel outgoing queries
    await queryClient.cancelQueries({ queryKey: ['balance'] });

    // Snapshot previous value
    const previousBalance = queryClient.getQueryData(['balance']);

    // Optimistically update
    queryClient.setQueryData(['balance'], (old) => ({
      ...old,
      amount: old.amount - variables.amountIn
    }));

    return { previousBalance };
  },
  onError: (err, variables, context) => {
    // Rollback on error
    queryClient.setQueryData(['balance'], context.previousBalance);
  }
});
```

### 3.2 Laws of Decision Making

#### Hick's Law (Reduce Choice Complexity)
| Implementation | Files to Modify |
|----------------|-----------------|
| Default to "PT" + "Buy" in SwapForm | `SwapForm.tsx` - already implemented |
| Collapse advanced settings by default | `TransactionSettingsPanel.tsx` |
| Progressive disclosure for swap details | `SwapForm.tsx` - already has `Collapsible` |
| Chunk slippage options: "Low/Medium/High" presets | `TransactionSettingsPanel.tsx` |

**Slippage Preset Enhancement:**
```tsx
// Before: Raw percentage input
<Input type="number" value={slippage} onChange={setSlippage} />

// After: Preset buttons with custom option
<ToggleGroup defaultValue="medium">
  <ToggleGroupItem value="low" aria-label="0.1% slippage">
    Conservative (0.1%)
  </ToggleGroupItem>
  <ToggleGroupItem value="medium" aria-label="0.5% slippage">
    Balanced (0.5%)
  </ToggleGroupItem>
  <ToggleGroupItem value="high" aria-label="1% slippage">
    Fast (1%)
  </ToggleGroupItem>
</ToggleGroup>
<Button variant="ghost" size="sm">Custom...</Button>
```

#### Miller's Law (7±2 Chunking)
| Implementation | Files to Modify |
|----------------|-----------------|
| Group form fields into labeled sections | All `*Form.tsx` files |
| Limit visible markets to 5-7, paginate rest | `MarketList.tsx` |
| Chunk transaction details into categories | `TxStatus.tsx` |

**Form Section Pattern:**
```tsx
<FormLayout>
  {/* Section 1: Input */}
  <FormInputSection>
    <TokenInput label="You pay" {...props} />
  </FormInputSection>

  {/* Divider */}
  <SwapDirectionButton />

  {/* Section 2: Output */}
  <FormOutputSection>
    <OutputDisplay {...props} />
  </FormOutputSection>

  {/* Section 3: Details (collapsed) */}
  <Collapsible>...</Collapsible>

  {/* Section 4: Action */}
  <FormActions>
    <Button size="xl" className="w-full">Swap</Button>
  </FormActions>
</FormLayout>
```

#### Paradox of Choice
| Implementation | Files to Modify |
|----------------|-----------------|
| Highlight "recommended" market prominently | `MarketCard.tsx`, `MarketList.tsx` |
| Hide advanced YT trading behind toggle | `SwapForm.tsx` |
| Default to SimpleEarnForm over full MintForm | `earn/page.tsx` |

### 3.3 Laws of Visual Perception & Hierarchy

#### Gestalt Principles (Proximity, Similarity, Common Region)
| Implementation | Files to Modify |
|----------------|-----------------|
| Consistent card padding: `p-5` (20px) | All `Card` usages |
| Use `space-y-6` between form sections | All `*Form.tsx` files |
| Visual grouping via background: `bg-muted/50` | Output sections |
| Remove redundant borders, prefer whitespace | Audit all components |

**Visual Grouping Audit Checklist:**
- [ ] Form inputs grouped with `space-y-4`
- [ ] Output preview in distinct background (`bg-muted/50`)
- [ ] Info sections use `Card size="sm"`
- [ ] No double borders (card + input)

#### Figure-Ground (Contrast)
| Implementation | Files to Modify |
|----------------|-----------------|
| Active content on `bg-card` (elevated) | Cards, dialogs |
| Inactive/reference on `bg-muted` (sunken) | Info panels, disabled states |
| Overlay with `bg-surface-overlay` (80% opacity) | Modals, drawers |

**Already implemented** in color tokens:
```css
--surface-elevated: oklch(0.98 0.001 286);
--surface-sunken: oklch(0.94 0.003 286);
--surface-overlay: oklch(1 0 0 / 80%);
```

#### Von Restorff Effect (Distinctiveness)
| Implementation | Files to Modify |
|----------------|-----------------|
| Single accent color per screen (primary only) | All pages |
| Reserve `glow` variant for 1 CTA per view | Button usage audit |
| Limit badge color variants to 4 core types | `badge.tsx` |

**Badge Consolidation:**
```tsx
// Current: 7+ variants
// Proposed: 4 semantic variants
const badgeVariants = cva(/* ... */, {
  variants: {
    variant: {
      default: '...',      // Neutral information
      primary: '...',      // Active/highlighted
      success: '...',      // Positive state
      warning: '...',      // Caution state
      destructive: '...',  // Error/danger state
    }
  }
});
```

#### Serial Position Effect (First/Last Memory)
| Implementation | Files to Modify |
|----------------|-----------------|
| Place APY at start of market cards | `MarketCard.tsx` |
| Place CTA button at end of forms | All `*Form.tsx` files |
| Primary navigation at edges of header | `Shell.tsx` header |

#### 60-30-10 Color Rule
| Implementation | Files to Modify |
|----------------|-----------------|
| Create color usage guidelines doc | New: `STYLE_GUIDE.md` |
| Audit accent color usage | All components |
| Add ESLint rule for color balance | `eslint.config.js` |

### 3.4 Laws of Attention and Scanning

#### F-Pattern / Z-Pattern
| Implementation | Files to Modify |
|----------------|-----------------|
| Left-align form labels | `TokenInput.tsx`, all inputs |
| Place key metrics (APY) top-left of cards | `MarketCard.tsx` |
| Logo top-left, CTA top-right in header | `Shell.tsx` |

**Current compliance:** Headers already follow Z-pattern (logo left, actions right).

#### Banner Blindness
| Implementation | Files to Modify |
|----------------|-----------------|
| Integrate CTAs into content flow | Design guideline |
| Avoid loud graphics for promotions | Design guideline |
| Use native card styling over banner images | All promotional content |

#### Change Blindness
| Implementation | Files to Modify |
|----------------|-----------------|
| Animate value changes with `AnimatedNumber` | `SwapForm.tsx` output, all metrics |
| Flash color on balance updates | `TokenInput.tsx` balance display |
| Use `value-positive-flash` / `value-negative-flash` | Numeric displays |

**Already available** via CSS utilities:
```css
.value-positive-flash { animation: positive-flash 0.6s ease-out; }
.value-negative-flash { animation: negative-flash 0.6s ease-out; }
```

### 3.5 Laws of Learning and Familiarity

#### Jakob's Law (Familiar Patterns)
| Implementation | Files to Modify |
|----------------|-----------------|
| Follow Uniswap/Pendle form patterns | All `*Form.tsx` files |
| Use standard icons (Lucide) consistently | Already implemented |
| Match common DeFi terminology | Copy audit |

**DeFi Convention Checklist:**
- [x] "You pay" / "You receive" labels
- [x] Token selector badges
- [x] Slippage tolerance setting
- [x] Price impact warnings
- [ ] Gas estimation display (add)

#### Law of Praegnanz (Simplicity)
| Implementation | Files to Modify |
|----------------|-----------------|
| Remove decorative gradients from non-interactive elements | `globals.css` |
| Use single-color backgrounds over mesh gradients | Hero sections |
| Favor simple icons over complex illustrations | All iconography |

#### Tesler's Law (Conservation of Complexity)
| Implementation | Files to Modify |
|----------------|-----------------|
| Auto-select token based on context | `TokenInput.tsx` |
| Calculate optimal slippage automatically | `useTransactionSettings.ts` |
| Infer network from wallet | Already implemented |

**Smart Defaults Pattern:**
```tsx
// Auto-calculate suggested slippage based on market volatility
const suggestedSlippage = useMemo(() => {
  if (!priceImpactData) return 0.5; // Default 0.5%
  const avgImpact = priceImpactData.avgImpact24h;
  if (avgImpact > 2) return 1.0;    // High volatility
  if (avgImpact > 0.5) return 0.5;  // Medium volatility
  return 0.1;                        // Low volatility
}, [priceImpactData]);
```

### 3.6 Laws of Error and Recovery

#### Occam's Razor (One Primary Action)
| Implementation | Files to Modify |
|----------------|-----------------|
| Single submit button per form | All `*Form.tsx` files |
| Remove secondary actions from primary flow | Audit all forms |
| Clear hierarchy: primary > secondary > tertiary | Button variant usage |

**Current compliance:** Forms already have single primary CTA.

#### Error Prevention Principle
| Implementation | Files to Modify |
|----------------|-----------------|
| Disable button when input invalid | All `*Form.tsx` files |
| Input validation on change, not submit | `TokenInput.tsx` |
| Constrain numeric input to valid ranges | `NumberInput.tsx` |
| Show balance inline to prevent overdraft | `TokenInput.tsx` |

**Input Constraint Pattern:**
```tsx
// Prevent invalid input entirely
<Input
  type="text"
  inputMode="decimal"
  pattern="[0-9]*\.?[0-9]*"
  onKeyDown={(e) => {
    // Block non-numeric except decimal and control keys
    if (!/[0-9.]/.test(e.key) && !['Backspace', 'Tab', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      e.preventDefault();
    }
  }}
/>
```

#### Peak-End Rule
| Implementation | Files to Modify |
|----------------|-----------------|
| Success celebration animation | `TxStatus.tsx` |
| Confetti/glow on successful transaction | New: `SuccessCelebration.tsx` |
| Clear "What's next?" guidance after action | `TxStatus.tsx` |

**Success State Enhancement:**
```tsx
// TxStatus.tsx - success state
{status === 'success' && (
  <div className="animate-fade-up space-y-4 text-center">
    <div className="mx-auto h-16 w-16 animate-bounce-in rounded-full bg-success/20">
      <CheckIcon className="h-16 w-16 text-success" />
    </div>
    <p className="text-lg font-semibold">Transaction Successful!</p>
    <div className="space-y-2">
      <Button variant="outline" asChild>
        <a href={explorerUrl}>View on Explorer</a>
      </Button>
      <p className="text-muted-foreground text-sm">
        What's next? <Link href="/portfolio" className="text-primary">View your portfolio</Link>
      </p>
    </div>
  </div>
)}
```

### 3.7 Laws of Trust and Feedback

#### Feedback Principle
| Implementation | Files to Modify |
|----------------|-----------------|
| Loading spinner on all async actions | Already via `Button loading` prop |
| Progress indicators for multi-step flows | Add to mint/liquidity flows |
| Visual confirmation for every interaction | Audit all interactive elements |

**Feedback Checklist:**
- [x] Button press feedback (`active:scale-[0.97]`)
- [x] Loading state (`Loader2` spinner)
- [x] Success/error toasts
- [ ] Step progress for liquidity addition
- [ ] Confirmation feedback for toggle changes

#### Aesthetic-Usability Effect
| Implementation | Files to Modify |
|----------------|-----------------|
| Polish loading states (skeleton → content) | All data-fetching components |
| Smooth transitions on state changes | Already via CSS utilities |
| Consistent micro-interactions | Already implemented |

---

## Part 4: Phased Implementation Plan

### Phase 1: Foundation (Critical Path)
**Duration:** Week 1
**Priority:** P0 - Must have

| Task | Files | UI/UX Laws |
|------|-------|-----------|
| Create `FormLayout` component | New: `src/shared/ui/FormLayout.tsx` | Gestalt, Praegnanz |
| Add spacing tokens to `globals.css` | `globals.css` | Gestalt Proximity |
| Standardize button sizes in all forms | All `*Form.tsx` (9 files) | Fitts's Law |
| Consolidate badge variants to 4 | `badge.tsx` | Von Restorff |

**Deliverables:**
1. `FormLayout`, `FormInputSection`, `FormOutputSection`, `FormInfoSection`, `FormActions` components
2. Updated spacing tokens in CSS
3. All forms using `size="xl"` for primary CTAs
4. Badge variant reduction

### Phase 2: Consistency (Style Unification)
**Duration:** Week 2
**Priority:** P1 - Should have

| Task | Files | UI/UX Laws |
|------|-------|-----------|
| Migrate forms to `FormLayout` | All `*Form.tsx` | Miller's Law |
| Implement slippage presets | `TransactionSettingsPanel.tsx` | Hick's Law |
| Audit color usage (60-30-10) | All components | 60-30-10 Rule |
| Standardize card padding to `p-5` | All `Card` usages | Gestalt |

**Deliverables:**
1. All forms using `FormLayout` wrapper
2. Slippage presets (Low/Medium/High) with custom option
3. Color audit report with violations fixed
4. Consistent card padding across app

### Phase 3: Feedback Enhancement
**Duration:** Week 3
**Priority:** P1 - Should have

| Task | Files | UI/UX Laws |
|------|-------|-----------|
| Implement optimistic UI for mutations | `useSwap.ts`, `useMint.ts`, etc. | Doherty Threshold |
| Add `AnimatedNumber` to output displays | `SwapForm.tsx`, all output displays | Change Blindness |
| Enhance success states | `TxStatus.tsx` | Peak-End Rule |
| Add focus indicators audit | All interactive elements | Feedback Principle |

**Deliverables:**
1. Optimistic updates for all mutations
2. Animated number transitions for outputs
3. Enhanced success celebration UI
4. Complete focus-visible coverage

### Phase 4: Error Prevention
**Duration:** Week 4
**Priority:** P2 - Nice to have

| Task | Files | UI/UX Laws |
|------|-------|-----------|
| Inline validation for `TokenInput` | `TokenInput.tsx` | Error Prevention |
| Constrain numeric inputs | `Input.tsx`, `NumberInput.tsx` | Error Prevention |
| Smart slippage defaults | `useTransactionSettings.ts` | Tesler's Law |
| Add gas estimation display | `TxStatus.tsx` | Jakob's Law |

**Deliverables:**
1. Real-time balance validation in inputs
2. Numeric input constraints (no letters, valid decimals)
3. Auto-calculated slippage suggestions
4. Gas estimation in transaction preview

### Phase 5: Polish
**Duration:** Week 5
**Priority:** P3 - Enhancement

| Task | Files | UI/UX Laws |
|------|-------|-----------|
| Create `STYLE_GUIDE.md` documentation | New: `STYLE_GUIDE.md` | All |
| Add step progress for multi-step flows | New component | Feedback Principle |
| Widen slider tracks | `slider.tsx` | Steering Law |
| Add recommended badge to top market | `MarketCard.tsx` | Paradox of Choice |

**Deliverables:**
1. Complete style guide document
2. Step progress component
3. Improved slider UX
4. Market recommendation highlighting

---

## Part 5: Component Inventory

### Forms Requiring Updates

| Form | Location | Changes Needed |
|------|----------|---------------|
| SwapForm | `features/swap/ui/SwapForm.tsx` | FormLayout, button size, AnimatedNumber |
| MintForm | `features/mint/ui/MintForm.tsx` | FormLayout, button size |
| SimpleEarnForm | `features/earn/ui/SimpleEarnForm.tsx` | FormLayout, button size |
| SimpleWithdrawForm | `features/earn/ui/SimpleWithdrawForm.tsx` | FormLayout, button size |
| WrapToSyForm | `features/earn/ui/WrapToSyForm.tsx` | FormLayout, button size |
| AddLiquidityForm | `features/liquidity/ui/AddLiquidityForm.tsx` | FormLayout, button size, step progress |
| RemoveLiquidityForm | `features/liquidity/ui/RemoveLiquidityForm.tsx` | FormLayout, button size |
| UnwrapSyForm | `features/redeem/ui/UnwrapSyForm.tsx` | FormLayout, button size |

### Components Requiring Updates

| Component | Location | Changes Needed |
|-----------|----------|---------------|
| Button | `shared/ui/Button.tsx` | Add formPrimary/formDestructive variants |
| Badge | `shared/ui/badge.tsx` | Consolidate to 4-5 variants |
| Card | `shared/ui/Card.tsx` | Standardize padding to p-5 |
| Slider | `shared/ui/slider.tsx` | Widen track to 8px |
| TokenInput | `features/mint/ui/TokenInput.tsx` | Inline validation, balance flash |
| TxStatus | `widgets/display/TxStatus.tsx` | Enhanced success, gas estimate |
| MarketCard | `entities/market/ui/MarketCard.tsx` | APY top-left, recommended badge |
| TransactionSettingsPanel | `features/tx-settings/ui/*.tsx` | Slippage presets |

---

## Part 6: Testing & Verification

### Visual Regression Testing

Add Playwright visual tests for key UI states:

```typescript
// tests/visual/forms.spec.ts
test.describe('Form Visual Consistency', () => {
  test('SwapForm matches design', async ({ page }) => {
    await page.goto('/trade/market-address');
    await expect(page.locator('[data-testid="swap-form"]')).toHaveScreenshot();
  });

  test('MintForm matches design', async ({ page }) => {
    await page.goto('/mint/market-address');
    await expect(page.locator('[data-testid="mint-form"]')).toHaveScreenshot();
  });
});
```

### Accessibility Audit

Run automated a11y checks:

```bash
# Add to CI
npx playwright test --project=accessibility
```

Test checklist:
- [ ] All interactive elements have focus-visible styles
- [ ] Color contrast meets WCAG AA (4.5:1 for text)
- [ ] Touch targets >= 44x44px on mobile
- [ ] Form labels associated with inputs
- [ ] Error messages announced to screen readers

### Performance Metrics

Verify Doherty Threshold compliance:

```typescript
// Measure interaction latency
test('Button response < 400ms', async ({ page }) => {
  const start = Date.now();
  await page.click('[data-testid="submit-button"]');
  await expect(page.locator('[data-testid="loading-indicator"]')).toBeVisible();
  const latency = Date.now() - start;
  expect(latency).toBeLessThan(400);
});
```

---

## Part 7: Success Criteria

### Quantitative Metrics

| Metric | Current | Target | Measurement |
|--------|---------|--------|-------------|
| Button size consistency | 60% | 100% | Automated audit |
| Animation duration < 400ms | 80% | 100% | CSS audit |
| Color contrast ratio | Unknown | 4.5:1+ | Lighthouse |
| Touch target size | Unknown | 44px+ | CSS audit |
| Form structure consistency | 40% | 100% | Manual review |

### Qualitative Criteria

- [ ] All forms follow identical visual structure
- [ ] Primary CTAs are immediately identifiable
- [ ] Feedback for every interaction
- [ ] No jarring state transitions
- [ ] Consistent spacing throughout app

---

## Appendix A: Color Token Reference

```css
/* Primary palette */
--primary: oklch(0.646 0.222 41.116);           /* Amber/orange */
--primary-foreground: oklch(0.16 0.04 41.116);

/* Status colors */
--success: oklch(0.723 0.191 142.5);            /* Green */
--warning: oklch(0.769 0.188 70.08);            /* Yellow */
--destructive: oklch(0.577 0.245 27.325);       /* Red */

/* Neutrals */
--background: oklch(1 0 0);                     /* White */
--foreground: oklch(0.141 0.005 285.823);       /* Near-black */
--muted: oklch(0.92 0.004 286.32);              /* Light gray */
--muted-foreground: oklch(0.552 0.016 285.938); /* Medium gray */

/* Surfaces */
--surface-elevated: oklch(0.98 0.001 286);      /* Raised elements */
--surface-sunken: oklch(0.94 0.003 286);        /* Recessed areas */

/* Glows */
--glow-primary: oklch(0.705 0.213 47.604 / 15%);
--glow-success: oklch(0.723 0.191 142.5 / 15%);
```

---

## Appendix B: Animation Token Reference

```css
/* Timing presets */
.transition-micro: 150ms;    /* Button presses, toggles */
.transition-ui: 200ms;       /* Standard state changes */
.transition-smooth: 300ms;   /* Content transitions */
.transition-reveal: 400ms;   /* Entrance animations */
.transition-spring: 500ms;   /* Bouncy effects */

/* Easing */
cubic-bezier(0.16, 1, 0.3, 1);      /* Out-expo (most UI) */
cubic-bezier(0.34, 1.56, 0.64, 1);  /* Spring (emphasis) */
```

---

## Appendix C: Quick Reference Card

### Button Sizes by Context
```
Form submit    → size="xl"    (48px)
Card action    → size="lg"    (40px)
Toolbar        → size="default" (36px)
Dense/table    → size="sm"    (32px)
Icon           → size="icon"  (36px)
```

### Spacing Scale
```
Form sections  → space-y-6   (24px)
Element groups → space-y-4   (16px)
Tight stack    → space-y-2   (8px)
Inline gap     → gap-3       (12px)
```

### Form Structure
```
Card > CardContent.space-y-6.p-5
├── InputSection.space-y-4
├── Divider (optional)
├── OutputSection (Card.bg-muted/50)
├── Collapsible details
├── Warnings (conditional)
└── FormActions
    └── Button.size-xl.w-full
```

---

*Document version: 1.0*
*Last updated: 2025-12-27*
*Author: Claude Code*
