# Horizon Protocol Documentation Update Research

**Purpose:** User-facing documentation audit for `/packages/frontend/src/app/docs`
**Scope:** Gaps, errors, and undocumented features in end-user documentation
**Generated:** 2026-01-18

---

## Executive Summary

This research document identifies documentation gaps by comparing the existing docs against the actual frontend implementation. The documentation is generally accurate but missing coverage of several user-facing features, particularly around the **Simple/Advanced mode system**, the **faucet**, **analytics**, and various UI interactions.

---

## Current Documentation Structure

| Page | Path | Status |
|------|------|--------|
| What is Horizon | `/docs/what-is-horizon` | Accurate |
| Getting Started | `/docs/getting-started` | Needs updates |
| How It Works | `/docs/how-it-works` | Accurate |
| Yield Tokens | `/docs/how-it-works/yield-tokens` | Accurate |
| AMM Mechanics | `/docs/how-it-works/amm-mechanics` | Accurate |
| Guides Overview | `/docs/guides` | Accurate |
| Earn Fixed Yield | `/docs/guides/earn-fixed-yield` | Needs minor updates |
| Trade Yield | `/docs/guides/trade-yield` | Needs minor updates |
| Provide Liquidity | `/docs/guides/provide-liquidity` | Needs minor updates |
| Manage Positions | `/docs/guides/manage-positions` | Needs updates |
| Mechanics Overview | `/docs/mechanics` | Accurate |
| Pricing | `/docs/mechanics/pricing` | Accurate |
| APY Calculation | `/docs/mechanics/apy-calculation` | Accurate |
| Redemption | `/docs/mechanics/redemption` | Accurate |
| Risks | `/docs/risks` | Accurate |
| FAQ | `/docs/faq` | Needs updates |
| Glossary | `/docs/glossary` | Needs additions |
| Whitepaper | `/docs/whitepaper` | Accurate |

---

## GAP 1: Simple vs Advanced Mode System [CRITICAL]

**Location:** Mode toggle in header, affects all pages
**Code:** `src/shared/layout/mode-toggle.tsx`

### What Exists (Undocumented)
- **Mode Toggle UI:** Animated slider between Simple/Advanced
- **Onboarding Tooltip:** Shows on first visit explaining modes
- **Persistent State:** Saved to localStorage (`horizon-ui-mode`)
- **Feature Gating:** Trade and Pools pages only visible in Advanced mode
- **Label Changes:** "Earn" vs "Mint", "Markets" vs "Dashboard"
- **Tab Changes:** Mint page shows only Deposit/Withdraw in Simple mode
- **Mobile Nav:** 3 items (Simple) vs 5 items (Advanced)

### Documentation Gap
No documentation explains:
- What Simple mode is and why it exists
- What features are hidden in Simple mode
- How to switch between modes
- That new users default to Simple mode

### Recommended Addition
New section in "Getting Started" or standalone page:

```
## Simple vs Advanced Mode

Horizon has two interface modes:

**Simple Mode (default)**
- Streamlined for earning fixed yield
- Shows: Markets, Earn, Portfolio
- Hides: Trade, Pools, technical details

**Advanced Mode**
- Full protocol access for power users
- Shows: All pages including Trade and Pools
- Uses technical terminology (PT, YT, SY)

Toggle between modes using the switch in the top navigation bar.
```

---

## GAP 2: Faucet Feature [HIGH]

**Location:** `/faucet` page
**Code:** `src/page-compositions/faucet/FaucetPage.tsx`

### What Exists (Undocumented)
- **Test Token Minting:** Get 100 hrzSTRK tokens
- **Rate Limiting:** Once per 24 hours per address
- **Eligibility Check:** Shows if you can mint or must wait
- **Copy Address:** Token contract address can be copied
- **Network Awareness:** Available on mainnet, sepolia, devnet
- **Status Display:** Eligible/Already minted/Loading states

### Documentation Gap
- Getting Started mentions faucet briefly but doesn't explain it
- FAQ mentions it exists but lacks details
- No dedicated faucet guide

