# Documentation Update Implementation Plan

**Based on:** DOCS_UPDATE_RESEARCH.md
**Target:** `/packages/frontend/src/app/docs`
**Generated:** 2026-01-18

---

## Phase 1: Sidebar Navigation Updates **COMPLETE**

Add new documentation pages to the navigation structure before creating them.

### Phase Validation
```bash
cd packages/frontend && bun run check
```

### Step 1: Add Analytics link to sidebar navigation **COMPLETE**

#### Goal
Add Analytics page to the Guides section in DocsSidebar.tsx navigation array.

#### Files
- `packages/frontend/src/features/docs/ui/DocsSidebar.tsx` - Add `{ title: 'Analytics', href: '/docs/guides/analytics' }` to Guides children array after "Manage Positions"

#### Validation
```bash
grep -q "Analytics.*guides/analytics" packages/frontend/src/features/docs/ui/DocsSidebar.tsx && echo "OK"
```

#### Failure modes
- Incorrect array position breaks existing navigation
- Typo in href causes 404

---

### Step 2: Add Flash Mint link to sidebar navigation **COMPLETE**

#### Goal
Add Flash Mint page to the Mechanics section for advanced/developer documentation.

#### Files
- `packages/frontend/src/features/docs/ui/DocsSidebar.tsx` - Add `{ title: 'Flash Mint', href: '/docs/mechanics/flash-mint' }` to Mechanics children array after "Redemption"

#### Validation
```bash
grep -q "Flash Mint.*mechanics/flash-mint" packages/frontend/src/features/docs/ui/DocsSidebar.tsx && echo "OK"
```

#### Failure modes
- Incorrect array position breaks existing navigation
- Typo in href causes 404

---

## Phase 2: Create New Documentation Pages **COMPLETE**

Create the two new documentation pages identified as P0 priority.

### Phase Validation
```bash
cd packages/frontend && bun run check
```

### Step 3: Create Analytics guide page **COMPLETE**

#### Goal
Create comprehensive analytics documentation covering yield curve, TVL stats, PT convergence, market depth, liquidity health score, and advanced analytics section.

#### Files
- `packages/frontend/src/app/docs/guides/analytics/page.mdx` - Create new file with Analytics documentation following existing guide structure (imports, sections, tables, DocsNavigation)

#### Validation
```bash
test -f packages/frontend/src/app/docs/guides/analytics/page.mdx && echo "OK"
```

#### Failure modes
- Missing directory (need to create /analytics folder)
- Missing imports cause build errors
- Inconsistent styling with other guides

---

### Step 4: Create Flash Mint mechanics page **COMPLETE**

#### Goal
Create flash minting documentation for advanced users/integrators explaining atomic PT+YT minting with callback.

#### Files
- `packages/frontend/src/app/docs/mechanics/flash-mint/page.mdx` - Create new file with Flash Mint documentation including use cases, requirements, and developer warning

#### Validation
```bash
test -f packages/frontend/src/app/docs/mechanics/flash-mint/page.mdx && echo "OK"
```

#### Failure modes
- Missing directory (need to create /flash-mint folder)
- Technical inaccuracy in callback interface description
- Missing warning about advanced nature

---

## Phase 3: Update Getting Started Page **COMPLETE**

Add Simple vs Advanced mode documentation to the Getting Started page.

### Phase Validation
```bash
cd packages/frontend && bun run check
```

### Step 5: Add Simple vs Advanced Mode section to Getting Started **COMPLETE**

#### Goal
Add new section after "Before You Begin" explaining Simple Mode (default) vs Advanced Mode, feature differences, and how to toggle.

#### Files
- `packages/frontend/src/app/docs/getting-started/page.mdx` - Add "Simple vs Advanced Mode" section with Callout explaining mode toggle between lines 17-18 (after prerequisites, before Step 1)

#### Validation
```bash
grep -q "Simple vs Advanced\|Simple Mode\|Advanced Mode" packages/frontend/src/app/docs/getting-started/page.mdx && echo "OK"
```

#### Failure modes
- Section placement disrupts reading flow
- Mode explanation unclear to new users
- Missing mention of how to toggle (top navigation)

---

## Phase 4: Update Manage Positions Guide **COMPLETE**

Add multi-reward system, claim all, LP details, and unwrap SY documentation.

### Phase Validation
```bash
cd packages/frontend && bun run check
```

