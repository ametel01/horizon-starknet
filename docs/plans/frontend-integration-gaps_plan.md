# Documentation Update Implementation Plan

Based on DOCS_UPDATE_RESEARCH.md findings for `/packages/frontend/src/app/docs`.

---

## Phase 1: Core Navigation and New Page Setup

Add new documentation pages to the sidebar navigation and create file scaffolding for all new content.

### Phase Validation
```bash
cd packages/frontend && bun run check
```

### Step 1: Add Analytics guide entry to DocsSidebar

#### Goal
Add Analytics page link to the Guides section in the sidebar navigation.

#### Files
- `packages/frontend/src/features/docs/ui/DocsSidebar.tsx` - Add Analytics child to Guides section after Manage Positions (line 39)

#### Validation
```bash
grep -q "Analytics" packages/frontend/src/features/docs/ui/DocsSidebar.tsx && echo "OK"
```

#### Failure modes
- Navigation item placed in wrong section
- Incorrect href path

---

### Step 2: Create Analytics guide page

#### Goal
Create the analytics guide MDX file documenting yield curve, PT convergence, market depth, liquidity health score, and advanced analytics panels.

#### Files
- `packages/frontend/src/app/docs/guides/analytics/page.mdx` - Create new file with Analytics documentation

#### Validation
```bash
test -f packages/frontend/src/app/docs/guides/analytics/page.mdx && echo "OK"
```

#### Failure modes
- Missing directory creation
- Incorrect import paths

---

### Step 3: Add Flash Mint mechanics entry to DocsSidebar

#### Goal
Add Flash Mint page link to the Mechanics section in the sidebar navigation.

#### Files
- `packages/frontend/src/features/docs/ui/DocsSidebar.tsx` - Add Flash Mint child to Mechanics section after Redemption (line 48)

#### Validation
```bash
grep -q "Flash Mint" packages/frontend/src/features/docs/ui/DocsSidebar.tsx && echo "OK"
```

#### Failure modes
- Navigation item placed in wrong section

---

### Step 4: Create Flash Mint mechanics page

#### Goal
Create the flash mint mechanics MDX file documenting atomic PT+YT minting for advanced users and integrators.

#### Files
- `packages/frontend/src/app/docs/mechanics/flash-mint/page.mdx` - Create new file with Flash Mint documentation

#### Validation
```bash
test -f packages/frontend/src/app/docs/mechanics/flash-mint/page.mdx && echo "OK"
```

#### Failure modes
- Missing directory creation

---

## Phase 2: Getting Started Updates

Add Simple vs Advanced mode documentation and expand wallet connection details.

### Phase Validation
```bash
cd packages/frontend && bun run check
```

### Step 5: Add mode system section to Getting Started

#### Goal
Document the Simple vs Advanced mode toggle system after the Before You Begin section.

#### Files
- `packages/frontend/src/app/docs/getting-started/page.mdx` - Add new section "Simple vs Advanced Mode" explaining mode toggle, feature differences, and how to switch

#### Validation
```bash
grep -q "Simple vs Advanced" packages/frontend/src/app/docs/getting-started/page.mdx && echo "OK"
```

#### Failure modes
- Section placed in wrong location disrupting page flow
- Terminology inconsistent with UI

---

### Step 6: Expand wallet connection details in Getting Started

#### Goal
Add detailed wallet connection steps including network switching and disconnecting.

#### Files
- `packages/frontend/src/app/docs/getting-started/page.mdx` - Expand Step 1: Connect Wallet with network info and disconnect instructions

#### Validation
```bash
grep -q "Disconnect" packages/frontend/src/app/docs/getting-started/page.mdx && echo "OK"
```

#### Failure modes
- Duplicate content with existing wallet section

---

## Phase 3: Guide Updates for v2.0 Features

Update existing guides with multi-reward system, portfolio details, and new trading features.

### Phase Validation
```bash
cd packages/frontend && bun run check
```

### Step 7: Add multi-reward system to Manage Positions guide

#### Goal
Document the new multi-reward YT system including viewing available rewards, claiming rewards, and Claim All functionality.

#### Files
- `packages/frontend/src/app/docs/guides/manage-positions/page.mdx` - Add new section "Claiming Rewards" after existing "Claiming Yield" section

#### Validation
```bash
grep -q "Reward Tokens" packages/frontend/src/app/docs/guides/manage-positions/page.mdx && echo "OK"
```

#### Failure modes
- Confusion between yield and rewards terminology

---

### Step 8: Add portfolio summary details to Manage Positions guide