### Current Text (FAQ)
> Use the [Test Token Faucet](/faucet) to get free hrzSTRK tokens. You can mint 100 tokens once every 24 hours.

### Recommended Addition
Either expand FAQ or add dedicated section:

```
## Test Token Faucet

Get free test tokens to try Horizon without real funds.

### How to Use
1. Go to [Faucet](/faucet)
2. Connect your wallet (or enter an address)
3. Click "Mint Tokens"
4. Wait for transaction confirmation

### Limits
- 100 hrzSTRK per mint
- Once every 24 hours per address
- These are test tokens with no real value

### What are hrzSTRK?
hrzSTRK is a mock yield-bearing token for testing. It simulates staked STRK behavior but has no real value.
```

---

## GAP 3: Analytics Page [HIGH]

**Location:** `/analytics`
**Code:** `src/page-compositions/analytics/AnalyticsPage.tsx`

### What Exists (Completely Undocumented)
1. **Yield Curve Chart** - Shows implied APY across maturities
2. **TVL Stats** - Total value locked across all markets
3. **Average Implied APY** - Across markets
4. **PT Convergence Chart** - PT discount over time
5. **Implied vs Realized APY** - Market expectations vs actual
6. **Market Depth** - Price impact by trade size
7. **Liquidity Health Score** - 0-100 aggregated score
8. **Collapsible Advanced Section:**
   - Execution Quality Panel
   - Rate History Table
   - TVL Charts and Breakdown
   - Volume Statistics and Charts
   - Fee Revenue Charts

### Documentation Gap
Analytics page is not mentioned anywhere in documentation.

### Recommended Addition
New page: `/docs/guides/analytics` or section in `/docs/guides`

```
# Understanding Analytics

The Analytics page provides real-time and historical data about Horizon markets.

## Key Metrics

### Yield Curve
Shows implied APY across all markets by maturity. Use this to identify which maturities offer better rates.

### PT Convergence
Visualizes how PT price approaches 1.0 as maturity nears. Useful for timing PT purchases.

### Market Depth
Shows price impact for different trade sizes. Look for markets with at least 10bps liquidity for large trades.

### Liquidity Health Score
Aggregated 0-100 score based on spread, depth, and trading activity:
- 80+: Excellent liquidity
- 60-80: Good liquidity
- Below 60: Limited liquidity, expect higher price impact

### Advanced Analytics
Click "Show Advanced" to access:
- Execution quality metrics
- Historical rate data
- TVL and volume trends
- Fee revenue tracking
```

---

## GAP 4: Transaction Settings [MEDIUM]

**Location:** Settings panel in forms
**Code:** `src/features/tx-settings/ui/TransactionSettingsPanel.tsx`

### What Exists (Undocumented)
- **Slippage Tolerance Input:** Configurable percentage
- **Applied To:** All swaps, liquidity operations, redemptions
- **Default:** 50 bips (0.5%)
- **Min Output Calculation:** Based on slippage setting

### Documentation Gap
FAQ mentions slippage but doesn't explain how to configure it:
> **What is slippage?** The difference between expected and actual execution price. Set slippage tolerance in settings to protect against unfavorable price movements.

### Recommended Update to FAQ
```
### How do I set slippage tolerance?

1. Open any trading, liquidity, or redemption form
2. Click the settings icon (gear)
3. Enter your desired slippage tolerance (e.g., 0.5%)
4. Lower slippage = transactions may fail if price moves
5. Higher slippage = more tolerance but potentially worse rates

**Recommended:** 0.5% for normal conditions, 1-2% for volatile markets.
```

---

## GAP 5: Portfolio Page Details [MEDIUM]

**Location:** `/portfolio`
**Code:** `src/page-compositions/portfolio/PortfolioPage.tsx`

### What Exists (Partially Documented)
1. **Summary Grid:**
   - Total Portfolio Value (USD)
   - Total PnL (USD + %)
   - Total Claimable Yield
   - Active Positions Count
   - "Claim All" button

2. **Position Cards (per market):**
   - Collapsible sections
   - LP position breakdown
   - Token balances (SY, PT, YT, LP)
   - Claim yield button
   - Redeem buttons
   - Unwrap SY button
   - Quick action links

