# Horizon Protocol Whitepaper Plan

## Document Specification

| Attribute | Value |
|-----------|-------|
| Document Type | Technical Whitepaper (Normative Specification) |
| Target Length | 25-35 pages |
| Format | LaTeX source → PDF |
| Version | v1.0 |
| Status | Draft |

---

## 1. Abstract (0.5-1 page)

**Purpose:** Allow readers to quickly determine if they need to read further.

### Content to Include:
- Horizon is a yield tokenization protocol on Starknet that splits yield-bearing assets into Principal Tokens (PT) and Yield Tokens (YT)
- The protocol enables:
  - Fixed yield strategies (buy PT at discount, redeem at maturity)
  - Yield speculation (trade YT for leveraged exposure to rate changes)
  - Yield market making (provide PT/SY liquidity)
- Core guarantees:
  - PT redeems 1:1 for underlying at maturity
  - PT + YT = 1 SY (conservation invariant before expiry)
  - Time-decay AMM ensures PT price converges to 1 at expiry
- Novel contribution: First Pendle-style yield protocol on Starknet with Cairo-native implementation and Pragma oracle integration

### Exclusions:
- Marketing language
- Roadmap or future plans
- Token economics (unless governance-related)

---

## 2. Motivation & Problem Statement (1-2 pages)

### 2.1 The Variable Yield Problem
- Yield-bearing tokens (nstSTRK, sSTRK, wstETH) have variable rates
- Users cannot lock in guaranteed returns
- Rate uncertainty creates capital allocation inefficiency

### 2.2 Structural Limitations of Existing Solutions
- Traditional lending protocols: Variable rates only
- Fixed-rate lending (Notional, Yield): Limited maturity options, low capital efficiency
- Why yield tokenization is structurally superior:
  - Separates principal from yield rights
  - Creates tradeable instruments for rate speculation
  - Enables efficient price discovery for future yield

### 2.3 Starknet-Specific Considerations
- Cairo's native u256 and fixed-point math requirements
- Integration with existing yield sources (Nostra, EkuboStrk)
- Pragma oracle for bridged token index tracking

### Explicit Assumptions:
- Underlying yield tokens maintain their peg
- Oracle provides accurate, timely exchange rate data
- Users are economically rational (arbitrage maintains invariants)
- Starknet provides expected transaction ordering and finality

---

## 3. System Overview (2-3 pages)

### 3.1 Protocol Architecture

```
User Operations Flow:
┌─────────────────────────────────────────────────────────┐
│  Underlying Asset (nstSTRK, sSTRK, wstETH)             │
│         │ deposit                                       │
│         ▼                                               │
│        SY (Standardized Yield wrapper)                 │
│         │ mint_py                                       │
│         ▼                                               │
│    PT + YT (split)                                     │
│         │                                               │
│    ┌────┴────┐                                         │
│    ▼         ▼                                          │
│  Market    YT Interest                                  │
│ (PT/SY AMM) Accumulation                                │
└─────────────────────────────────────────────────────────┘
```

### 3.2 Actors and Their Incentives

| Actor | Incentive | Risk Profile |
|-------|-----------|--------------|
| PT Holder | Fixed yield, locked at purchase | Low (smart contract, depeg) |
| YT Holder | Leveraged yield exposure | High (time decay, rate drops) |
| LP | Swap fees + underlying yield + PT appreciation | Medium (impermanent loss) |
| Arbitrageur | Profit from price deviations | Market risk |

### 3.3 Token System

| Token | Purpose | Minting Authority |
|-------|---------|-------------------|
| SY | Standardized wrapper for yield tokens | Anyone (deposit underlying) |
| PT | Principal claim, redeems 1:1 at expiry | YT contract only |
| YT | Yield rights until expiry | YT contract only |
| LP Token | Pool share, ERC20 | Market contract |

### 3.4 Trust Boundaries
- Immutable contracts: SY, PT, YT, Market (no admin functions post-deployment)
- Upgradeable contracts: Factory, MarketFactory, Router, PragmaIndexOracle
- External dependencies: Pragma oracle, underlying yield protocols

---

## 4. Formal Model & Notation (2-3 pages)

### 4.1 State Variables

| Symbol | Type | Description |
|--------|------|-------------|
| $S_{SY}$ | u256 | SY reserve in market |
| $S_{PT}$ | u256 | PT reserve in market |
| $L$ | u256 | Total LP token supply |
| $\tau$ | u64 | Time to expiry (seconds) |
| $T$ | u64 | Expiry timestamp |
| $I_{PY}$ | u256 | PY index (watermark) |
| $r$ | u256 | ln(implied rate) in WAD |

