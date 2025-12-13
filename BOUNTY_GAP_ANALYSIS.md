# Horizon Protocol - Bounty Gap Analysis & Implementation Plan

## Executive Summary

This document evaluates the current state of the Horizon Protocol Starknet project against the StarkWare bounty requirements and provides a detailed implementation plan to meet all mandatory criteria.

**Current State**: Smart contracts are feature-complete (MVP) with 245 tests
**Missing**: Frontend, mainnet deployment, real user testing
**Bounty Value**: $8,000
**Complexity Level**: Advanced

---

## Part 1: Bounty Requirements Analysis

### Mandatory Acceptance Criteria

| Requirement | Status | Gap |
|------------|--------|-----|
| **Mainnet Deployment** | ❌ Not Done | No deployment scripts, not deployed |
| **Wallet connection & onboarding** | ❌ Not Done | No frontend exists |
| **Tokenization of yield-bearing assets** | ✅ Complete | SY, PT, YT contracts implemented |
| **Creation of PT and YT** | ✅ Complete | Factory + YT minting logic done |
| **Buying and selling future yield** | ✅ Complete | AMM Market with 4 swap variants |
| **Position management** | ⚠️ Partial | Contracts support it, no UI |
| **Clear confirmation and error handling** | ⚠️ Partial | Contract errors exist, no UI feedback |
| **Fully functional backend** | ✅ Complete | All yield calculations implemented |
| **No placeholder logic/mocks** | ✅ Complete | Mocks only for testing |
| **Real User Testing (20+ users)** | ❌ Not Done | No users yet |
| **Clear UX** | ❌ Not Done | No frontend |
| **No hackathon artifacts** | N/A | Need to ensure quality |

### Evaluation Criteria (If Mandatory Met)

| Criterion | Current State | Action Needed |
|-----------|---------------|---------------|
| **UX Quality** | N/A | Build intuitive frontend |
| **Product Thinking** | Good | Clear value prop in contracts |
| **Backend** | ✅ Excellent | 3,790 LOC, 245 tests |
| **Mainnet Deployment** | ❌ None | Deploy and get real usage |
| **Design and UI** | ❌ None | Professional design needed |

---

## Part 2: Current Implementation Status

### What's Complete (Smart Contracts)

```
src/
├── tokens/
│   ├── sy.cairo          ✅ Standardized Yield wrapper (277 LOC)
│   ├── pt.cairo          ✅ Principal Token (178 LOC)
│   └── yt.cairo          ✅ Yield Token + minting/redemption (458 LOC)
├── market/
│   ├── amm.cairo         ✅ PT/SY AMM with time-decay pricing (532 LOC)
│   ├── market_factory.cairo ✅ Market deployment factory (160 LOC)
│   └── market_math.cairo ✅ AMM curve mathematics (150+ LOC)
├── factory.cairo         ✅ PT/YT pair factory (160 LOC)
├── router.cairo          ✅ User-friendly aggregator (600+ LOC)
├── libraries/
│   ├── math.cairo        ✅ WAD arithmetic + transcendentals (250+ LOC)
│   └── errors.cairo      ✅ Comprehensive error codes
└── mocks/
    └── mock_yield_token.cairo ✅ Test fixtures only
```

**Total**: ~3,790 lines of production Cairo code

### Test Coverage

```
tests/
├── test_sy.cairo         ✅ SY deposit/redeem tests
├── test_pt.cairo         ✅ PT access control tests
├── test_yt.cairo         ✅ YT minting/interest tests
├── test_market.cairo     ✅ AMM liquidity/swap tests
├── test_market_math.cairo ✅ Curve math tests
├── test_math.cairo       ✅ 45+ edge case tests
├── test_factory.cairo    ✅ Factory deployment tests
├── test_market_factory.cairo ✅ Market factory tests
├── test_router.cairo     ✅ Router operation tests
└── integration/
    ├── test_full_flow.cairo   ✅ End-to-end flow
    ├── test_expiry.cairo      ✅ Expiry mechanics
    ├── test_edge_cases.cairo  ✅ Boundary conditions
    └── test_market_flow.cairo ✅ Market operations
```

**Total**: 245 test functions, 6,985 lines of test code

### What's Missing