### Documentation Gap (in `/docs/guides/manage-positions`)
Current doc mentions Portfolio but lacks:
- Summary grid explanation
- PnL calculation description
- Claim All button functionality
- LP position details
- Unwrap SY functionality

### Recommended Updates

Add to Manage Positions guide:

```
## Portfolio Summary

The top of Portfolio shows:
- **Total Value:** Combined USD value of all positions
- **Total PnL:** Profit/loss since deposits (USD and %)
- **Claimable Yield:** Total yield ready to claim across all YT
- **Active Positions:** Number of markets where you hold tokens

### Claim All
Click "Claim All" to collect claimable yield from all YT positions in one transaction.

## LP Positions

For each LP position, Portfolio shows:
- LP Token balance
- Your share of pool reserves (SY + PT)
- Pool share percentage

LP rewards (trading fees) automatically compound into your LP position.

## Unwrapping SY

If you have SY tokens, you can unwrap them to the underlying asset:
1. Find the position with SY balance
2. Click "Unwrap"
3. Confirm the transaction
4. Receive the underlying yield-bearing token
```

---

## GAP 6: Wallet Connection Details [MEDIUM]

**Location:** Header connect button
**Code:** `src/features/wallet/ui/`

### What Exists (Barely Documented)
- **Supported Wallets:** Argent (Ready), Braavos
- **Connection Flow:** Button → Modal → Wallet approval
- **Network Indicator:** Shows current network
- **Disconnect Option:** Available in wallet menu
- **Address Display:** Shortened address when connected

### Current Documentation (Getting Started)
> You'll need: A Starknet wallet (Ready (ex Argent) or Braavos)
> Click **Connect** in the top right. Select your wallet and approve the connection.

### Recommended Expansion

```
## Connecting Your Wallet

### Supported Wallets
- **Ready** (formerly Argent) - [Download](https://argent.xyz)
- **Braavos** - [Download](https://braavos.app)

### Connection Steps
1. Click "Connect" in the top right corner
2. Select your wallet from the list
3. Approve the connection in your wallet popup
4. You'll see your address in the header when connected

### Switching Networks
Horizon supports:
- Mainnet (production)
- Sepolia (testnet)
- Devnet (local testing)

Your wallet's network must match. If mismatched, switch networks in your wallet settings.

### Disconnecting
Click your address in the header → "Disconnect"
```

---

## GAP 7: Error Messages & Troubleshooting [MEDIUM]

**Location:** Throughout app
**Code:** Error handling uses `HZN:` prefix

### What Exists (Undocumented)
Contract error messages:
- `HZN: slippage exceeded`
- `HZN: expired`
- `HZN: insufficient balance`
- Various other HZN: prefixed errors

### Current Documentation (FAQ)
> **Transaction failed — what do I check?**
> 1. Sufficient STRK for gas
> 2. Token approvals granted
> 3. Slippage not exceeded
> 4. Wallet connected to correct network

### Recommended Expansion

Add to FAQ or new Troubleshooting section:

```
## Common Error Messages

### "Slippage exceeded"
Price moved beyond your tolerance during transaction. Solutions:
- Increase slippage tolerance in settings
- Try a smaller trade size
- Wait for less volatile conditions

### "Expired"
Attempting action on an expired market. For PT:
- Use post-expiry redemption instead
For YT:
- YT expires worthless at maturity

### "Insufficient balance"
You don't have enough tokens for the operation:
- Check your wallet balance
- Account for gas fees (STRK)
- Remember approval transactions cost gas too

### Transaction Pending Forever
- Check Starknet network status
- Try refreshing the page
- Your transaction may still complete

### Position Not Showing
- Refresh the page
- Verify wallet is connected
- Check transaction on explorer (link in success message)
```

---

## GAP 8: Any Token Swap Feature [MEDIUM]

**Location:** Trade page toggle
**Code:** `src/features/swap/ui/TokenAggregatorSwapForm.tsx`

### What Exists (Undocumented)
- **Standard Swap:** Direct PT/SY/YT swaps
- **Any Token Mode:** Swap using any ERC20 token
- **Toggle:** Switch between modes on Trade page
- **Route Finding:** Best execution path across pools