### Step 6: Add Portfolio Summary section with metrics **COMPLETE**

#### Goal
Add section explaining Total Portfolio Value, Total PnL, Claimable Yield summary, Active Positions count, and Claim All button.

#### Files
- `packages/frontend/src/app/docs/guides/manage-positions/page.mdx` - Add "Portfolio Summary" section after "Portfolio Overview" table (around line 45) with bullet list of summary metrics

#### Validation
```bash
grep -q "Portfolio Summary\|Claim All\|Total PnL" packages/frontend/src/app/docs/guides/manage-positions/page.mdx && echo "OK"
```

#### Failure modes
- Duplicates existing Portfolio Overview content
- Missing Claim All button explanation

---

### Step 7: Add Multi-Reward Claims section **COMPLETE**

#### Goal
Document the new multi-reward YT system: viewing available rewards, claiming rewards, and combined interest+rewards claims.

#### Files
- `packages/frontend/src/app/docs/guides/manage-positions/page.mdx` - Add "Claiming Rewards" section after "Claiming Yield" section (around line 62) explaining reward tokens, get_reward_tokens, claim_rewards

#### Validation
```bash
grep -q "Claiming Rewards\|reward tokens\|external rewards" packages/frontend/src/app/docs/guides/manage-positions/page.mdx && echo "OK"
```

#### Failure modes
- Confuses interest vs rewards terminology
- Missing mention that not all YT have rewards

---

### Step 8: Add LP Position Details section **COMPLETE**

#### Goal
Document LP position display: LP token balance, pool share percentage, reserve breakdown (SY + PT), and auto-compounding of fees.

#### Files
- `packages/frontend/src/app/docs/guides/manage-positions/page.mdx` - Add "LP Position Details" section after Position Actions Summary table (around line 147)

#### Validation
```bash
grep -q "LP Position\|pool share\|auto-compound" packages/frontend/src/app/docs/guides/manage-positions/page.mdx && echo "OK"
```

#### Failure modes
- Duplicates content from Provide Liquidity guide
- Missing pool share percentage explanation

---

### Step 9: Add Unwrap SY section **COMPLETE**

#### Goal
Document the unwrap SY functionality for converting SY tokens back to underlying assets.

#### Files
- `packages/frontend/src/app/docs/guides/manage-positions/page.mdx` - Add "Unwrapping SY" section after LP Position Details with step-by-step unwrap flow

#### Validation
```bash
grep -q "Unwrap\|underlying asset\|SY tokens" packages/frontend/src/app/docs/guides/manage-positions/page.mdx && echo "OK"
```

#### Failure modes
- Unclear when user would have SY vs PT/YT
- Missing context on when to unwrap

---

## Phase 5: Update Trade Yield Guide **COMPLETE**

Add dual-token swap and any-token mode documentation.

### Phase Validation
```bash
cd packages/frontend && bun run check
```

### Step 10: Add Any Token Swap section **COMPLETE**

#### Goal
Document the token aggregator mode allowing swaps from any ERC20 to PT/YT/SY and vice versa.

#### Files
- `packages/frontend/src/app/docs/guides/trade-yield/page.mdx` - Add "Swap with Any Token" section before Tips (around line 138) explaining toggle, input token selection, and route finding

#### Validation
```bash
grep -q "Any Token\|token aggregator\|any supported token" packages/frontend/src/app/docs/guides/trade-yield/page.mdx && echo "OK"
```

#### Failure modes
- Missing Advanced mode prerequisite mention
- Unclear that this uses token aggregator routing

---

## Phase 6: Update Provide Liquidity Guide **COMPLETE**

Add dual-token liquidity operations documentation.

### Phase Validation
```bash
cd packages/frontend && bun run check
```

### Step 11: Add Dual-Token Liquidity section **COMPLETE**

#### Goal
Document add_liquidity_dual_token_and_pt and remove_liquidity_dual_token_and_pt router functions.

#### Files
- `packages/frontend/src/app/docs/guides/provide-liquidity/page.mdx` - Add "Adding Liquidity with Any Token" and "Removing Liquidity to Any Token" sections after "Removing Liquidity" (around line 96)

#### Validation
```bash
grep -q "Any Token\|dual-token\|router converts" packages/frontend/src/app/docs/guides/provide-liquidity/page.mdx && echo "OK"
```

#### Failure modes
- Confusing flow compared to standard liquidity add
- Missing mention of potential rate differences

