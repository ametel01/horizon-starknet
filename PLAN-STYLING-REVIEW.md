# Implementation Plan: Frontend Styling Review

**Specification:** FRONTEND_ANALYSIS-20260111-122743.md
**Scope:** Visual polish and micro-interaction improvements for Homepage and Mint Page

---

## Phase 1: CSS Foundation Extensions

Extend the existing design system with new utility classes needed for subsequent phases.

### Phase Validation
```bash
cd packages/frontend && bun run check
```

### Step 1: Add text-highlight-underline utility

#### Goal
Create a utility class for animated underline effect on footer links that reveals on hover.

#### Files
- `packages/frontend/src/app/globals.css` - Add `.text-highlight-underline` utility after the existing `.text-highlight-hover` class (around line 875)

#### Validation
```bash
cd packages/frontend && bun run check && grep -n "text-highlight-underline" src/app/globals.css
```

#### Failure modes
- CSS syntax error causing build failure
- Selector specificity conflict with existing utilities

---

### Step 2: Add card-hover-glow-enhanced utility

#### Goal
Create an enhanced version of the existing `.card-hover-glow` with stronger border glow for StatCard hover states.

#### Files
- `packages/frontend/src/app/globals.css` - Add `.card-hover-glow-enhanced` after `.card-hover-glow` (line 631)

#### Validation
```bash
cd packages/frontend && bun run check && grep -n "card-hover-glow-enhanced" src/app/globals.css
```

#### Failure modes
- Missing CSS variable references
- Incorrect OKLCH color syntax

---

### Step 3: Add tab-sliding-indicator utilities

#### Goal
Create CSS utilities for a sliding background indicator on the tabs component using CSS transforms.

#### Files
- `packages/frontend/src/app/globals.css` - Add `.tab-indicator-slide` utility with transform-based animation in the interactive animations section (after line 630)

#### Validation
```bash
cd packages/frontend && bun run check && grep -n "tab-indicator" src/app/globals.css
```

#### Failure modes
- Transform conflicts with existing tab styles
- Animation not respecting prefers-reduced-motion

---

### Step 4: Add input-focus-glow-enhanced utility

#### Goal
Enhance the existing `.input-focus-glow` with a more prominent glow effect for form inputs.

#### Files
- `packages/frontend/src/app/globals.css` - Add `.input-focus-glow-enhanced` after the existing input utilities (around line 846)

#### Validation
```bash
cd packages/frontend && bun run check && grep -n "input-focus-glow-enhanced" src/app/globals.css
```

#### Failure modes
- Ring overlap with existing focus-visible styles
- Color inconsistency between light/dark modes

---

### Step 5: Add header-scroll-shadow utility

#### Goal
Create a subtle shadow utility for the header that can be conditionally applied on scroll.

#### Files
- `packages/frontend/src/app/globals.css` - Add `.header-scroll-shadow` utility in the shadow utilities section (after line 420)

#### Validation
```bash
cd packages/frontend && bun run check && grep -n "header-scroll-shadow" src/app/globals.css
```

#### Failure modes
- Shadow clipping with backdrop-blur
- Incorrect z-index layering

---

## Phase 2: Footer and Typography Enhancements

Apply visual polish to footer links and improve text contrast.

### Phase Validation
```bash
cd packages/frontend && bun run check && bun run test
```

### Step 1: Apply underline animation to footer links

#### Goal
Add the `.text-highlight-underline` class to footer navigation links for animated underline on hover.

#### Files
- `packages/frontend/src/shared/layout/Footer.tsx` - Modify FooterLinkGroup link className (line 66) to add underline animation

#### Validation
```bash
cd packages/frontend && bun run check && grep -n "text-highlight-underline" src/shared/layout/Footer.tsx
```

#### Failure modes
- Class not applied correctly due to cn() ordering
- Transition conflict with existing transition-colors

---

### Step 2: Increase subtitle contrast in globals.css

#### Goal
Slightly increase the lightness of muted-foreground color in dark mode for better readability.

#### Files
- `packages/frontend/src/app/globals.css` - Adjust `--muted-foreground` value in `.dark` selector (around line 160) from `oklch(0.705...)` to `oklch(0.73...)`

#### Validation
```bash
cd packages/frontend && bun run check && grep -n "muted-foreground" src/app/globals.css | head -5
```

#### Failure modes
- Color too bright, reducing hierarchy distinction
- Insufficient contrast ratio change (should verify with contrast checker)

---

## Phase 3: StatCard Hover Enhancement

Add enhanced border glow effect to StatCard on hover.

### Phase Validation
```bash
cd packages/frontend && bun run check && bun run test
```

### Step 1: Apply enhanced glow to StatCard

#### Goal
Add the `.card-hover-glow-enhanced` class to StatCard for a more prominent hover effect.

#### Files
- `packages/frontend/src/shared/ui/StatCard.tsx` - Add the class to Card component className (line 97)

#### Validation
```bash
cd packages/frontend && bun run check && grep -n "card-hover-glow" src/shared/ui/StatCard.tsx
```

#### Failure modes
- Conflicts with existing transition-all duration-300
- Glow not visible on light mode

