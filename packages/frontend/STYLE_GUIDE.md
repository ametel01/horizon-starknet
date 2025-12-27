# Horizon Protocol Style Guide

A comprehensive reference for UI/UX patterns, design tokens, and component usage in the Horizon Protocol frontend.

---

## Design Principles

### 1. Speed Over Perfection
- All interactions must feel instantaneous (< 400ms response - Doherty Threshold)
- Use optimistic UI updates for blockchain transactions
- Skeleton loaders for async data

### 2. Reduce Cognitive Load
- One primary action per screen (Occam's Razor)
- Hide advanced options behind progressive disclosure (Hick's Law)
- Chunk information into groups of 5-7 items (Miller's Law)

### 3. Familiar Patterns
- Follow established DeFi conventions (Jakob's Law)
- "You pay" / "You receive" terminology
- Slippage tolerance in settings

### 4. Prevent Errors
- Inline validation as users type
- Disable actions when inputs are invalid
- Show balances prominently to prevent overdrafts

---

## Color System

### 60-30-10 Rule

| Percentage | Usage | Tokens |
|------------|-------|--------|
| **60%** | Backgrounds, cards | `bg-background`, `bg-card` |
| **30%** | Secondary UI, labels | `bg-muted`, `text-muted-foreground`, `border` |
| **10%** | CTAs, status indicators | `bg-primary`, `text-success`, `text-destructive` |

### Semantic Colors

```css
/* Primary (Accent) */
--primary: oklch(0.646 0.222 41.116);        /* Amber/orange */

/* Status */
--success: oklch(0.723 0.191 142.5);         /* Green */
--warning: oklch(0.769 0.188 70.08);         /* Yellow */
--destructive: oklch(0.577 0.245 27.325);    /* Red */

/* Neutrals */
--background: oklch(1 0 0);                  /* White */
--foreground: oklch(0.141 0.005 285.823);    /* Near-black */
--muted: oklch(0.92 0.004 286.32);           /* Light gray */
--muted-foreground: oklch(0.552 0.016 285.938); /* Medium gray */
```

### Surface Tokens

| Token | Usage |
|-------|-------|
| `bg-card` | Elevated content (cards, dialogs) |
| `bg-muted` | Sunken areas (output sections, disabled) |
| `bg-muted/50` | Subtle grouping |

---

## Spacing Scale

Consistent spacing creates visual rhythm and hierarchy.

### Spacing Tokens

| Usage | Class | Size |
|-------|-------|------|
| Form sections | `space-y-6` | 24px |
| Element groups | `space-y-4` | 16px |
| Tight stack | `space-y-2` | 8px |
| Inline gap | `gap-3` | 12px |

### Card Padding

All cards use `p-5` (20px) for consistent internal padding.

```tsx
<Card>
  <CardContent className="p-5 space-y-6">
    {/* content */}
  </CardContent>
</Card>
```

---

## Typography

### Font Families

| Type | Usage |
|------|-------|
| **Inter** (sans-serif) | Body text, labels, UI |
| **JetBrains Mono** (mono) | Numbers, addresses, code |

### Text Sizes

| Class | Size | Usage |
|-------|------|-------|
| `text-2xl` | 24px | Hero numbers (APY display) |
| `text-lg` | 18px | Large input values |
| `text-base` | 16px | Body text, labels |
| `text-sm` | 14px | Secondary text |
| `text-xs` | 12px | Captions, hints |

### Numeric Display

All numeric values use `font-mono tabular-nums` for alignment:

```tsx
<span className="font-mono tabular-nums">1,234.5678</span>
```

---

## Button Sizes

Standardized button sizes by context (Fitts's Law):

| Context | Size | Height | Usage |
|---------|------|--------|-------|
| Form submit | `size="xl"` or `h-12` | 48px | Primary form CTAs |
| Card action | `size="lg"` | 40px | Secondary actions |
| Toolbar | `size="default"` | 36px | Navigation, toggles |
| Dense UI | `size="sm"` | 32px | Table actions, compact |
| Icon only | `size="icon"` | 36px | Toggle buttons |

### Form Submit Pattern

```tsx
<Button className="h-12 w-full text-base font-medium">
  Submit Action
</Button>
```

---

## Form Layout

All forms follow a consistent structure using `FormLayout` components:

```tsx
<FormLayout gradient="primary">
  {/* 1. Header */}
  <FormHeader title="Action Name" description="Brief explanation" />

  {/* 2. Input Section */}
  <FormInputSection>
    <TokenInput label="You pay" {...props} />
  </FormInputSection>

  {/* 3. Divider (optional) */}
  <FormDivider>
    <SwapButton />
  </FormDivider>

  {/* 4. Output Section */}
  <TokenOutput label="You receive" {...props} />

  {/* 5. Info Section */}
  <FormInfoSection>
    <FormRow label="Rate" value="1:1" />
    <FormRow label="Gas" value={<GasEstimate />} />
  </FormInfoSection>

  {/* 6. Transaction Status */}
  {status !== 'idle' && <TxStatus status={status} />}

  {/* 7. Actions */}
  <FormActions>
    <Button className="h-12 w-full">Action</Button>
  </FormActions>
</FormLayout>
```

---

## Interactive States

### Button States

| State | Visual Treatment |
|-------|-----------------|
| Default | Standard styling |
| Hover | `bg-primary/90`, subtle scale |
| Active/Pressed | `scale-[0.97]` (immediate feedback) |
| Disabled | `opacity-50`, no pointer events |
| Loading | Spinner icon, disabled interaction |

### Focus States

All interactive elements must have visible focus indicators:

```css
focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
```

### Input States

| State | Border | Background |
|-------|--------|------------|
| Default | `border-input` | `bg-background` |
| Focus | `ring-2 ring-ring` | `bg-background` |
| Error | `border-destructive` | `bg-destructive/5` |
| Disabled | `opacity-50` | `bg-muted` |

---

## Animation Timing

### Duration Presets

| Type | Duration | Usage |
|------|----------|-------|
| Micro | 150ms | Button presses, toggles |
| UI | 200ms | Standard state changes |
| Smooth | 300ms | Content transitions |
| Reveal | 400ms | Entrance animations |
| Spring | 500ms | Bouncy emphasis effects |

### Easing Functions

| Easing | Usage |
|--------|-------|
| `ease-out-expo` | Most UI transitions |
| `spring` | Emphasis, celebration |

### Key Animation Classes

```css
/* Entrance */
.animate-fade-in    /* Opacity fade */
.animate-fade-up    /* Fade + slide up */
.animate-slide-in   /* Slide from side */

/* Feedback */
.animate-pulse      /* Subtle attention */
.animate-bounce-in  /* Success celebration */
.animate-spin       /* Loading */

/* Value Changes */
.value-positive-flash  /* Green flash for gains */
.value-negative-flash  /* Red flash for losses */
```

---

## Badge Variants

Limited to semantic meanings (Von Restorff Effect):

| Variant | Color | Usage |
|---------|-------|-------|
| `default` | Neutral gray | General information |
| `secondary` | Muted | Less important labels |
| `success` | Green | Positive states, gains |
| `warning` | Amber | Caution, expiring soon |
| `destructive` | Red | Errors, expired |
| `outline` | Border only | Subtle categorization |

### DeFi-Specific Badges

| Variant | Usage |
|---------|-------|
| `apy` | APY display with gradient |
| `live` | Live data indicator |
| `pt` / `yt` / `sy` / `lp` | Token type badges |

---

## Icons

Use Lucide icons consistently throughout the app:

```tsx
import { ArrowDown, Check, X, Loader2 } from 'lucide-react';
```

### Icon Sizes

| Context | Size |
|---------|------|
| Button icon | `h-4 w-4` |
| Inline with text | `h-4 w-4` |
| Standalone | `h-5 w-5` |
| Large display | `h-6 w-6` |

---

## Touch Targets

All interactive elements must meet minimum touch target sizes (44x44px):

```tsx
<button className="min-h-[44px] min-w-[44px]">
  <Icon className="h-5 w-5" />
</button>
```

---

## Loading States

### Skeleton Loading

Use `Skeleton` component for content placeholders:

```tsx
<Skeleton className="h-6 w-24" />
```

### Button Loading

```tsx
<Button disabled>
  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
  Processing...
</Button>
```

### Transaction Progress

Use `TxStatus` component for transaction states:
- `idle` - No active transaction
- `signing` - Awaiting wallet signature
- `pending` - Transaction submitted
- `success` - Transaction confirmed
- `error` - Transaction failed

---

## Accessibility

### Required Attributes

- All buttons must have accessible labels
- Forms must associate labels with inputs
- Color alone cannot convey meaning (use icons/text)
- Minimum contrast ratio: 4.5:1 (WCAG AA)

### ARIA Labels

```tsx
<Button aria-label="Swap token direction">
  <ArrowDown />
</Button>

<input aria-describedby="error-message" aria-invalid="true" />
<p id="error-message" role="alert">Insufficient balance</p>
```

### Keyboard Navigation

- All interactive elements must be focusable
- Tab order follows visual order
- Escape closes modals/dropdowns

---

## Component Patterns

### TokenInput

Standard token input with balance display:

```tsx
<TokenInput
  label="You pay"
  tokenAddress={address}
  tokenSymbol="ETH"
  value={amount}
  onChange={setAmount}
  error={validationError}
/>
```

### GasEstimate

Shows estimated transaction fee:

```tsx
<GasEstimate
  formattedFee={fee}
  isLoading={isEstimating}
  error={feeError}
/>
```

### FormRow

Key-value display in info sections:

```tsx
<FormRow label="Exchange Rate" value="1:1" />
<FormRow
  label="Price Impact"
  value={<span className="text-destructive">-2.5%</span>}
/>
```

---

## Do's and Don'ts

### Do
- Use semantic color tokens
- Follow the spacing scale
- Provide immediate feedback for all interactions
- Show loading states for async operations
- Use progressive disclosure for complex options

### Don't
- Use raw color values
- Mix spacing inconsistently
- Leave interactions without visual feedback
- Show empty states without helpful messaging
- Overwhelm users with all options at once

---

*Version: 1.0*
*Last Updated: 2025-12-28*