### 4.2 Fixed-Point Arithmetic

**Dual-Layer Precision Model:**

| Layer | Format | Precision | Use Case |
|-------|--------|-----------|----------|
| Interface | WAD (10^18) | 18 decimals | Token amounts, ERC20 compatibility |
| Internal | cubit 64.64 | ~19 decimals | Transcendental functions (exp, ln, pow, sqrt) |

**WAD Operations:**
- WAD = 10^18 (standard 18-decimal precision)
- $\text{wad\_mul}(a, b) = \lfloor \frac{a \times b}{10^{18}} \rfloor$
- $\text{wad\_div}(a, b) = \lfloor \frac{a \times 10^{18}}{b} \rfloor$

**High-Precision Functions (via cubit):**
- `exp_wad(x)` - $e^x$ with WAD scaling
- `exp_neg_wad(x)` - $e^{-x}$ for PT price decay
- `ln_wad(x)` - Natural logarithm for logit curve
- `pow_wad(base, exp)` - Power function for compound interest
- `sqrt_wad(x)` - Square root (WAD-normalized)

**Conversion:**
- `wad_to_fp(u256) → Fixed` - Convert WAD to cubit 64.64
- `fp_to_wad(Fixed) → u256` - Convert cubit 64.64 back to WAD

### 4.3 Time Model
- Block-based time (Starknet block timestamps)
- Time to expiry: $\tau = T - t_{now}$
- Time in years: $\tau_y = \frac{\tau}{31536000}$

### 4.4 Core Functions

**PT Price from Implied Rate:**
$$P_{PT} = e^{-r \cdot \tau_y}$$

**Implied Rate from Market State:**
$$r = r_{anchor} - r_{scalar} \cdot \ln\left(\frac{p}{1-p}\right)$$
where $p = \frac{S_{PT}}{S_{PT} + S_{SY}}$ (PT proportion)

**Rate Scalar (time-adjusted):**
$$r_{scalar} = \frac{r_{root}}{\tau_y}$$

---

## 5. Core Mechanism Design (6-8 pages)

**This is the most critical section.**

### 5.1 SY Token Mechanism

**State Transitions:**
- `deposit(amount) → mint(amount) SY` (1:1 with underlying shares)
- `redeem(amount) → burn(amount) SY, return underlying`

**Exchange Rate:**
- For ERC-4626 tokens: `exchange_rate = vault.convert_to_assets(WAD)`
- For custom oracles: `exchange_rate = oracle.index()`

**Invariants:**
1. `SY.total_supply == underlying.balance_of(SY_contract)`
2. Exchange rate is monotonically non-decreasing (watermark)

### 5.2 PT/YT Minting Mechanism

**Mint Operation (before expiry):**
```
Input: amount_sy
Output: (amount_py, amount_py) where amount_py = amount_sy

Steps:
1. Transfer SY from caller to YT contract
2. Update global PY index: I_PY = max(current_rate, I_PY_stored)
3. Update user interest: accrue pending yield
4. Mint amount_py PT to receiver (via YT calling PT.mint)
5. Mint amount_py YT to receiver
```

**Invariant:** `PT.total_supply == YT.total_supply` (always equal)

### 5.3 Redemption Mechanisms

**Pre-Expiry Redemption (PT + YT → SY):**
```
Input: amount_py (equal PT and YT)
Output: amount_sy = amount_py

Steps:
1. Burn amount_py PT from caller
2. Burn amount_py YT from caller
3. Transfer amount_sy SY to receiver
```

**Post-Expiry Redemption (PT → SY):**
```
Input: amount_pt
Output: amount_sy = amount_pt (1:1)

Steps:
1. Verify: current_time >= expiry
2. Burn amount_pt PT from caller
3. Transfer amount_pt SY to receiver
```

**YT Interest Claim:**
$$\text{Interest}_{user} = \text{YT}_{balance} \times \frac{I_{current} - I_{user}}{I_{user}}$$

### 5.4 AMM Mechanism

**Pool Composition:**
- PT reserve: $S_{PT}$
- SY reserve: $S_{SY}$
- Trading pair: PT/SY

**Price Discovery:**
The AMM uses a modified curve optimized for time-decaying assets:

1. **Proportion:** $p = \frac{S_{PT}}{S_{PT} + S_{SY}}$

2. **Logit transformation:** $\text{odds} = \frac{p}{1-p}$

3. **Ln implied rate:** $r = r_{anchor} - r_{scalar} \cdot \ln(\text{odds})$