### Documentation Gap
Trade Yield guide only covers standard PT/YT trading, not the token aggregator.

### Recommended Addition to Trade Yield Guide

```
## Swap with Any Token (Advanced)

In Advanced mode, you can swap directly from any token:

1. Go to Trade
2. Toggle to "Any Token" mode
3. Select your input token (e.g., STRK, ETH)
4. Select output (PT, YT, or SY)
5. The router finds the best path

This uses the token aggregator to route through multiple pools if needed.

**Note:** More complex routes may have higher price impact.
```

---

## GAP 9: Mobile Navigation [LOW]

**Location:** Bottom nav bar on mobile
**Code:** `src/shared/layout/MobileNav.tsx`

### What Exists (Undocumented)
- **Fixed Bottom Bar:** Glassmorphic design
- **Mode-Aware:** 3 items (Simple) vs 5 items (Advanced)
- **Safe Area Padding:** For notched phones
- **Primary Action:** Center button for Mint/Earn

### Documentation Gap
No mention of mobile-specific navigation.

### Recommended Addition
Could add brief mention in Getting Started:

```
## Using Horizon on Mobile

On mobile devices, navigation appears at the bottom of the screen:
- Simple mode shows 3 items: Home, Earn, Portfolio
- Advanced mode adds Trade and Pools
```

---

## GAP 10: Negative Yield Warning [LOW]

**Location:** Various forms
**Code:** `NegativeYieldWarning` component

### What Exists (Undocumented)
When implied yield goes negative, a warning banner appears explaining:
- What negative yield means
- Impact on PT pricing
- Risk considerations

### Documentation Gap
Risks page and FAQ don't mention negative yield scenarios.

### Recommended Addition to FAQ

```
### What if implied yield goes negative?

Negative implied yield means PT trades above 1.0 (at a premium). This can happen when:
- Market expects underlying yield to increase significantly
- Arbitrage opportunities exist

**For PT buyers:** Buying PT at a premium means you'll lose value at maturity.
**For YT buyers:** Negative implied yield suggests high expected future yields.

The app shows a warning when this occurs.
```

---

## ERRORS IN EXISTING DOCUMENTATION

### Error 1: Outdated CTA Button URLs

**Location:** Multiple guides

| File | Current Link | Issue |
|------|--------------|-------|
| `getting-started/page.mdx` | `href="/mint"` | Correct |
| `guides/earn-fixed-yield/page.mdx` | `href="/mint"` | Correct |
| `guides/trade-yield/page.mdx` | `href="/trade"` | Correct |
| `guides/provide-liquidity/page.mdx` | `href="/pools"` | Correct |

**Status:** Links verified correct.

### Error 2: Inconsistent Terminology

**Location:** Throughout docs

| Issue | Example | Fix |
|-------|---------|-----|
| "Argent" wallet name | "Ready (ex Argent)" | Docs say "Ready" in some places, "Argent" in others |
| Mode terminology | Docs don't mention modes | Add mode awareness |

**Files affected:**
- `getting-started/page.mdx:14` - Says "Ready (ex Argent)"
- `faq/page.mdx:137` - Says "Ready (ex Argent)"

**Recommendation:** Standardize to "Ready (formerly Argent)" everywhere.

### Error 3: Missing Interactive Component Documentation

**Location:** Docs use interactive components without explanation

| Component | Used In | Issue |
|-----------|---------|-------|
| `PriceSimulator` | `/docs/mechanics/pricing` | No explanation of how to use it |
| `YieldCalculator` | `/docs/mechanics/apy-calculation` | No usage instructions |

**Recommendation:** Add brief instructions above each interactive tool.

---

## GLOSSARY ADDITIONS NEEDED

Missing terms based on UI and code:

