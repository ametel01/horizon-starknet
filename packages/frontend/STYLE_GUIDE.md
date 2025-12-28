# Horizon Protocol Frontend Style Guide

**Version:** 2.0 (2025-12-28)
**Theme:** Horizon Dusk - Warm amber/orange gradient palette

This guide documents the design system patterns, UI/UX principles, and component usage conventions for the Horizon Protocol frontend.

---

## Table of Contents

1. [Color System](#1-color-system)
2. [Typography](#2-typography)
3. [Spacing Tokens](#3-spacing-tokens)
4. [Button System](#4-button-system)
5. [Form Patterns](#5-form-patterns)
6. [Badge Variants](#6-badge-variants)
7. [Animation Guidelines](#7-animation-guidelines)
8. [Accessibility](#8-accessibility)
9. [Component Quick Reference](#9-component-quick-reference)

---

## 1. Color System

### 1.1 The 60-30-10 Rule

Our color system follows the interior design principle of color distribution:

| Proportion | Role | Tokens | Usage |
|------------|------|--------|-------|
| **60%** | Background/Neutral | `background`, `card`, `muted` | Page backgrounds, cards, containers |
| **30%** | Secondary/Supporting | `secondary`, `muted-foreground`, `border` | Text, borders, supporting elements |
| **10%** | Primary/Accent | `primary`, `accent`, `success`, `warning`, `destructive` | CTAs, highlights, status indicators |

### 1.2 Semantic Color Tokens

```css
/* Primary - Warm amber/orange (Horizon brand) */
--primary: oklch(0.705 0.213 47.604);      /* Dark mode */
--primary: oklch(0.646 0.222 41.116);      /* Light mode */

/* Semantic states */
--success: oklch(0.723 0.191 142.5);       /* Positive/gains */
--warning: oklch(0.769 0.188 70.08);       /* Caution */
--destructive: oklch(0.704 0.191 22.216);  /* Error/danger */

/* Chart colors (warm gradient) */
--chart-1: oklch(0.837 0.128 66.29);       /* Lightest amber */
--chart-2: oklch(0.705 0.213 47.604);      /* Primary orange */
--chart-3: oklch(0.646 0.222 41.116);      /* Deep orange */
--chart-4: oklch(0.553 0.195 38.402);      /* Burnt orange */
--chart-5: oklch(0.47 0.157 37.304);       /* Darkest */
```

### 1.3 Surface & Depth

```css
/* Surface variations for visual hierarchy */
--surface-elevated: oklch(0.25 0.006 286);  /* Raised elements */
--surface-sunken: oklch(0.12 0.004 286);    /* Recessed areas */
--surface-overlay: oklch(0.141 0.005 285.823 / 90%);  /* Modals */

/* Glow colors for ambient effects */
--glow-primary: oklch(0.705 0.213 47.604 / 20%);
--glow-success: oklch(0.723 0.191 142.5 / 20%);
--glow-warning: oklch(0.769 0.188 70.08 / 20%);
--glow-destructive: oklch(0.704 0.191 22.216 / 20%);
```

### 1.4 When to Use Each Color

| Color | Use For | Never Use For |
|-------|---------|---------------|
| `primary` | Main CTAs, selected states, brand highlights | Body text, backgrounds |
| `success` | Positive balances, completed states, gains | Warnings or neutral info |
| `warning` | Price impact alerts, pending states, caution | Errors or success states |
| `destructive` | Errors, sell actions, destructive operations | Neutral information |
| `muted` | Secondary text, disabled states, placeholders | Primary actions |

---

## 2. Typography

### 2.1 Font Families

```css
--font-sans: "Inter", ui-sans-serif, system-ui, sans-serif;
--font-display: "Sora", ui-sans-serif, system-ui, sans-serif;
--font-mono: "JetBrains Mono", ui-monospace, monospace;
```

| Font | Usage |
|------|-------|
| **Sora** (display) | H1, H2, hero text, marketing |
| **Inter** (sans) | Body text, UI labels, buttons |
| **JetBrains Mono** | Numbers, addresses, code, metrics |

### 2.2 Type Scale

```css
/* Display headings */
h1 { font-size: clamp(2.25rem, 5vw, 3.5rem); font-weight: 600; }
h2 { font-size: clamp(1.5rem, 3vw, 2.25rem); font-weight: 600; }
h3 { font-size: clamp(1.125rem, 2vw, 1.5rem); font-weight: 600; }
h4 { font-size: 1.125rem; font-weight: 600; }

/* Body text */
.text-sm { font-size: 0.875rem; }  /* 14px - Secondary text */
.text-xs { font-size: 0.75rem; }   /* 12px - Labels, captions */
```

### 2.3 Utility Classes

```tsx
// Metrics and numbers
<span className="metric">1,234.56</span>          // Tabular numbers
<span className="metric-hero">24.5%</span>        // Large gradient metric
<span className="metric-positive">+12.3%</span>   // Green positive
<span className="metric-negative">-5.2%</span>    // Red negative

// Labels and addresses
<span className="label">APY</span>                // Uppercase label
<span className="address">0x1234...abcd</span>    // Monospace address
<span className="text-data">123,456</span>        // Data display
```

---

## 3. Spacing Tokens

### 3.1 Spacing Scale (Gestalt Proximity)

```css
--space-section: 1.5rem;  /* 24px - Between major form sections */
--space-group: 1rem;      /* 16px - Between related elements */
--space-element: 0.5rem;  /* 8px - Between component parts */
--space-tight: 0.25rem;   /* 4px - Compact spacing */
```

### 3.2 Tailwind Mapping

| Token | Tailwind | Pixels | Use Case |
|-------|----------|--------|----------|
| `space-section` | `space-y-6`, `gap-6` | 24px | Form sections, card groups |
| `space-group` | `space-y-4`, `gap-4` | 16px | Input groups, list items |
| `space-element` | `space-y-2`, `gap-2` | 8px | Label + input, icon + text |
| `space-tight` | `space-y-1`, `gap-1` | 4px | Inline elements, tight grids |

### 3.3 Container Padding

```tsx
// Standard padding patterns
<Card className="p-5">         // Form cards
<CardContent className="p-4">  // Inner card content
<div className="px-4 py-3">    // Info sections
```

---

## 4. Button System

### 4.1 Size Variants

| Size | Height | Use Case |
|------|--------|----------|
| `xs` | 24px (h-6) | Inline actions, table rows |
| `sm` | 32px (h-8) | Secondary actions, compact UI |
| `default` | 36px (h-9) | Standard buttons |
| `lg` | 40px (h-10) | Emphasized actions |
| `xl` | 48px (h-12) | **Form submit buttons** |
| `icon` | 36px (size-9) | Icon-only buttons |

### 4.2 Style Variants

```tsx
// Primary actions
<Button variant="default">Connect Wallet</Button>
<Button variant="glow">Swap Now</Button>           // With glow shadow

// Secondary actions
<Button variant="secondary">Cancel</Button>
<Button variant="outline">Settings</Button>
<Button variant="ghost">Details</Button>

// Semantic actions
<Button variant="destructive">Remove</Button>

// Form-specific (include size + width)
<Button variant="form-primary">Add Liquidity</Button>
<Button variant="form-destructive">Sell PT</Button>
```

### 4.3 Form Button Guidelines

**Always use `variant="form-primary"` or `size="xl"` for form submit buttons:**

```tsx
// Preferred: form-specific variant
<FormActions>
  <Button variant="form-primary">Add Liquidity</Button>
</FormActions>

// Alternative: size="xl" with full width
<FormActions>
  <Button size="xl" className="w-full">Swap</Button>
</FormActions>
```

### 4.4 Icon Buttons

```tsx
// Standalone icon buttons
<Button variant="ghost" size="icon">
  <Settings className="size-4" />
</Button>

// Icon with text
<Button>
  <RefreshCw className="size-4" data-icon="inline-start" />
  Refresh
</Button>
```

---

## 5. Form Patterns

### 5.1 FormLayout Component

All transaction forms use the `FormLayout` component system for consistency:

```tsx
import {
  FormLayout,
  FormHeader,
  FormInputSection,
  FormOutputSection,
  FormInfoSection,
  FormActions,
  FormDivider,
  FormRow,
} from '@shared/ui/FormLayout';

<FormLayout gradient="primary">
  <FormHeader title="Swap" description="Trade PT or YT tokens" />

  <FormInputSection>
    <TokenInput label="You Pay" ... />
  </FormInputSection>

  <FormDivider>
    <Button variant="ghost" size="icon">
      <ArrowDownUp />
    </Button>
  </FormDivider>

  <FormOutputSection>
    <TokenOutput label="You Receive" ... />
  </FormOutputSection>

  <FormInfoSection>
    <FormRow label="Exchange Rate" value="1.0234" />
    <FormRow label="Price Impact" value="0.12%" />
    <FormRow label="Estimated Gas" value={<GasEstimate ... />} />
  </FormInfoSection>

  <FormActions>
    <Button variant="form-primary">Swap</Button>
  </FormActions>
</FormLayout>
```

### 5.2 Form Gradients

Use directional gradients to indicate action type:

| Gradient | Use Case |
|----------|----------|
| `gradient="primary"` | Buy actions, deposits, additions |
| `gradient="destructive"` | Sell actions, withdrawals, removals |
| `gradient="success"` | Claim rewards, completed states |
| `gradient="none"` | Neutral forms (default) |

### 5.3 TokenInput Component

```tsx
<TokenInput
  label="Amount"
  tokenAddress={market.ptAddress}
  tokenSymbol="PT-stETH"
  value={amount}
  onChange={setAmount}
  validateBalance={true}      // Enable inline validation
  minAmount={BigInt(1e14)}    // Custom dust threshold
  error={customError}         // External validation error
/>
```

**Built-in validations:**
- Insufficient balance (error - blocking)
- Zero amount (warning - informational)
- Dust amount < 0.0001 (warning - informational)

---

## 6. Badge Variants

### 6.1 Semantic Badges

```tsx
// Status indicators
<Badge variant="default">Active</Badge>      // Primary brand color
<Badge variant="success">+12.5%</Badge>      // Positive states
<Badge variant="warning">High Impact</Badge> // Caution states
<Badge variant="destructive">Error</Badge>   // Error states

// Neutral variants
<Badge variant="secondary">PT</Badge>        // Token type labels
<Badge variant="outline">Optional</Badge>    // Subtle indicators

// Animated
<Badge variant="live">Live</Badge>           // Real-time data indicator
```

### 6.2 When to Use Each Variant

| Variant | Semantic Meaning | Example Uses |
|---------|-----------------|--------------|
| `default` | Primary highlight | Featured, Recommended, New |
| `secondary` | Neutral info | Token types (PT, YT, SY), counts |
| `success` | Positive state | Gains, completed, active |
| `warning` | Caution needed | High slippage, expiring soon |
| `destructive` | Error/danger | Failed, rejected, losses |
| `outline` | Low emphasis | Optional, beta features |
| `live` | Real-time | Live prices, streaming data |

---

## 7. Animation Guidelines

### 7.1 Duration Standards (Doherty Threshold)

All animations must complete within **400ms** to maintain perceived responsiveness:

| Duration | Use Case | Tailwind |
|----------|----------|----------|
| 75-100ms | Button press feedback | `duration-75` |
| 150ms | Micro-interactions (hover, focus) | `duration-150` |
| 200ms | UI transitions (color, opacity) | `duration-200` |
| 300ms | Content transitions (slide, fade) | `duration-300` |
| 400ms | Entrance animations (max) | `duration-400` |

### 7.2 Easing Functions

```css
/* Standard ease-out for UI (default) */
cubic-bezier(0.16, 1, 0.3, 1)  /* .transition-ui */

/* Spring-like bounce for emphasis */
cubic-bezier(0.34, 1.56, 0.64, 1)  /* .transition-spring */
```

### 7.3 Animation Utilities

```tsx
// Entrance animations
<div className="animate-fade-up">...</div>
<div className="animate-slide-in-right">...</div>
<div className="animate-scale-in">...</div>

// Interactive states
<button className="hover-lift active-press">...</button>
<div className="hover-glow">...</div>

// Loading states
<div className="animate-shimmer">...</div>
<Loader2 className="animate-spin" />

// Value changes
<span className="value-positive-flash">+$100</span>
<span className="value-negative-flash">-$50</span>
```

### 7.4 Staggered Animations

```tsx
// Stagger list items
{items.map((item, i) => (
  <div
    key={item.id}
    className={cn('animate-fade-up', `delay-${i * 50}`)}
  >
    {item.name}
  </div>
))}
```

### 7.5 Reduced Motion Support

All animations automatically disable for users with `prefers-reduced-motion`:

```css
@media (prefers-reduced-motion: reduce) {
  .animate-*, .hover-lift, .transition-* {
    animation: none;
    transition-duration: 0ms;
  }
}
```

---

## 8. Accessibility

### 8.1 Focus Indicators

All interactive elements must have visible focus states:

```tsx
// Standard focus ring (3px)
className="focus-visible:ring-ring/50 focus-visible:ring-[3px]"

// Focus with border
className="focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
```

### 8.2 Touch Targets

Minimum touch target size: **44x44px** (WCAG 2.1 AAA)

```tsx
// Utility class for touch targets
className="touch-target"  // min-height: 44px, min-width: 44px

// Button sizes meeting requirement
size="lg"   // 40px (close)
size="xl"   // 48px (exceeds)
size="icon" // 36px (use larger clickable area)
```

### 8.3 Color Contrast

All text colors meet WCAG AA contrast requirements (4.5:1 for normal text, 3:1 for large text).

### 8.4 ARIA Patterns

```tsx
// Form validation
<input
  aria-invalid={hasError}
  aria-describedby={errorId}
/>
<p id={errorId} role="alert">{error}</p>

// Loading states
<Button loading aria-busy="true">
  <Loader2 className="animate-spin" aria-hidden="true" />
  Processing...
</Button>

// Progress indicators
<StepProgress
  steps={steps}
  currentStep={current}
  role="progressbar"
  aria-valuenow={current}
  aria-valuemax={steps.length}
/>
```

---

## 9. Component Quick Reference

### 9.1 Form Components

| Component | Import | Purpose |
|-----------|--------|---------|
| `FormLayout` | `@shared/ui/FormLayout` | Main form container |
| `FormHeader` | `@shared/ui/FormLayout` | Title + description |
| `FormInputSection` | `@shared/ui/FormLayout` | Group inputs (space-y-4) |
| `FormOutputSection` | `@shared/ui/FormLayout` | Preview/output area |
| `FormInfoSection` | `@shared/ui/FormLayout` | Supplementary info |
| `FormActions` | `@shared/ui/FormLayout` | Button container |
| `FormRow` | `@shared/ui/FormLayout` | Label-value pair |
| `TokenInput` | `@features/mint` | Token amount input |
| `TokenOutput` | `@features/mint` | Token amount display |

### 9.2 Interactive Components

| Component | Import | Sizes |
|-----------|--------|-------|
| `Button` | `@shared/ui/Button` | xs, sm, default, lg, xl, icon |
| `Badge` | `@shared/ui/badge` | Single size (h-5) |
| `Switch` | `@shared/ui/switch` | Single size |
| `Slider` | `@shared/ui/slider` | 8px track height |
| `ToggleGroup` | `@shared/ui/toggle-group` | sm, default, lg |

### 9.3 Feedback Components

| Component | Import | Purpose |
|-----------|--------|---------|
| `TxStatus` | `@widgets/display/TxStatus` | Transaction state display |
| `StepProgress` | `@shared/ui/StepProgress` | Multi-step progress |
| `GasEstimate` | `@shared/ui/GasEstimate` | Fee estimation display |
| `AnimatedNumber` | `@shared/ui/AnimatedNumber` | Smooth number transitions |
| `Skeleton` | `@shared/ui/Skeleton` | Loading placeholder |

### 9.4 Transaction Settings

| Component | Import | Purpose |
|-----------|--------|---------|
| `TransactionSettingsPanel` | `@features/tx-settings` | Slippage + deadline UI |
| `useSmartSlippage` | `@features/tx-settings` | Auto slippage calculation |
| `useTransactionSettings` | `@features/tx-settings` | Settings context hook |

---

## Appendix: UI/UX Laws Applied

| Law | Application |
|-----|-------------|
| **Doherty Threshold** | All animations < 400ms |
| **Gestalt Proximity** | Consistent spacing tokens |
| **Miller's Law** | Group related elements (7±2 chunks) |
| **Von Restorff Effect** | Accent color for primary actions |
| **Serial Position Effect** | CTA at end of forms |
| **Hick's Law** | Limited choices (3 slippage presets) |
| **Fitts's Law** | Large touch targets (44px+), 48px form buttons |
| **Steering Law** | 8px slider tracks for easy navigation |
| **Jakob's Law** | Familiar patterns (gas before confirm) |
| **60-30-10 Rule** | Color distribution for visual hierarchy |

---

*Last updated: 2025-12-28*
