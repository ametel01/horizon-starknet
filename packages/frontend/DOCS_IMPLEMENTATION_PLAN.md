# User Documentation Implementation Plan

This plan outlines how to integrate user-facing documentation directly into the Horizon Protocol frontend, accessible from the navigation bar.

---

## 1. Technical Implementation

### Approach: In-App Documentation with MDX

Use **MDX** (Markdown + JSX) for documentation pages, allowing:
- Rich markdown content with diagrams
- Interactive components (calculators, examples)
- Consistent styling with app theme
- No external dependencies

### File Structure

```
src/
├── app/
│   └── docs/
│       ├── layout.tsx              # Docs layout with sidebar
│       ├── page.tsx                # Docs landing (redirects to intro)
│       ├── what-is-horizon/
│       │   └── page.mdx
│       ├── how-it-works/
│       │   ├── page.mdx            # Overview
│       │   ├── yield-tokens/
│       │   │   └── page.mdx
│       │   └── amm-mechanics/
│       │       └── page.mdx
│       ├── getting-started/
│       │   └── page.mdx
│       ├── guides/
│       │   ├── page.mdx
│       │   ├── earn-fixed-yield/
│       │   │   └── page.mdx
│       │   ├── trade-yield/
│       │   │   └── page.mdx
│       │   ├── provide-liquidity/
│       │   │   └── page.mdx
│       │   └── manage-positions/
│       │       └── page.mdx
│       ├── mechanics/
│       │   ├── page.mdx
│       │   ├── pricing/
│       │   │   └── page.mdx
│       │   ├── apy-calculation/
│       │   │   └── page.mdx
│       │   └── redemption/
│       │       └── page.mdx
│       ├── risks/
│       │   └── page.mdx
│       ├── faq/
│       │   └── page.mdx
│       └── glossary/
│           └── page.mdx
├── components/
│   └── docs/
│       ├── DocsLayout.tsx          # Sidebar + content wrapper
│       ├── DocsSidebar.tsx         # Navigation sidebar
│       ├── DocsSearch.tsx          # Search functionality
│       ├── TableOfContents.tsx     # In-page navigation
│       ├── Callout.tsx             # Info/warning/danger boxes
│       ├── Diagram.tsx             # Wrapper for diagrams
│       ├── YieldCalculator.tsx     # Interactive APY calculator
│       ├── TokenFlowDiagram.tsx    # PT/YT flow visualization
│       └── CodeExample.tsx         # Code/formula display
└── content/
    └── diagrams/                   # SVG/PNG diagram assets
```

### Dependencies to Add

```bash
bun add @next/mdx @mdx-js/loader @mdx-js/react
bun add rehype-slug rehype-autolink-headings  # For heading anchors
bun add remark-gfm                            # GitHub-flavored markdown
```

### Next.js Configuration

```typescript
// next.config.ts addition
import createMDX from '@next/mdx'
import remarkGfm from 'remark-gfm'
import rehypeSlug from 'rehype-slug'

const withMDX = createMDX({
  options: {
    remarkPlugins: [remarkGfm],
    rehypePlugins: [rehypeSlug],
  },
})

export default withMDX(nextConfig)
```

### Navigation Integration

Add "Docs" link to header navigation (both Simple and Advanced modes):

```typescript
// In Header.tsx - add to nav links
{ href: '/docs', label: 'Docs' }
```

---

## 2. Information Architecture

Following the 7-9 top-level sections guideline:

| Section | User Question Answered |
|---------|----------------------|
| What is Horizon | "What does this protocol do?" |
| How It Works | "How do these tokens work?" |
| Getting Started | "How do I start using this?" |
| Guides | "How do I [specific task]?" |
| Mechanics | "What's the math behind this?" |
| Risks | "What can go wrong?" |
| FAQ | "Quick answers to common questions" |
| Glossary | "What does [term] mean?" |

### Page Depth

```
docs/                           # Level 1
├── what-is-horizon/            # Level 2
├── how-it-works/               # Level 2
│   ├── yield-tokens/           # Level 3 (max depth)
│   └── amm-mechanics/          # Level 3
├── guides/                     # Level 2
│   ├── earn-fixed-yield/       # Level 3
│   └── ...
└── ...
```

---

## 3. Content Specification

### 3.1 What is Horizon (`/docs/what-is-horizon`)