4. **PT price:** $P_{PT} = e^{-r \cdot \tau_y}$

**Time Decay Properties:**
- As $\tau \to 0$: $P_{PT} \to 1$ (guaranteed convergence)
- Rate scalar increases as expiry approaches (less price sensitivity)
- YT derived price: $P_{YT} = 1 - P_{PT}$

### 5.5 Swap Mechanics

**Exact PT for SY:**
```
Input: exact_pt_in
Output: sy_out

1. Calculate current PT price from implied rate
2. gross_sy_out = exact_pt_in × P_PT
3. Apply constant product price impact
4. sy_out = min(gross_sy_out, impact_adjusted) - fee
```

**Exact SY for PT:**
```
Input: exact_sy_in
Output: pt_out

1. fee = exact_sy_in × fee_rate
2. sy_after_fee = exact_sy_in - fee
3. Calculate PT output using inverse price
4. Apply price impact adjustment
```

**Fee Model:**
- Fee rate: governance-controlled parameter (e.g., 0.1% = 0.001 WAD)
- Fees retained in pool (benefit LPs)

### 5.6 Liquidity Provision

**Add Liquidity:**
```
Input: (sy_desired, pt_desired)
Output: (sy_used, pt_used, lp_minted)

If total_lp == 0:
  lp_minted = sqrt(sy_desired × pt_desired)  # Geometric mean
  sy_used = sy_desired
  pt_used = pt_desired
Else:
  ratio = min(sy_desired/S_SY, pt_desired/S_PT)
  sy_used = ratio × S_SY
  pt_used = ratio × S_PT
  lp_minted = ratio × total_lp
```

**Remove Liquidity:**
```
Input: lp_to_burn
Output: (sy_out, pt_out)

ratio = lp_to_burn / total_lp
sy_out = ratio × S_SY
pt_out = ratio × S_PT
```

### 5.7 Key Invariants

| Invariant | Description | Enforcement |
|-----------|-------------|-------------|
| Conservation | PT + YT = SY (before expiry) | Arbitrage + contract logic |
| Supply Equality | PT.supply == YT.supply | Contract enforced |
| PT Convergence | P_PT → 1 as τ → 0 | AMM math |
| Index Watermark | I_PY only increases | Contract enforced |
| Reserve Positivity | S_SY > 0, S_PT > 0 | Contract assertions |

### 5.8 Failure Modes and Recovery

| Failure | Detection | Recovery |
|---------|-----------|----------|
| Oracle stale | Rate unchanged for extended period | Use last known rate, emit warning |
| Underlying depeg | Exchange rate drops | Watermark protects existing users |
| Pool imbalance | Proportion near 0 or 1 | Large arbitrage opportunity restores balance |
| Flash loan attack | Single-block manipulation | Multi-block TWAP consideration (future) |

---

## 6. Economic Analysis & Incentives (3-4 pages)

### 6.1 Incentive Alignment

**PT Buyers:**
- Guaranteed return if held to maturity
- Incentive: Lock in yield above risk-free rate
- Rational if: `implied_yield > opportunity_cost`

**YT Buyers:**
- Leveraged exposure to yield increases
- Incentive: Expect actual yield > implied yield
- Rational if: `E[actual_yield] × time > YT_price`

**LPs:**
- Earn fees + yield on SY portion
- Incentive: Consistent trading volume
- Rational if: `fee_APY + underlying_yield - IL > alternative_yield`

### 6.2 Arbitrage Dynamics

**PT + YT vs SY:**
- If `P_PT + P_YT > 1 SY`: Arbitrageur splits SY, sells PT and YT
- If `P_PT + P_YT < 1 SY`: Arbitrageur buys PT and YT, combines to SY

**Market vs External:**
- If market implied yield diverges from expected yield, arbitrageurs trade toward equilibrium

### 6.3 Stress Scenarios

| Scenario | PT Impact | YT Impact | LP Impact |
|----------|-----------|-----------|-----------|
| Yield drops 50% | Paper loss (converges at maturity) | Significant loss | IL + reduced fee income |
| Yield spikes 100% | Opportunity cost | Large gain | IL, but more fee volume |
| Mass redemptions | Minimal | Minimal | Reduced TVL, same proportional share |
| Black swan (depeg) | Redemption value at risk | Worthless | Total loss possible |

### 6.4 Attack Surface Analysis

**MEV Considerations:**
- Sandwich attacks on large swaps
- Mitigation: Slippage protection (min_out parameters)

**Oracle Manipulation:**
- TWAP oracle reduces single-block manipulation
- Pragma provides decentralized price feeds