| Term | Definition |
|------|------------|
| **Simple Mode** | Streamlined interface showing only essential yield-earning features |
| **Advanced Mode** | Full protocol interface with trading, liquidity, and technical details |
| **hrzSTRK** | Mock yield-bearing token used for testing on Horizon |
| **Faucet** | Tool to get free test tokens for trying the protocol |
| **LP Rewards** | Trading fees earned by liquidity providers, auto-compounded |
| **Claim All** | Single transaction to collect yield from all YT positions |
| **Unwrap** | Convert SY tokens back to the underlying asset |
| **Rate Anchor** | Dynamic AMM parameter maintaining price continuity |
| **Token Aggregator** | Router finding optimal swap paths across multiple pools |
| **Portfolio Value** | Total USD value of all tokens held in Horizon |
| **PnL** | Profit and Loss - gains or losses from positions |

---

## RECOMMENDED DOCUMENTATION STRUCTURE

### Current Structure (10 sections)
1. What is Horizon
2. How It Works
3. Getting Started
4. Guides
5. Mechanics
6. Risks
7. FAQ
8. Glossary
9. Whitepaper

### Proposed Additions
1. What is Horizon
2. How It Works
3. Getting Started ← **Expand with mode explanation**
4. Guides
   - (existing guides)
   - **NEW: Using Analytics** ← Add
5. Mechanics
6. **NEW: Troubleshooting** ← Add (or merge into FAQ)
7. Risks
8. FAQ ← **Expand**
9. Glossary ← **Add terms**
10. Whitepaper

---

## PRIORITY ACTION ITEMS

### P0 - Critical (Breaking User Experience)
1. [ ] Document Simple vs Advanced mode system
2. [ ] Add Analytics page documentation

### P1 - High (Missing Key Features)
3. [ ] Expand Faucet documentation
4. [ ] Document transaction settings (slippage)
5. [ ] Add error message explanations

### P2 - Medium (Polish)
6. [ ] Update Portfolio management guide
7. [ ] Document wallet connection details
8. [ ] Add Any Token swap documentation
9. [ ] Add glossary terms

### P3 - Low (Nice to Have)
10. [ ] Mobile navigation note
11. [ ] Negative yield warning explanation
12. [ ] Interactive component usage instructions
13. [ ] Standardize wallet naming

---

## FILE CHANGES SUMMARY

| File | Action | Priority |
|------|--------|----------|
| `getting-started/page.mdx` | Add mode switching section | P0 |
| NEW: `guides/analytics/page.mdx` | Create analytics guide | P0 |
| `faq/page.mdx` | Expand faucet, slippage, errors | P1 |
| `guides/manage-positions/page.mdx` | Add portfolio details | P2 |
| `glossary/page.mdx` | Add 11 new terms | P2 |
| `guides/trade-yield/page.mdx` | Add Any Token section | P2 |
| `DocsSidebar.tsx` | Add Analytics link | P0 |

---

## APPENDIX: Full Feature-to-Documentation Mapping

### Documented Features ✓
- PT/YT/SY token concepts
- Fixed yield strategy
- Trading PT/YT
- Providing liquidity
- Claiming yield
- Redemption (pre/post expiry)
- AMM mechanics
- Pricing formulas
- APY calculations
- Risks
- Wallet requirements (basic)

### Undocumented Features ✗
- Simple/Advanced mode toggle
- Analytics page (all charts and metrics)
- Faucet (detailed usage)
- Transaction settings panel
- Slippage configuration
- Portfolio summary metrics
- PnL display
- Claim All functionality
- LP position details in portfolio
- Unwrap SY functionality
- Any Token swap mode
- Mobile navigation
- Error message meanings
- Negative yield warnings
- Interactive calculator usage

---

## NEW FEATURES (release/v2.0 vs main) - MUST DOCUMENT

> **CRITICAL:** The following features are implemented on `release/v2.0` but NOT on `main` branch. These are all undocumented and MUST be covered before release.

### Branch Comparison Summary

| Category | New Features Count |
|----------|-------------------|
| Multi-Reward System | 4 features |
| Flash Mint | 1 feature |
| Dual-Token Liquidity | 3 features |
| Factory Admin Controls | 3 features |
| Market State Views | 1 feature |

---

## NEW-1: Multi-Reward YT System [CRITICAL - P0]

**Location:** `contracts/src/tokens/yt.cairo`
**Implementation:** Phase 4 of pending-gaps-implementation.md (COMPLETE)