**Summary:** Horizon lets you lock in guaranteed yields or trade future yield on Starknet.

**Content:**
- One-paragraph protocol description
- Three core value propositions:
  1. Lock in fixed yields (for conservative users)
  2. Trade yield exposure (for active traders)
  3. Earn fees by providing liquidity
- Visual: Simple flow diagram showing deposit → split → outcomes
- Who this is for (not developer docs)
- Link to Getting Started

**Word count:** ~400

---

### 3.2 How It Works (`/docs/how-it-works`)

**Summary:** Understand the tokens and trading mechanics behind Horizon.

**Sub-pages:**

#### 3.2.1 Yield Tokens (`/docs/how-it-works/yield-tokens`)

**Summary:** When you deposit, your position splits into Principal Tokens and Yield Tokens.

**Content:**
- What is Standardized Yield (SY) - the wrapper
- What are Principal Tokens (PT):
  - Represents your principal
  - Redeemable for full value at maturity
  - Trades at discount before maturity = your fixed yield
- What are Yield Tokens (YT):
  - Represents yield rights until maturity
  - Collects variable yield from underlying asset
  - Expires worthless at maturity
- Visual: Timeline diagram showing PT converging to 1, YT decaying to 0
- The fundamental equation: `PT Price + YT Price = Underlying Price`
- Link to Mechanics for detailed math

**Word count:** ~600

#### 3.2.2 AMM Mechanics (`/docs/how-it-works/amm-mechanics`)

**Summary:** The Horizon AMM prices Principal Tokens based on time to maturity and demand.

**Content:**
- How PT/SY pools work (not PT/YT directly)
- Why time matters: the pricing curve shifts as expiry approaches
- What is implied yield and how it's derived from PT price
- Visual: Curve diagram showing PT price approaching 1 at expiry
- Liquidity provider role
- Link to Trading guide

**Word count:** ~500

---

### 3.3 Getting Started (`/docs/getting-started`)

**Summary:** Get set up and make your first deposit in 5 minutes.

**Content:**
- Prerequisites:
  - Starknet wallet (Argent X or Braavos)
  - Supported tokens (list with links)
  - Network (Mainnet/Sepolia)
- Step-by-step first deposit (Simple mode):
  1. Connect wallet
  2. Select market and amount
  3. Choose fixed or variable
  4. Confirm transaction
- Screenshots for each step
- What happens next (when you can withdraw, how to track)
- Link to Guides for specific strategies

**Word count:** ~500

---

### 3.4 Guides (`/docs/guides`)

**Summary:** Step-by-step instructions for every action you can take on Horizon.

**Sub-pages:**

#### 3.4.1 Earn Fixed Yield (`/docs/guides/earn-fixed-yield`)

**Summary:** Lock in a guaranteed APY by holding Principal Tokens until maturity.

**Content:**
- Goal: Predictable returns regardless of rate changes
- When to use: When you expect rates to drop, or want certainty
- Step-by-step:
  1. Go to Earn/Mint page
  2. Select market and amount
  3. Review the fixed APY offered
  4. Confirm deposit
  5. Wait until maturity (or trade early)
- What you receive: PT tokens
- How your yield is calculated (price discount to par)
- Common mistakes:
  - Withdrawing early at a loss
  - Not understanding expiry dates
- Link to Redemption mechanics

**Word count:** ~450

#### 3.4.2 Trade Yield (`/docs/guides/trade-yield`)

**Summary:** Buy or sell exposure to future yield movements.

**Content:**
- Goal: Profit from yield rate changes
- Strategies:
  - Long YT: Bet rates will stay high or increase
  - Short YT (buy PT): Bet rates will drop
- Step-by-step trading:
  1. Go to Trade page
  2. Select market
  3. Choose swap direction
  4. Review price impact and slippage
  5. Confirm swap
- Reading the trade interface:
  - Implied yield display
  - Price impact warning
  - Slippage settings
- Common mistakes:
  - High slippage on large trades
  - Holding YT past expiry

**Word count:** ~500

#### 3.4.3 Provide Liquidity (`/docs/guides/provide-liquidity`)

**Summary:** Earn trading fees by adding liquidity to PT/SY pools.