**Liquidity Removal Attack:**
- LPs can always withdraw proportional share
- No lock-up periods (potential governance consideration)

---

## 7. Risk Analysis & Threat Model (2-3 pages)

### 7.1 Smart Contract Risk

| Risk | Severity | Mitigation |
|------|----------|------------|
| Reentrancy | High | Checks-effects-interactions pattern |
| Arithmetic overflow | High | Cairo native u256, bounds checking |
| Access control bypass | Critical | Only YT can mint/burn PT |
| Upgrade vulnerability | High | Immutable core contracts (SY, PT, YT, Market) |

### 7.2 Oracle Risk

| Risk | Description | Mitigation |
|------|-------------|------------|
| Stale data | Oracle not updated | Watermark index, timeout checks |
| Manipulation | False price feed | Decentralized oracle (Pragma), TWAP |
| Downtime | Oracle unavailable | Use last known rate, pause if extended |

### 7.3 Economic Risk

- **Liquidity risk:** Low liquidity → high slippage
- **Depeg risk:** Underlying asset loses value
- **Interest rate risk:** Market moves against position
- **Impermanent loss:** LPs underperform holding

### 7.4 Dependency Risk

| Dependency | Risk | Mitigation |
|------------|------|------------|
| Underlying protocol (Nostra) | Smart contract failure | Multiple SY types, not protocol-dependent |
| Starknet L2 | Sequencer downtime | Accept as infrastructure risk |
| Bridge (for bridged tokens) | Bridge exploit | Isolated SY tokens per bridge |

### 7.5 What the Protocol Does NOT Protect Against

1. Underlying asset fundamental failure
2. Starknet network-level attacks
3. User errors (wrong address, missed maturity)
4. Regulatory actions
5. Front-running by validators (MEV)

---

## 8. Governance & Upgrade Model (1-2 pages)

### 8.1 Contract Upgradeability

| Contract | Upgradeable | Admin Control |
|----------|-------------|---------------|
| SY | No | None |
| PT | No | None |
| YT | No | None |
| Market | No | None |
| Factory | Yes (UUPS) | Owner only |
| MarketFactory | Yes (UUPS) | Owner only |
| Router | Yes (UUPS) | Owner only |
| PragmaIndexOracle | Yes (UUPS) | Owner only |

### 8.2 Admin Powers (Exact Enumeration)

**Factory:**
- `set_class_hashes`: Update PT/YT contract templates
- `upgrade`: Replace factory implementation

**Router:**
- `pause/unpause`: Emergency halt all router operations
- `upgrade`: Replace router implementation

**MarketFactory:**
- Set market parameters for new markets
- `upgrade`: Replace implementation

### 8.3 Role-Based Access Control

| Role | Permissions | Default Holder |
|------|-------------|----------------|
| DEFAULT_ADMIN_ROLE | Grant/revoke roles, upgrade | Owner (deployer) |
| PAUSER_ROLE | Pause/unpause router | Owner |
| OPERATOR_ROLE | Operational functions | TBD |

### 8.4 Emergency Procedures

1. **Pause:** PAUSER_ROLE can halt router operations
2. **Core contracts unaffected:** SY, PT, YT, Market continue operating
3. **Direct interaction:** Users can bypass router if needed
4. **No admin key:** Core tokens have no admin functions

### 8.5 Governance Attack Surface

- Owner key compromise → Can upgrade periphery, cannot affect core
- Malicious upgrade → Audited upgrade process, timelock (future)
- Role escalation → Admin role required to grant roles

---

## 9. Protocol Parameters & Bounds (1-2 pages)

### 9.1 Fixed Parameters

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| WAD | 10^18 | Standard precision |
| SECONDS_PER_YEAR | 31,536,000 | APY calculations |
| MIN_TIME_TO_EXPIRY | 1 second | Prevent division by zero |
| MAX_LN_IMPLIED_RATE | 4.6 WAD | Caps at ~10000% APY |
| MIN_PROPORTION | 0.001 WAD | Prevent extreme imbalance |
| MAX_PROPORTION | 0.999 WAD | Prevent extreme imbalance |

### 9.2 Governance-Controlled Parameters

| Parameter | Range | Default | Who Controls |
|-----------|-------|---------|--------------|
| fee_rate | 0 - 0.05 WAD | 0.001 WAD (0.1%) | MarketFactory |
| scalar_root | Market-dependent | Varies | MarketFactory |
| initial_anchor | Market-dependent | Varies | MarketFactory |

### 9.3 Safe Ranges and Rationale