### What's Implemented (Completely Undocumented)

YT tokens now support **multiple reward tokens** beyond just yield interest. This enables:
- Tokens with external rewards (staking rewards, protocol emissions)
- GLP-style tokens with multiple reward streams
- Pendle pools with emissions

### New User-Facing Functions

| Function | Purpose | User Impact |
|----------|---------|-------------|
| `get_reward_tokens()` | View available reward tokens | Shows what rewards you can claim |
| `claim_rewards(user)` | Claim all accrued rewards | Collect reward tokens |
| `redeem_due_interest_and_rewards(user, do_interest, do_rewards)` | Combined claim | Single tx for interest + rewards |
| `accrued_rewards(user)` | View pending rewards | Check reward balances |

### Documentation Needed

**Add to Manage Positions guide:**
```
## Claiming Rewards

Some yield tokens earn additional rewards beyond standard yield (e.g., staking rewards, protocol emissions).

### Viewing Available Rewards
On the Portfolio page, positions with additional rewards show:
- List of reward tokens
- Accrued amounts per token
- "Claim Rewards" button

### Claiming
1. Go to Portfolio
2. Find position with rewards
3. Click "Claim Rewards" to collect reward tokens
4. Or use "Claim All" to collect interest + rewards together

### Which tokens have rewards?
Tokens created with reward support (SYWithRewards) can distribute multiple reward tokens to YT holders.
```

**Add to Glossary:**
```
### Reward Tokens
Additional tokens distributed to YT holders beyond standard yield. Examples include staking rewards, protocol emissions, or partner incentives.

### SYWithRewards
A Standardized Yield token that supports distributing multiple external reward tokens to users.
```

---

## NEW-2: Flash Mint PT+YT [CRITICAL - P0]

**Location:** `contracts/src/tokens/yt.cairo:flash_mint_py()`
**Implementation:** Phase 6 of pending-gaps-implementation.md (COMPLETE)

### What's Implemented (Completely Undocumented)

Atomic flash minting of PT + YT tokens in a single transaction with callback. Enables:
- Arbitrage between Horizon and other protocols
- Complex multi-step DeFi strategies
- Zero-capital operations (must repay in same tx)

### New Function

```cairo
fn flash_mint_py(
    receiver: ContractAddress,
    amount_sy: u256,
    data: Span<felt252>,
) -> (u256, u256)  // (pt_minted, yt_minted)
```

### Documentation Needed

**Add new section to Mechanics or create Advanced Strategies guide:**
```
## Flash Minting (Advanced)

Flash minting allows you to mint PT + YT without upfront capital, as long as you repay the required SY within the same transaction.

### How It Works
1. Call `flash_mint_py` with desired SY amount
2. Protocol mints PT + YT to your contract
3. Your contract receives a callback with the tokens
4. Your contract must transfer SY back to cover the mint
5. If SY not received, transaction reverts

### Use Cases
- Arbitrage between Horizon and other protocols
- Atomic position restructuring
- Complex yield strategies

### Requirements
- Must implement `IFlashCallback` interface
- Must repay full SY amount in same transaction
- For developers/integrators only

**Warning:** Flash minting is an advanced feature. Incorrect implementation can result in reverted transactions.
```

---

## NEW-3: Dual-Token Liquidity Operations [HIGH - P1]

**Location:** `contracts/src/router.cairo`
**Implementation:** Phase 5 of pending-gaps-implementation.md (COMPLETE)

### What's Implemented (Completely Undocumented)

Three new router functions for flexible liquidity provision:

| Function | Purpose |
|----------|---------|
| `add_liquidity_dual_token_and_pt()` | Add liquidity using any token + PT |
| `remove_liquidity_dual_token_and_pt()` | Withdraw to any token + PT separately |
| `swap_tokens_to_tokens()` | General token-to-token routing |

### User Impact

Users can now:
- Add liquidity without first converting to SY manually
- Withdraw liquidity and receive their preferred token
- Use the router as a general token aggregator

### Documentation Needed