**Content:**
- Goal: Earn yield from swap fees
- What you provide: SY + PT (or single-sided with auto-balancing)
- What you receive: LP tokens representing pool share
- Step-by-step:
  1. Go to Pools page
  2. Select pool
  3. Enter amounts (shows balanced ratio)
  4. Review pool share and fee APY
  5. Confirm deposit
- Understanding LP returns:
  - Swap fees
  - Underlying yield pass-through
  - Impermanent loss considerations
- Removing liquidity
- Common mistakes:
  - Not understanding IL near expiry
  - Providing to low-volume pools

**Word count:** ~550

#### 3.4.4 Manage Positions (`/docs/guides/manage-positions`)

**Summary:** Track, claim, and redeem your Horizon positions.

**Content:**
- Portfolio overview explained:
  - Position cards breakdown
  - USD values and PnL
  - Time to expiry
- Claiming yield from YT:
  - When yield accrues
  - How to claim
  - Tax considerations note
- Redeeming at maturity:
  - PT redemption (automatic or manual)
  - What happens to YT
- Early exit options:
  - Selling on AMM
  - PT+YT burn (before expiry)
- Step-by-step for each action

**Word count:** ~500

---

### 3.5 Mechanics (`/docs/mechanics`)

**Summary:** Technical details for users who want to understand the math.

**Sub-pages:**

#### 3.5.1 Pricing (`/docs/mechanics/pricing`)

**Summary:** How PT and YT prices are determined.

**Content:**
- PT pricing formula:
  ```
  PT_Price = 1 / (1 + implied_yield)^time_to_expiry
  ```
- YT pricing (derived):
  ```
  YT_Price = Underlying_Price - PT_Price
  ```
- AMM curve explanation:
  - Logit curve for rate discovery
  - Anchor mechanism (rate mean reversion)
  - Rate scalar (volatility parameter)
- Interactive calculator component
- Visual: Price sensitivity to yield changes

**Word count:** ~600

#### 3.5.2 APY Calculation (`/docs/mechanics/apy-calculation`)

**Summary:** How yields are calculated and displayed.

**Content:**
- Implied APY from PT price:
  ```
  Implied_APY = (1 / PT_Price)^(365 / days_to_expiry) - 1
  ```
- Underlying APY: Current yield of the wrapped asset
- LP APY components:
  - Base yield (underlying pass-through)
  - Swap fee yield
  - Implied rate exposure
- APY vs APR explanation
- Interactive APY breakdown component
- Historical yield disclaimer

**Word count:** ~500

#### 3.5.3 Redemption (`/docs/mechanics/redemption`)

**Summary:** How token redemption works before and after maturity.

**Content:**
- PY Index explained:
  ```
  py_index = max(exchange_rate, stored_index)
  ```
  (Monotonically non-decreasing)
- Pre-expiry redemption:
  - Requires matching PT + YT
  - Returns SY at current index
- Post-expiry redemption:
  - PT only (YT expired)
  - Returns underlying at 1:1
- Minting mechanics:
  ```
  amount_minted = sy_deposited * py_index
  ```
- Visual: Timeline of redemption scenarios

**Word count:** ~450

---

### 3.6 Risks (`/docs/risks`)

**Summary:** Understand what can go wrong before you deposit.

**Content:**
- **Smart Contract Risk**
  - Protocol is unaudited/audited (status)
  - Bug bounty program (if exists)
  - Upgrade mechanisms

- **Yield Risk**
  - YT can become worthless if yield drops to zero
  - Historical yield ≠ future yield
  - Negative real rates possible

- **Liquidity Risk**
  - May not be able to exit large positions
  - Price impact on trades
  - LP positions may have IL

- **Expiry Risk**
  - YT expires worthless - don't hold past maturity
  - PT must be redeemed (not automatic in v1)

- **Market Risk**
  - PT price can drop below fair value in panics
  - Implied yield can spike, causing losses

- **What if scenarios:**
  - "What if the underlying depegs?"
  - "What if no one buys my tokens?"
  - "What if I forget about expiry?"

**Word count:** ~700

---

### 3.7 FAQ (`/docs/faq`)

**Summary:** Quick answers to the most common questions.

**Content (Q&A format):**

**General:**
- What's the minimum deposit?
- What tokens are supported?
- How long until I can withdraw?

**Yield:**
- How is my fixed yield guaranteed?
- Why did my YT value drop?
- When do I receive yield?