| Component | Priority | Effort Estimate |
|-----------|----------|-----------------|
| **Frontend Application** | Critical | Large |
| **Wallet Integration** | Critical | Medium |
| **Mainnet Deployment** | Critical | Medium |
| **Deployment Scripts** | Critical | Small |
| **Real Yield Token Integration** | Critical | Medium |
| **User Testing Campaign** | Critical | Medium |
| **Indexer/Subgraph** | High | Medium |
| **Position Dashboard** | High | Medium |
| **Trade History** | Medium | Small |
| **Analytics/Charts** | Medium | Medium |

---

## Part 3: Implementation Plan

### Phase 1: Deployment Infrastructure (Priority: CRITICAL)

#### 1.1 Deployment Scripts

**Objective**: Create scripts to deploy all contracts to Starknet

**Tasks**:
1. Create deployment configuration files for testnet and mainnet
2. Write deployment scripts using `starkli` or `sncast`
3. Create contract verification scripts
4. Document deployed addresses

**Files to create**:
```
deploy/
├── config/
│   ├── testnet.json       # Sepolia configuration
│   └── mainnet.json       # Mainnet configuration
├── scripts/
│   ├── deploy_core.sh     # Deploy SY, Factory, MarketFactory
│   ├── deploy_markets.sh  # Deploy PT/YT pairs and markets
│   └── verify.sh          # Contract verification
├── addresses/
│   ├── testnet.json       # Deployed testnet addresses
│   └── mainnet.json       # Deployed mainnet addresses
└── README.md              # Deployment documentation
```

**Deliverables**:
- Working deployment scripts
- Testnet deployment with verified contracts
- Mainnet deployment plan

#### 1.2 Real Yield Token Integration

**Objective**: Integrate with real yield-bearing tokens on Starknet

**Candidate tokens** (research needed):
- xSTRK (staked STRK)
- wstETH (bridged Lido stETH)
- Other yield-bearing vault tokens

**Tasks**:
1. Research available yield-bearing tokens on Starknet mainnet
2. Create SY adapter contracts for each token
3. Test with real token mechanics
4. Deploy SY wrappers

**Files to create**:
```
src/adapters/
├── sy_xstrk.cairo         # xSTRK adapter
├── sy_wsteth.cairo        # wstETH adapter
└── ...                    # Other adapters as needed
```

---

### Phase 2: Frontend Application (Priority: CRITICAL)

#### 2.1 Project Setup

**Technology Stack** (Recommended):
- **Framework**: Next.js 16 (App Router)
- **Starknet**: starknet.js ^9.0.0, get-starknet
- **Wallet**: ArgentX, Braavos integration
- **Styling**: TailwindCSS + shadcn/ui
- **State**: TanStack Query (React Query)
- **Charts**: Recharts or TradingView widget

**Project Structure**:
```
frontend/
├── app/
│   ├── page.tsx              # Landing/Dashboard
│   ├── mint/page.tsx         # Mint PT+YT
│   ├── trade/page.tsx        # AMM Trading
│   ├── pools/page.tsx        # Liquidity pools
│   └── portfolio/page.tsx    # Position management
├── components/
│   ├── ui/                   # shadcn components
│   ├── wallet/               # Wallet connection
│   ├── tokens/               # Token displays
│   ├── charts/               # Yield curves, prices
│   └── forms/                # Transaction forms
├── hooks/
│   ├── useStarknet.ts        # Starknet connection
│   ├── useContracts.ts       # Contract interactions
│   └── usePositions.ts       # User positions
├── lib/
│   ├── contracts.ts          # Contract ABIs + addresses
│   ├── math.ts               # Frontend yield calculations
│   └── formatters.ts         # Number/date formatting
└── public/
    └── assets/               # Logos, icons
```

#### 2.2 Core Pages

**Dashboard (Landing Page)**:
- Protocol TVL and statistics
- Available markets (PT/YT pairs)
- Current implied yields
- Quick actions (Mint, Trade)

**Mint Page**:
- Select yield-bearing asset
- Choose expiry date
- Input amount to tokenize
- Preview PT + YT output
- Transaction confirmation
- Success/error feedback

**Trade Page**:
- Market selection
- Buy/Sell PT toggle
- Amount input with max buttons
- Price impact display
- Slippage settings
- Implied yield change preview

**Pools Page**:
- List of available pools
- APR/TVL for each pool
- Add/Remove liquidity forms
- LP position display