**Update Provide Liquidity guide:**
```
## Adding Liquidity with Any Token

Instead of manually converting to SY first, you can add liquidity directly with any supported token:

1. Go to Pools
2. Select a pool
3. Choose your input token (STRK, ETH, etc.)
4. Enter amount
5. The router converts to SY automatically

**Note:** This uses the token aggregator, which may have different rates than manual conversion.

## Removing Liquidity to Any Token

When withdrawing, you can receive your preferred token:

1. Go to Portfolio or Pools
2. Click "Remove Liquidity"
3. Choose output token
4. The router converts SY portion automatically
```

**Add to Trade Yield guide (if not already covered):**
```
## Token-to-Token Swaps

The router can swap between any supported tokens, not just PT/YT/SY:

1. Go to Trade
2. Enable "Any Token" mode
3. Select input and output tokens
4. The router finds the best path
```

---

## NEW-4: Factory Fee Infrastructure [MEDIUM - P2]

**Location:** `contracts/src/factory.cairo`
**Implementation:** Phase 1 of pending-gaps-implementation.md (COMPLETE)

### What's Implemented (Admin-facing, but affects users)

| Feature | Function | Impact |
|---------|----------|--------|
| Reward Fee Rate | `set_reward_fee_rate()` | Protocol takes % of external rewards |
| Default Interest Fee Rate | `set_default_interest_fee_rate()` | Default fee on YT interest |
| Expiry Divisor | `set_expiry_divisor()` | Standardizes maturity dates |

### User Impact

- **Reward fees:** Some portion of external rewards goes to protocol treasury
- **Interest fees:** Already documented (YT takes fee on interest)
- **Expiry standardization:** Markets have predictable maturity dates (e.g., weekly, monthly)

### Documentation Needed

**Update FAQ:**
```
### What fees does Horizon charge?

**Interest Fee:** A percentage of YT yield goes to the protocol treasury. Check each market for the specific rate (typically 3-10%).

**Reward Fee:** For tokens with external rewards, a percentage goes to the protocol treasury.

**Swap Fees:** Trading in pools incurs a small swap fee (typically 0.1-0.3%).
```

**Add to Glossary:**
```
### Interest Fee Rate
The percentage of YT yield taken by the protocol. Set per-market, typically 3-10%.

### Expiry Divisor
A protocol parameter that standardizes maturity dates to specific intervals (e.g., weekly Thursdays), concentrating liquidity at predictable dates.
```

---

## NEW-5: Market State View [LOW - P3]

**Location:** `contracts/src/market/amm.cairo:get_market_state()`
**Implementation:** Phase 7 Step 5-6 (COMPLETE)

### What's Implemented

New external view function exposing complete market state in a single call:
- PT reserve
- SY reserve
- Total LP supply
- Implied rate
- Last trade timestamp
- Fee parameters

### Documentation Needed

This is primarily for developers/integrators. Add to technical docs if they exist:
```
## Market State Query

The `get_market_state()` function returns all market parameters in a single call, useful for:
- Price calculations
- Liquidity analysis
- Integration development
```

---

## NEW-6: Version Constants [LOW - P3]

**Location:** All core contracts
**Implementation:** Phase 7 Steps 1-4 (COMPLETE)

### What's Implemented

All core contracts now have `VERSION` constants:
- PT: VERSION = 1
- YT: VERSION = 1
- Factory: VERSION = 1
- MarketFactory: VERSION = 1

### Documentation Needed

Minimal user impact. Could mention in FAQ:
```
### How do I know which version of contracts I'm using?

Each contract has a VERSION constant. Current version is 1 for all core contracts.
```

---

## NEW-7: MarketFactory Yield Contract Factory Reference [LOW - P3]

**Location:** `contracts/src/market/market_factory.cairo`
**Implementation:** Phase 3 (COMPLETE)

### What's Implemented

MarketFactory now validates that PTs were deployed by the linked YieldContractFactory. This is a security feature:
- `yield_contract_factory` storage
- `set_yield_contract_factory()` admin function
- PT validation in `create_market()`

### Documentation Needed

Admin/governance documentation only. No direct user impact.

---

## UPDATED PRIORITY ACTION ITEMS