**Trading:**
- Why is price impact so high?
- Can I swap YT directly?
- What is slippage?

**Technical:**
- What happens at expiry?
- How do I see my positions on-chain?
- Is there a mobile app?

Each answer: 50-100 words with links to detailed docs.

**Word count:** ~600

---

### 3.8 Glossary (`/docs/glossary`)

**Summary:** Definitions for all terms used in Horizon.

**Content (alphabetical):**
- AMM (Automated Market Maker)
- APY (Annual Percentage Yield)
- Expiry/Maturity
- Implied Yield
- Impermanent Loss
- LP Token
- Principal Token (PT)
- PY Index
- Slippage
- Standardized Yield (SY)
- Underlying Asset
- Yield Token (YT)

Each: 1-2 sentence definition + link to relevant docs page.

**Word count:** ~400

---

## 4. Components to Build

### 4.1 Layout Components

| Component | Purpose |
|-----------|---------|
| `DocsLayout.tsx` | Wrapper with sidebar, header, TOC |
| `DocsSidebar.tsx` | Left navigation with sections |
| `TableOfContents.tsx` | Right-side in-page navigation |
| `DocsBreadcrumb.tsx` | Current location indicator |
| `DocsFooter.tsx` | Prev/next page navigation |

### 4.2 Content Components

| Component | Purpose |
|-----------|---------|
| `Callout.tsx` | Info/warning/danger/tip boxes |
| `CodeBlock.tsx` | Formula and code display |
| `Diagram.tsx` | Image wrapper with caption |
| `Step.tsx` | Numbered step in a guide |
| `StepList.tsx` | Container for steps |

### 4.3 Interactive Components

| Component | Purpose |
|-----------|---------|
| `YieldCalculator.tsx` | Input amount/time, see APY |
| `TokenFlowDiagram.tsx` | Animated deposit → split flow |
| `PriceSimulator.tsx` | See how yield changes affect prices |
| `RedemptionCalculator.tsx` | Calculate redemption amounts |

### 4.4 Integration Components

| Component | Purpose |
|-----------|---------|
| `TryItButton.tsx` | Links to relevant app page |
| `CurrentMarketExample.tsx` | Shows real market data |
| `WalletPrompt.tsx` | Nudge to connect for examples |

---

## 5. Diagrams Required

### Essential Diagrams (Phase 1)

1. **Protocol Overview Flow**
   - Deposit → SY → Split → PT + YT → Outcomes

2. **PT/YT Timeline**
   - X-axis: time to expiry
   - Y-axis: token value
   - Shows PT converging to 1, YT decaying to 0

3. **AMM Curve**
   - Rate discovery visualization
   - Shows how trades move implied yield

4. **Redemption Scenarios**
   - Pre-expiry: PT + YT → SY
   - Post-expiry: PT → Underlying

### Enhanced Diagrams (Phase 2)

5. **LP Position Breakdown**
   - Pool composition visualization

6. **Yield Accrual Timeline**
   - When and how yield accumulates

---

## 6. Implementation Phases

### Phase 1: Foundation (Week 1-2 equivalent effort)

**Tasks:**
- [x] Set up MDX with Next.js
- [x] Create DocsLayout and DocsSidebar
- [x] Build Callout and CodeBlock components
- [x] Add "Docs" to navigation
- [x] Write: What is Horizon
- [x] Write: Getting Started
- [x] Create Protocol Overview diagram

**Deliverable:** Basic docs accessible from nav with intro content.

### Phase 2: Core Content (Week 2-3 equivalent effort)

**Tasks:**
- [x] Write: How It Works (both sub-pages)
- [x] Write: All 4 Guides
- [x] Build Step/StepList components
- [x] Create PT/YT Timeline diagram
- [x] Add TableOfContents component
- [x] Add DocsFooter with prev/next

**Deliverable:** Complete task-oriented documentation.

### Phase 3: Technical Depth (Week 3-4 equivalent effort)

**Tasks:**
- [x] Write: All 3 Mechanics pages
- [x] Build YieldCalculator component
- [x] Build PriceSimulator component
- [x] Create AMM Curve diagram
- [x] Create Redemption diagram
- [x] Add formula rendering (KaTeX optional)

**Deliverable:** Technical documentation with interactive elements.

### Phase 4: Polish (Week 4-5 equivalent effort)