---

## Phase 7: Expand FAQ Page **COMPLETE**

Add slippage configuration, error messages, fee explanations, and faucet expansion.

### Phase Validation
```bash
cd packages/frontend && bun run check
```

### Step 12: Add slippage configuration FAQ **COMPLETE**

#### Goal
Add "How do I set slippage tolerance?" question explaining settings panel, recommended values.

#### Files
- `packages/frontend/src/app/docs/faq/page.mdx` - Add new question after "What is slippage?" (around line 80)

#### Validation
```bash
grep -q "slippage tolerance\|settings icon\|gear" packages/frontend/src/app/docs/faq/page.mdx && echo "OK"
```

#### Failure modes
- Inconsistent with actual UI (verify settings icon type)
- Missing recommended percentages

---

### Step 13: Add common error messages section **COMPLETE**

#### Goal
Add "Common Error Messages" section explaining HZN: slippage exceeded, HZN: expired, HZN: insufficient balance and solutions.

#### Files
- `packages/frontend/src/app/docs/faq/page.mdx` - Expand Troubleshooting section (around line 155) with specific error message explanations

#### Validation
```bash
grep -q "slippage exceeded\|HZN:\|Insufficient balance" packages/frontend/src/app/docs/faq/page.mdx && echo "OK"
```

#### Failure modes
- Error message text doesn't match actual contract errors
- Solutions don't address root cause

---

### Step 14: Add fee explanation FAQ **COMPLETE**

#### Goal
Add "What fees does Horizon charge?" question explaining interest fee, reward fee, and swap fees.

#### Files
- `packages/frontend/src/app/docs/faq/page.mdx` - Add new question in General section (around line 27)

#### Validation
```bash
grep -q "fees does Horizon\|Interest Fee\|Reward Fee\|Swap Fee" packages/frontend/src/app/docs/faq/page.mdx && echo "OK"
```

#### Failure modes
- Incorrect fee percentages (should say "typically" or "check market")
- Missing link to where to view fees

---

### Step 15: Expand faucet FAQ **COMPLETE**

#### Goal
Expand test token faucet question with detailed usage steps, limits, and what hrzSTRK is.

#### Files
- `packages/frontend/src/app/docs/faq/page.mdx` - Expand "How do I get test tokens?" answer (around line 145-147) with numbered steps and additional context

#### Validation
```bash
grep -q "100 hrzSTRK\|once every 24 hours\|mock yield-bearing" packages/frontend/src/app/docs/faq/page.mdx && echo "OK"
```

#### Failure modes
- Rate limit info outdated
- Missing wallet connection step

---

### Step 16: Add negative yield FAQ **COMPLETE**

#### Goal
Add "What if implied yield goes negative?" question explaining PT premium, implications for buyers.

#### Files
- `packages/frontend/src/app/docs/faq/page.mdx` - Add new question in Trading section (around line 80)

#### Validation
```bash
grep -q "negative\|premium\|PT trades above" packages/frontend/src/app/docs/faq/page.mdx && echo "OK"
```

#### Failure modes
- Overly technical explanation
- Missing warning about buying PT at premium

---

## Phase 8: Expand Glossary

Add new terms for v2.0 features and undocumented concepts.

### Phase Validation
```bash
cd packages/frontend && bun run check
```

### Step 17: Add Simple Mode and Advanced Mode terms **COMPLETE**

#### Goal
Add glossary entries for Simple Mode and Advanced Mode under S and A sections.

#### Files
- `packages/frontend/src/app/docs/glossary/page.mdx` - Add "Advanced Mode" after "APY" in A section, add "Simple Mode" in new S section area after "STRK"

#### Validation
```bash
grep -q "Simple Mode\|Advanced Mode" packages/frontend/src/app/docs/glossary/page.mdx && echo "OK"
```

#### Failure modes
- Inconsistent with Getting Started mode section
- Missing link to Getting Started

---

### Step 18: Add Reward Tokens and SYWithRewards terms **COMPLETE**

#### Goal
Add glossary entries for Reward Tokens under R section and SYWithRewards under S section.

#### Files
- `packages/frontend/src/app/docs/glossary/page.mdx` - Add "Reward Tokens" after "Redemption", add "SYWithRewards" after "Standardized Yield (SY)"

#### Validation
```bash
grep -q "Reward Tokens\|SYWithRewards" packages/frontend/src/app/docs/glossary/page.mdx && echo "OK"
```