**Fee Rate:**
- Too low (< 0.01%): Insufficient LP incentive
- Too high (> 1%): Trading becomes uneconomical
- Recommended: 0.05% - 0.3%

**Scalar Root:**
- Controls rate sensitivity
- Higher = more price impact per trade
- Lower = more stable implied rate

---

## 10. Implementation Notes (Non-Normative) (1-2 pages)

*This section describes Cairo implementation details and is not part of the normative specification.*

### 10.1 Spec → Contract Mapping

| Specification | Contract | File |
|---------------|----------|------|
| SY Token | SY | `contracts/src/tokens/sy.cairo` |
| PT Token | PT | `contracts/src/tokens/pt.cairo` |
| YT Token + Minting | YT | `contracts/src/tokens/yt.cairo` |
| AMM Market | Market | `contracts/src/market/amm.cairo` |
| AMM Math (cubit) | market_math_fp | `contracts/src/market/market_math_fp.cairo` |
| Fixed-Point Math (cubit) | math_fp | `contracts/src/libraries/math_fp.cairo` |

### 10.2 Cairo-Specific Constraints

- **No negative numbers:** All rates stored as absolute values with sign flags
- **u256 arithmetic:** Custom wad_mul/wad_div handle overflow
- **cubit 64.64 fixed-point:** High-precision transcendental functions via cairo fp library
  - 64-bit integer + 64-bit fractional (~19 decimal digits precision)
  - Native exp, ln, pow, sqrt implementations
  - WAD ↔ Fixed conversion at interface boundaries
- **Precision matching:** Comparable to Pendle's Solidity LogExpMath library

### 10.3 Gas/Performance Trade-offs

- Simplified constant product for price impact (vs full curve computation)
- Cached ln_implied_rate updated on each swap
- Single-block operations (no multi-block accumulation)

---

## 11. Related Work (1 page)

### 11.1 Direct Comparisons

| Protocol | Similarity | Key Difference |
|----------|------------|----------------|
| Pendle Finance | Core yield tokenization model, same logit AMM curve | Ethereum-based, Horizon uses cubit for higher precision |
| Element Finance | PT/YT concept | Defunct, simpler constant-product curve |
| Notional Finance | Fixed-rate DeFi | Lending-based, not tokenized yield |
| Yield Protocol | Fixed-rate borrowing | FYTOKEN model, not split tokens |

### 11.2 Why Horizon Differs

- **Starknet-native:** First yield tokenization on Starknet
- **Cairo implementation:** Native u256, optimized for ZK rollup
- **Pragma integration:** Leverages Starknet's primary oracle
- **Full Pendle logit curve:** Implements the same `ln(p/(1-p))/rateScalar + rateAnchor` formula
- **High-precision math:** cubit 64.64 fixed-point provides ~19 decimal digits (exceeds Solidity's ~18)

---

## 12. Conclusion (0.5 page)

### Summary:
- Horizon Protocol enables fixed yield and yield trading on Starknet
- Core invariant: PT + YT = SY (before expiry)
- PT guaranteed 1:1 redemption at maturity
- Time-decay AMM ensures price convergence
- Immutable core contracts minimize admin risk

### Key Guarantees Recap:
1. PT holders receive 1 underlying per PT at maturity
2. YT holders receive all yield until expiry
3. LPs receive proportional share on exit
4. Conservation invariant maintained by arbitrage

---

## Appendices (As Needed)

### Appendix A: Mathematical Proofs
- Convergence of PT price to 1 at expiry
- Arbitrage-free pricing relationship

### Appendix B: Numerical Examples
- Complete walkthrough of PT purchase → redemption
- LP deposit → withdrawal with yield

### Appendix C: Contract Interface Specifications
- Full ABI documentation
- Event schemas

---

## Document Production Checklist

- [ ] All formulas verified against implementation
- [ ] No current parameter values (only ranges)
- [ ] No marketing language
- [ ] No roadmap or future plans
- [ ] All admin powers explicitly enumerated
- [ ] All invariants testable/verifiable
- [ ] References to code are accurate
- [ ] Peer review by at least 2 technical reviewers
- [ ] Version tagged in git matching contract release

---

## Next Steps

1. **Draft writing:** Write full prose for each section
2. **Formula verification:** Cross-check all math against `market_math.cairo` and `math.cairo`
3. **Diagram creation:** Vector diagrams (SVG) for all flows
4. **Technical review:** Internal review before external
5. **LaTeX formatting:** Convert to professional PDF
6. **Audit alignment:** Ensure whitepaper matches audited code