#### Goal
Document the portfolio summary grid showing total value, PnL, claimable yield, and active positions count.

#### Files
- `packages/frontend/src/app/docs/guides/manage-positions/page.mdx` - Expand "Portfolio Overview" section with summary grid explanation

#### Validation
```bash
grep -q "Total PnL" packages/frontend/src/app/docs/guides/manage-positions/page.mdx && echo "OK"
```

#### Failure modes
- Metrics descriptions don't match actual UI

---

### Step 9: Add Unwrap SY documentation to Manage Positions guide

#### Goal
Document how to unwrap SY tokens back to the underlying asset.

#### Files
- `packages/frontend/src/app/docs/guides/manage-positions/page.mdx` - Add new section "Unwrapping SY" after Early Redemption

#### Validation
```bash
grep -q "Unwrap" packages/frontend/src/app/docs/guides/manage-positions/page.mdx && echo "OK"
```

#### Failure modes
- Steps don't match actual UI flow

---

### Step 10: Add dual-token liquidity to Provide Liquidity guide

#### Goal
Document adding and removing liquidity with any token using the router.

#### Files
- `packages/frontend/src/app/docs/guides/provide-liquidity/page.mdx` - Add section "Adding Liquidity with Any Token" after Step-by-Step

#### Validation
```bash
grep -q "Any Token" packages/frontend/src/app/docs/guides/provide-liquidity/page.mdx && echo "OK"
```

#### Failure modes
- Confusion with existing step-by-step instructions

---

### Step 11: Add token-to-token swap to Trade Yield guide

#### Goal
Document the Any Token swap mode and general token routing.

#### Files
- `packages/frontend/src/app/docs/guides/trade-yield/page.mdx` - Add section "Swap with Any Token" after Trading YT section

#### Validation
```bash
grep -q "Any Token" packages/frontend/src/app/docs/guides/trade-yield/page.mdx && echo "OK"
```

#### Failure modes
- Section conflicts with existing trading instructions

---

## Phase 4: FAQ Expansion

Add new FAQ entries for undocumented features, fees, and troubleshooting.

### Phase Validation
```bash
cd packages/frontend && bun run check
```

### Step 12: Add slippage configuration FAQ

#### Goal
Document how to configure slippage tolerance in transaction settings panel.

#### Files
- `packages/frontend/src/app/docs/faq/page.mdx` - Add question "How do I set slippage tolerance?" after existing slippage question in Trading section

#### Validation
```bash
grep -q "set slippage tolerance" packages/frontend/src/app/docs/faq/page.mdx && echo "OK"
```

#### Failure modes
- Duplicate content with existing slippage question

---

### Step 13: Expand faucet documentation in FAQ

#### Goal
Provide detailed faucet usage instructions including limits and token description.

#### Files
- `packages/frontend/src/app/docs/faq/page.mdx` - Expand "How do I get test tokens?" answer with step-by-step flow

#### Validation
```bash
grep -q "100 tokens" packages/frontend/src/app/docs/faq/page.mdx && echo "OK"
```

#### Failure modes
- Rate limit info becomes outdated

---

### Step 14: Add fee documentation to FAQ

#### Goal
Document what fees Horizon charges including interest fees, reward fees, and swap fees.

#### Files
- `packages/frontend/src/app/docs/faq/page.mdx` - Add question "What fees does Horizon charge?" in General section after audit question

#### Validation
```bash
grep -q "fees does Horizon charge" packages/frontend/src/app/docs/faq/page.mdx && echo "OK"
```

#### Failure modes
- Fee percentages may change over time

---

### Step 15: Add error message explanations to FAQ

#### Goal
Document common error messages and their solutions in Troubleshooting.

#### Files
- `packages/frontend/src/app/docs/faq/page.mdx` - Expand Troubleshooting section with specific error messages: "Slippage exceeded", "Expired", "Insufficient balance"

#### Validation
```bash
grep -q "Slippage exceeded" packages/frontend/src/app/docs/faq/page.mdx && echo "OK"
```

#### Failure modes
- Error message wording changes in contracts

---

### Step 16: Add negative yield warning FAQ

#### Goal
Explain what happens when implied yield goes negative and impact on positions.

#### Files
- `packages/frontend/src/app/docs/faq/page.mdx` - Add question "What if implied yield goes negative?" in Trading section

#### Validation
```bash
grep -q "negative" packages/frontend/src/app/docs/faq/page.mdx && echo "OK"
```

#### Failure modes
- Edge case not clearly explained

---

## Phase 5: Glossary Updates