#### Failure modes
- Circular definitions (must explain both clearly)
- Missing context on which tokens support rewards

---

### Step 19: Add Flash Mint and IFlashCallback terms **COMPLETE**

#### Goal
Add glossary entries for Flash Mint under F section and IFlashCallback under I section.

#### Files
- `packages/frontend/src/app/docs/glossary/page.mdx` - Add "Flash Mint" after "Fixed Yield", add "IFlashCallback" after "Implied Yield"

#### Validation
```bash
grep -q "Flash Mint\|IFlashCallback" packages/frontend/src/app/docs/glossary/page.mdx && echo "OK"
```

#### Failure modes
- Too technical for glossary format
- Missing link to Flash Mint mechanics page

---

### Step 20: Add fee-related terms

#### Goal
Add glossary entries for Interest Fee Rate, Reward Fee Rate, Expiry Divisor.

#### Files
- `packages/frontend/src/app/docs/glossary/page.mdx` - Add "Interest Fee Rate" in I section, "Reward Fee Rate" in R section, "Expiry Divisor" in E section

#### Validation
```bash
grep -q "Interest Fee Rate\|Reward Fee Rate\|Expiry Divisor" packages/frontend/src/app/docs/glossary/page.mdx && echo "OK"
```

#### Failure modes
- Expiry Divisor too technical (simplify explanation)
- Missing typical values

---

### Step 21: Add remaining utility terms

#### Goal
Add glossary entries for Token Aggregator, hrzSTRK, Faucet, Portfolio Value, PnL, Claim All, Unwrap.

#### Files
- `packages/frontend/src/app/docs/glossary/page.mdx` - Add terms in alphabetically appropriate sections: C (Claim All), F (Faucet), H (hrzSTRK), P (PnL, Portfolio Value), T (Token Aggregator), U (Unwrap)

#### Validation
```bash
grep -q "Token Aggregator\|hrzSTRK\|Faucet\|Portfolio Value\|PnL\|Claim All\|Unwrap" packages/frontend/src/app/docs/glossary/page.mdx && echo "OK"
```

#### Failure modes
- Missing alphabetical section headers for new letters (C, H)
- Inconsistent definition depth

---

## Phase 9: Update Risks Page

Add risks for new v2.0 features.

### Phase Validation
```bash
cd packages/frontend && bun run check
```

### Step 22: Add Reward Token Risks section

#### Goal
Document risks specific to external reward tokens: reward rate volatility, protocol dependency, smart contract risk of reward source.

#### Files
- `packages/frontend/src/app/docs/risks/page.mdx` - Add "Reward Token Risks" subsection under "Position-Specific Risks" (around line 120)

#### Validation
```bash
grep -q "Reward Token Risks\|external rewards\|reward rate" packages/frontend/src/app/docs/risks/page.mdx && echo "OK"
```

#### Failure modes
- Overly alarming without balanced perspective
- Missing that not all YT have rewards

---

### Step 23: Add Flash Mint Risks section

#### Goal
Document flash mint risks for integrators: callback implementation errors, reentrancy considerations, revert conditions.

#### Files
- `packages/frontend/src/app/docs/risks/page.mdx` - Add "Flash Mint Risks" subsection under "Operational Risks" (around line 136)

#### Validation
```bash
grep -q "Flash Mint Risks\|callback\|integrators" packages/frontend/src/app/docs/risks/page.mdx && echo "OK"
```

#### Failure modes
- Too technical for general risks page
- Missing note that this is developer-facing only

---

## Phase 10: Final Validation

Run full build and lint to ensure all documentation compiles correctly.

### Phase Validation
```bash
cd packages/frontend && bun run check && bun run build
```

### Step 24: Run typecheck and lint

#### Goal
Verify all MDX pages compile without errors and pass linting.

#### Files
- All modified files in `packages/frontend/src/app/docs/`

#### Validation
```bash
cd packages/frontend && bun run check
```

#### Failure modes
- Import errors in new MDX files
- MDX syntax errors
- TypeScript errors from component usage

---

### Step 25: Build documentation pages

#### Goal
Verify production build succeeds with all new pages.

#### Files
- All files in `packages/frontend/`

#### Validation
```bash
cd packages/frontend && bun run build
```

#### Failure modes
- Build errors from invalid MDX
- Missing pages cause 404 on navigation
- Sidebar links don't match actual pages

---