**Portfolio Page**:
- PT balances with expiry dates
- YT balances with claimable yield
- LP positions
- Pending interest claims
- Transaction history

#### 2.3 Key Components

**Wallet Connection**:
```
components/wallet/
├── ConnectButton.tsx      # Connect wallet CTA
├── WalletModal.tsx        # Wallet selection modal
├── AccountInfo.tsx        # Connected account display
└── NetworkSwitch.tsx      # Network indicator/switch
```

**Transaction Flow**:
```
components/transactions/
├── TransactionButton.tsx  # Submit with loading state
├── TransactionStatus.tsx  # Pending/confirmed/failed
├── TransactionToast.tsx   # Notification toasts
└── ApprovalFlow.tsx       # Token approval handling
```

**Yield Display**:
```
components/yield/
├── ImpliedYieldCard.tsx   # Current implied APY
├── YieldCurve.tsx         # APY vs expiry chart
├── PTPrice.tsx            # PT discount display
└── AccruedYield.tsx       # Claimable yield amount
```

---

### Phase 3: Indexing & Data (Priority: HIGH)

#### 3.1 Event Indexing

**Option A: Custom Indexer**
- Use Apibara or Checkpoint
- Index all contract events
- Store in PostgreSQL/MongoDB
- Expose GraphQL API

**Option B: Third-party Service**
- Use Voyager API
- Use existing Starknet indexers
- Less control but faster setup

**Events to index**:
```cairo
// From YT contract
MintPY { caller, receiver, amount_sy, amount_pt, amount_yt }
RedeemPY { caller, receiver, amount_sy, amount_pt, amount_yt }
InterestClaimed { user, amount }

// From Market contract
Mint { provider, lp_amount, sy_amount, pt_amount }
Burn { provider, lp_amount, sy_amount, pt_amount }
Swap { caller, sy_delta, pt_delta, receiver }

// From Factory
YieldContractsCreated { sy, expiry, pt, yt }
MarketCreated { pt, market }
```

**Data to track**:
- User positions (PT, YT, LP balances)
- Historical trades
- TVL over time
- Implied yield history
- Fee accumulation

#### 3.2 Price Feeds

**Required data**:
- PT price in SY (from AMM)
- SY exchange rate
- Implied APY
- YT implied price

**Implementation**:
- Read from contract `get_ln_implied_rate()`
- Calculate PT price from reserves
- Track historical prices for charts

---

### Phase 4: Testing & Launch (Priority: CRITICAL)

#### 4.1 Testnet Launch

**Tasks**:
1. Deploy all contracts to Sepolia
2. Deploy frontend to Vercel/similar
3. Create testnet faucet for mock tokens
4. Internal testing (team + close contacts)
5. Fix bugs and UX issues
6. Iterate on feedback

**Testnet Checklist**:
- [ ] All contracts deployed and verified
- [ ] Frontend connected to testnet
- [ ] Wallet connection works (Argent, Braavos)
- [ ] Mint PT+YT flow works
- [ ] Trading flow works
- [ ] LP flow works
- [ ] Position display accurate
- [ ] Error handling clear
- [ ] Mobile responsive

#### 4.2 Mainnet Deployment

**Pre-launch checklist**:
- [ ] Contract audit (at minimum: internal review)
- [ ] Testnet battle-tested (no critical bugs)
- [ ] Real yield token integration tested
- [ ] Gas costs acceptable
- [ ] Emergency pause mechanism (optional but recommended)

**Launch sequence**:
1. Deploy Factory contracts
2. Deploy SY adapters for target tokens
3. Create initial PT/YT pairs
4. Create initial markets with liquidity
5. Deploy frontend pointing to mainnet
6. Announce launch

#### 4.3 User Acquisition (20+ Users Required)

**Strategy**:
1. **Starknet Discord/Telegram** - Announce and recruit testers
2. **DeFi communities** - Target Pendle users interested in Starknet
3. **Bounty hunters** - Those tracking this bounty
4. **Twitter/X** - Create announcement thread
5. **Direct outreach** - Contact Starknet builders

**Evidence to collect**:
- Transaction hashes from 20+ unique wallets
- User feedback/testimonials
- Usage metrics (TVL, trades, mints)

---

## Part 4: Technical Specifications

### Contract Addresses (To Be Deployed)