**Tasks:**
- [x] Write: Risks page
- [x] Write: FAQ
- [x] Write: Glossary
- [x] Build search functionality
- [x] Add TryItButton integration
- [x] Mobile responsiveness testing
- [x] Cross-link all pages
- [x] Review for consistency

**Deliverable:** Complete, polished documentation.

---

## 7. Design Specifications

### Layout

```
┌────────────────────────────────────────────────────────┐
│  Header (existing app header with Docs active)         │
├──────────┬─────────────────────────────┬───────────────┤
│          │                             │               │
│ Sidebar  │    Content Area             │  TOC          │
│ (240px)  │    (flex-1)                 │  (200px)      │
│          │                             │               │
│ - What   │  # Page Title               │  - Section 1  │
│ - How    │                             │  - Section 2  │
│ - Start  │  Content...                 │  - Section 3  │
│ - Guides │                             │               │
│   └ Earn │  [Diagram]                  │               │
│   └ Trade│                             │               │
│ - Mech.  │  More content...            │               │
│ - Risks  │                             │               │
│ - FAQ    │                             │               │
│ - Gloss. │  ┌─────────┬─────────┐      │               │
│          │  │ ← Prev  │ Next →  │      │               │
│          │  └─────────┴─────────┘      │               │
└──────────┴─────────────────────────────┴───────────────┘
```

### Mobile Layout

- Sidebar becomes hamburger menu
- TOC collapses into expandable section
- Full-width content

### Typography

- Headings: Same as app (font-bold)
- Body: 16px, 1.6 line-height
- Code: Monospace, background highlight
- Max content width: 720px

### Colors (using existing theme)

- Callout Info: Blue accent
- Callout Warning: Yellow accent
- Callout Danger: Red accent
- Code blocks: Muted background
- Links: Primary color

---

## 8. Success Metrics

### Engagement
- Docs page views
- Time on page (target: >2 min for guides)
- Scroll depth

### Effectiveness
- Support ticket reduction
- FAQ coverage of actual questions
- User feedback surveys

### Maintenance
- Last updated tracking per page
- Broken link detection
- Content freshness reviews quarterly

---

## 9. Future Enhancements

- **Search**: Full-text search with keyboard shortcut (Cmd+K)
- **Versioning**: Support for protocol version differences
- **Localization**: Multi-language support
- **Video**: Embedded tutorial videos
- **Feedback**: Per-page "Was this helpful?" widget
- **AI Assistant**: Claude-powered doc search/Q&A

---

## 10. File Checklist

```
[ ] next.config.ts (MDX config)
[ ] src/app/docs/layout.tsx
[ ] src/app/docs/page.tsx
[ ] src/app/docs/what-is-horizon/page.mdx
[ ] src/app/docs/how-it-works/page.mdx
[ ] src/app/docs/how-it-works/yield-tokens/page.mdx
[ ] src/app/docs/how-it-works/amm-mechanics/page.mdx
[ ] src/app/docs/getting-started/page.mdx
[ ] src/app/docs/guides/page.mdx
[ ] src/app/docs/guides/earn-fixed-yield/page.mdx
[ ] src/app/docs/guides/trade-yield/page.mdx
[ ] src/app/docs/guides/provide-liquidity/page.mdx
[ ] src/app/docs/guides/manage-positions/page.mdx
[ ] src/app/docs/mechanics/page.mdx
[ ] src/app/docs/mechanics/pricing/page.mdx
[ ] src/app/docs/mechanics/apy-calculation/page.mdx
[ ] src/app/docs/mechanics/redemption/page.mdx
[ ] src/app/docs/risks/page.mdx
[ ] src/app/docs/faq/page.mdx
[ ] src/app/docs/glossary/page.mdx
[ ] src/components/docs/DocsLayout.tsx
[ ] src/components/docs/DocsSidebar.tsx
[ ] src/components/docs/TableOfContents.tsx
[ ] src/components/docs/Callout.tsx
[ ] src/components/docs/CodeBlock.tsx
[ ] src/components/docs/Step.tsx
[ ] src/components/docs/YieldCalculator.tsx
[ ] public/docs/diagrams/protocol-overview.svg
[ ] public/docs/diagrams/pt-yt-timeline.svg
[ ] public/docs/diagrams/amm-curve.svg
[ ] public/docs/diagrams/redemption-flow.svg
```