### P0 - CRITICAL (New v2.0 Features)
1. [ ] Document Multi-Reward YT system (claim_rewards, get_reward_tokens)
2. [ ] Document Flash Mint for advanced users/integrators
3. [ ] Document Simple vs Advanced mode system (existing gap)
4. [ ] Add Analytics page documentation (existing gap)

### P1 - HIGH (New v2.0 Features)
5. [ ] Document dual-token liquidity operations
6. [ ] Document swap_tokens_to_tokens router function
7. [ ] Expand Faucet documentation (existing gap)
8. [ ] Add error message explanations (existing gap)

### P2 - MEDIUM (New v2.0 Features + Polish)
9. [ ] Document fee infrastructure (reward fees, expiry divisor)
10. [ ] Update Portfolio management guide (existing gap + rewards)
11. [ ] Add glossary terms (expanded list below)
12. [ ] Add Any Token swap documentation (existing gap)

### P3 - LOW
13. [ ] Document version constants
14. [ ] Document get_market_state view
15. [ ] Mobile navigation note
16. [ ] Interactive component instructions

---

## EXPANDED GLOSSARY ADDITIONS

| Term | Definition | Priority |
|------|------------|----------|
| **Reward Tokens** | Additional tokens distributed to YT holders beyond standard yield | P0 |
| **SYWithRewards** | SY token supporting multiple external reward distributions | P0 |
| **Flash Mint** | Atomic minting of PT+YT with same-transaction repayment | P0 |
| **IFlashCallback** | Interface for receiving flash mint callbacks | P1 |
| **Dual-Token Liquidity** | Adding/removing liquidity with any token + PT | P1 |
| **Token Aggregator** | Router finding optimal swap paths across pools | P1 |
| **Expiry Divisor** | Protocol parameter standardizing maturity date intervals | P2 |
| **Interest Fee Rate** | Percentage of YT yield taken by protocol | P2 |
| **Reward Fee Rate** | Percentage of external rewards taken by protocol | P2 |
| **Simple Mode** | Streamlined interface for basic yield earning | P0 |
| **Advanced Mode** | Full protocol interface with all features | P0 |

---

## UPDATED FILE CHANGES SUMMARY

| File | Action | Priority |
|------|--------|----------|
| `guides/manage-positions/page.mdx` | Add rewards section, claim rewards flow | P0 |
| NEW: `mechanics/flash-mint/page.mdx` | Document flash minting | P0 |
| `getting-started/page.mdx` | Add mode switching section | P0 |
| NEW: `guides/analytics/page.mdx` | Create analytics guide | P0 |
| `guides/provide-liquidity/page.mdx` | Add dual-token liquidity section | P1 |
| `guides/trade-yield/page.mdx` | Add swap_tokens_to_tokens, Any Token section | P1 |
| `faq/page.mdx` | Expand faucet, fees, slippage, errors | P1 |
| `glossary/page.mdx` | Add 11+ new terms | P2 |
| `risks/page.mdx` | Add reward token risks, flash mint risks | P2 |
| `DocsSidebar.tsx` | Add Analytics link, maybe Flash Mint | P0 |

---

## VERIFICATION COMMANDS

To verify new features are implemented:

```bash
# Check multi-reward YT functions exist
grep -n "claim_rewards\|get_reward_tokens\|redeem_due_interest_and_rewards" contracts/src/tokens/yt.cairo

# Check flash mint exists
grep -n "flash_mint_py" contracts/src/tokens/yt.cairo

# Check dual-token liquidity exists
grep -n "add_liquidity_dual_token_and_pt\|remove_liquidity_dual_token_and_pt\|swap_tokens_to_tokens" contracts/src/router.cairo

# Check fee infrastructure exists
grep -n "reward_fee_rate\|expiry_divisor" contracts/src/factory.cairo

# Check VERSION constants exist
grep -n "const VERSION" contracts/src/tokens/pt.cairo contracts/src/tokens/yt.cairo contracts/src/factory.cairo contracts/src/market/market_factory.cairo
```

---

*Research completed: 2026-01-18*
*Codebase version: release/v2.0*
*Comparison base: main branch*