Add all new terms for v2.0 features to the glossary.

### Phase Validation
```bash
cd packages/frontend && bun run check
```

### Step 17: Add A-D section terms to glossary

#### Goal
Add Advanced Mode term to A section and Dual-Token Liquidity term to D section.

#### Files
- `packages/frontend/src/app/docs/glossary/page.mdx` - Add Advanced Mode after APY, add Dual-Token Liquidity after Discount

#### Validation
```bash
grep -q "Advanced Mode" packages/frontend/src/app/docs/glossary/page.mdx && echo "OK"
```

#### Failure modes
- Terms placed in wrong alphabetical position

---

### Step 18: Add E-I section terms to glossary

#### Goal
Add Expiry Divisor to E section, add Flash Mint and IFlashCallback to new F and I sections, add Interest Fee Rate to I section.

#### Files
- `packages/frontend/src/app/docs/glossary/page.mdx` - Add new terms in appropriate alphabetical sections

#### Validation
```bash
grep -q "Flash Mint" packages/frontend/src/app/docs/glossary/page.mdx && echo "OK"
```

#### Failure modes
- Missing section headers for new letters

---

### Step 19: Add R-T section terms to glossary

#### Goal
Add Reward Fee Rate and Reward Tokens to R section, add Simple Mode and SYWithRewards to S section, add Token Aggregator to T section.

#### Files
- `packages/frontend/src/app/docs/glossary/page.mdx` - Add new terms in appropriate alphabetical sections

#### Validation
```bash
grep -q "Reward Tokens" packages/frontend/src/app/docs/glossary/page.mdx && echo "OK"
```

#### Failure modes
- Cross-references to non-existent pages

---

## Phase 6: Risks Page Updates

Add risk documentation for new v2.0 features.

### Phase Validation
```bash
cd packages/frontend && bun run check
```

### Step 20: Add reward token risks to Risks page

#### Goal
Document risks specific to multi-reward tokens including reward token volatility and smart contract risk.

#### Files
- `packages/frontend/src/app/docs/risks/page.mdx` - Add "Reward Token Risks" subsection under "Position-Specific Risks" after YT Risks

#### Validation
```bash
grep -q "Reward Token" packages/frontend/src/app/docs/risks/page.mdx && echo "OK"
```

#### Failure modes
- Risk section too brief or unduly alarming

---

### Step 21: Add flash mint risks to Risks page

#### Goal
Document risks for flash minting including callback implementation risks.

#### Files
- `packages/frontend/src/app/docs/risks/page.mdx` - Add "Flash Mint Risks" subsection in Operational Risks section

#### Validation
```bash
grep -q "Flash Mint" packages/frontend/src/app/docs/risks/page.mdx && echo "OK"
```

#### Failure modes
- Technical jargon confuses regular users

---

## Phase 7: Consistency and Verification

Standardize terminology and verify all cross-references work correctly.

### Phase Validation
```bash
cd packages/frontend && bun run check && bun run build
```

### Step 22: Standardize wallet naming across docs

#### Goal
Update all references to use consistent "Ready (formerly Argent)" format.

#### Files
- `packages/frontend/src/app/docs/getting-started/page.mdx` - Update wallet reference at line 14
- `packages/frontend/src/app/docs/faq/page.mdx` - Update wallet reference at line 136

#### Validation
```bash
grep -r "formerly Argent" packages/frontend/src/app/docs/ | wc -l | xargs test 2 -le && echo "OK"
```

#### Failure modes
- Inconsistent naming remains in some files

---

### Step 23: Add interactive component usage hints

#### Goal
Add brief usage instructions before PriceSimulator and YieldCalculator components.

#### Files
- `packages/frontend/src/app/docs/mechanics/pricing/page.mdx` - Add instruction text before PriceSimulator
- `packages/frontend/src/app/docs/mechanics/apy-calculation/page.mdx` - Add instruction text before YieldCalculator

#### Validation
```bash
grep -q "adjust" packages/frontend/src/app/docs/mechanics/pricing/page.mdx && echo "OK"
```

#### Failure modes
- Instructions interfere with prose styling

---

### Step 24: Run build to verify all links

#### Goal
Ensure all new cross-references link to valid pages and MDX compiles.

#### Files
- All modified MDX files from previous phases

#### Validation
```bash
cd packages/frontend && bun run build 2>&1 | grep -i "error" | wc -l | xargs test 0 -eq && echo "OK"
```

#### Failure modes
- Dead links to non-existent pages
- MDX syntax errors
- Incorrect anchor references

---