```json
{
  "testnet": {
    "factory": "0x...",
    "marketFactory": "0x...",
    "router": "0x...",
    "sy_xstrk": "0x...",
    "pt_xstrk_dec25": "0x...",
    "yt_xstrk_dec25": "0x...",
    "market_xstrk_dec25": "0x..."
  },
  "mainnet": {
    // Same structure
  }
}
```

### Frontend Environment Variables

```env
NEXT_PUBLIC_STARKNET_NETWORK=mainnet|sepolia
NEXT_PUBLIC_FACTORY_ADDRESS=0x...
NEXT_PUBLIC_MARKET_FACTORY_ADDRESS=0x...
NEXT_PUBLIC_ROUTER_ADDRESS=0x...
NEXT_PUBLIC_SUPPORTED_WALLETS=argentX,braavos
```

### API Endpoints (If Using Indexer)

```
GET /api/markets              # List all markets
GET /api/markets/:address     # Market details
GET /api/positions/:address   # User positions
GET /api/history/:address     # Transaction history
GET /api/stats                # Protocol statistics
```

---

## Part 5: Effort Estimation

### Development Phases

| Phase | Components | Effort |
|-------|------------|--------|
| **Phase 1: Deployment** | Scripts, adapters | 3-5 days |
| **Phase 2: Frontend** | All pages + components | 10-15 days |
| **Phase 3: Indexing** | Events, data layer | 3-5 days |
| **Phase 4: Testing** | QA, user testing | 5-7 days |

**Total Estimated Effort**: 21-32 days

### Minimum Viable Submission

If time is constrained, prioritize:

1. **Day 1-3**: Deployment scripts + testnet deployment
2. **Day 4-10**: Minimal frontend (Mint, Trade, Portfolio)
3. **Day 11-14**: Mainnet deployment + user testing
4. **Day 15+**: Polish, bug fixes, documentation

**Minimal Frontend Features**:
- Wallet connection
- Mint PT+YT from SY
- Swap PT/SY
- View positions
- Claim yield

---

## Part 6: Risk Assessment

### Technical Risks

| Risk | Mitigation |
|------|------------|
| Contract bugs on mainnet | Thorough testing, consider audit |
| No real yield tokens available | Research alternatives, create wrapper |
| Frontend complexity | Use proven libraries, keep scope minimal |
| Indexer delays | Start with direct RPC calls, add indexer later |

### Business Risks

| Risk | Mitigation |
|------|------------|
| Can't get 20 users | Start outreach early, offer incentives |
| Poor UX | User testing, iterate quickly |
| Competition | Ship fast, differentiate on UX |

### Bounty-Specific Risks

| Risk | Mitigation |
|------|------------|
| Only 1 winner | Focus on completeness + quality |
| No payout if criteria not met | Ensure all mandatory items checked |
| Time pressure | Prioritize mandatory features |

---

## Part 7: Action Items

### Immediate (This Week)

1. [ ] Research yield-bearing tokens on Starknet mainnet
2. [ ] Set up frontend project structure
3. [ ] Create deployment scripts for testnet
4. [ ] Deploy contracts to Sepolia
5. [ ] Test deployment end-to-end

### Short-term (Next 2 Weeks)

6. [ ] Build core frontend pages (Dashboard, Mint, Trade)
7. [ ] Implement wallet connection
8. [ ] Add transaction handling
9. [ ] Deploy frontend to testnet
10. [ ] Internal testing and bug fixes

### Pre-Launch (Week 3)

11. [ ] Portfolio page with positions
12. [ ] Add charts/visualizations
13. [ ] Mobile responsiveness
14. [ ] Final testnet testing
15. [ ] Prepare mainnet deployment

### Launch (Week 4)

16. [ ] Deploy to mainnet
17. [ ] Seed initial liquidity
18. [ ] User outreach campaign
19. [ ] Collect 20+ user transactions
20. [ ] Submit bounty application

---

## Conclusion

The smart contract foundation is solid with excellent test coverage. The critical path to bounty completion is:

1. **Frontend application** - Most significant gap
2. **Mainnet deployment** - Required for consideration
3. **Real user testing** - Must have 20+ independent users

With focused effort on the frontend and user acquisition, this project has a strong foundation to meet all bounty requirements. The contract architecture is sound and follows Pendle's proven model.

**Recommendation**: Start frontend development immediately while researching yield token integrations in parallel. Plan for a 3-4 week sprint to submission-ready state.