---

## Phase 4: Tab Sliding Indicator

Implement a CSS-based sliding indicator for the tabs component.

### Phase Validation
```bash
cd packages/frontend && bun run check && bun run test
```

### Step 1: Add relative positioning to TabsList

#### Goal
Add `relative` positioning to TabsList to contain the sliding indicator pseudo-element.

#### Files
- `packages/frontend/src/shared/ui/tabs.tsx` - Modify tabsListVariants base styles (line 24) to include `relative`

#### Validation
```bash
cd packages/frontend && bun run check && grep -n "relative" src/shared/ui/tabs.tsx
```

#### Failure modes
- Breaking existing tab layout
- Z-index stacking issues

---

### Step 2: Add sliding background to active TabsTrigger

#### Goal
Replace the current active background with a smooth transition using CSS transforms. Update the TabsTrigger active state to use a sliding background effect.

#### Files
- `packages/frontend/src/shared/ui/tabs.tsx` - Modify TabsTrigger className (lines 57-62) to use transition-based background positioning

#### Validation
```bash
cd packages/frontend && bun run check
```

#### Failure modes
- Transform animation not smooth
- Dark mode styling inconsistency

---

## Phase 5: Input and Select Focus Enhancement

Improve focus states on form inputs and select components.

### Phase Validation
```bash
cd packages/frontend && bun run check && bun run test
```

### Step 1: Enhance Input focus glow

#### Goal
Apply the enhanced input focus glow to the Input component for more prominent focus feedback.

#### Files
- `packages/frontend/src/shared/ui/Input.tsx` - Modify Input className (line 31-33) to use enhanced glow on focus

#### Validation
```bash
cd packages/frontend && bun run check && grep -n "focus" src/shared/ui/Input.tsx
```

#### Failure modes
- Glow too strong, causing visual noise
- Ring color not matching primary color

---

### Step 2: Enhance SelectTrigger focus glow

#### Goal
Apply consistent focus glow styling to the SelectTrigger component.

#### Files
- `packages/frontend/src/shared/ui/select.tsx` - Modify SelectTrigger className (line 42-43) to add enhanced focus glow

#### Validation
```bash
cd packages/frontend && bun run check && grep -n "focus" src/shared/ui/select.tsx
```

#### Failure modes
- Inconsistent with Input focus styling
- Glow clipped by overflow:hidden on parent

---

## Phase 6: Header Scroll Shadow

Add scroll-triggered shadow to the navigation header.

### Phase Validation
```bash
cd packages/frontend && bun run check && bun run test
```

### Step 1: Add scroll state tracking to Header

#### Goal
Add a useEffect hook to track scroll position and conditionally apply the shadow class.

#### Files
- `packages/frontend/src/shared/layout/Header.tsx` - Add scroll state and useEffect after line 31, modify header className (line 50)

#### Validation
```bash
cd packages/frontend && bun run check && grep -n "scroll" src/shared/layout/Header.tsx
```

#### Failure modes
- Scroll listener causing performance issues (should use passive listener)
- Shadow flickering near threshold

---

## Phase 7: MarketCard Hover Gradient Enhancement

Enhance the MarketCard hover gradient overlay for more visual impact.

### Phase Validation
```bash
cd packages/frontend && bun run check && bun run test
```

### Step 1: Strengthen MarketCard hover gradient

#### Goal
Increase the opacity of the hover gradient overlay on MarketCard for more prominent visual feedback.

#### Files
- `packages/frontend/src/entities/market/ui/MarketCard.tsx` - Modify gradient overlay className (line 147) to increase hover opacity values

#### Validation
```bash
cd packages/frontend && bun run check && grep -n "group-hover" src/entities/market/ui/MarketCard.tsx | head -5
```

#### Failure modes
- Gradient too strong, obscuring card content
- Animation timing mismatch with border glow

---

## Summary

| Phase | Description | Files Modified | Effort |
|-------|-------------|----------------|--------|
| 1 | CSS Foundation Extensions | globals.css | Low |
| 2 | Footer and Typography | Footer.tsx, globals.css | Low |
| 3 | StatCard Hover | StatCard.tsx | Low |
| 4 | Tab Sliding Indicator | tabs.tsx | Medium |
| 5 | Input/Select Focus | Input.tsx, select.tsx | Low |
| 6 | Header Scroll Shadow | Header.tsx | Low-Medium |
| 7 | MarketCard Hover | MarketCard.tsx | Low |

**Total files to modify:** 8 files
**New utilities to add:** 5 CSS utilities

---

## Dependencies

- Phase 1 must complete before Phases 2-7 (CSS utilities required)
- Phases 2-7 are independent and can be implemented in any order after Phase 1
- All phases use existing dependencies (no new packages required)

---

## Out of Scope

Based on the specification's "Clarifications Needed" section, the following are explicitly deferred:

1. **Secondary accent color (teal)** - Significant brand decision requiring design approval
2. **Footer social icons** - Not confirmed as required
3. **"What You Can Do" section** - Location unclear in current codebase
4. **Empty state styling** - Requires separate specification for "0" vs "---" display
