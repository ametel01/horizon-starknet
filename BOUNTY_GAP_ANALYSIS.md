# Horizon Protocol - Bounty Gap Analysis & Implementation Plan

## Executive Summary

This document evaluates the current state of the Horizon Protocol Starknet project against the StarkWare bounty requirements and provides a detailed implementation plan to meet all mandatory criteria.

**Current State**: Smart contracts complete (245 tests) + Frontend complete (5 pages, 18+ hooks) + Devnet deployed
**Missing**: Sepolia/Mainnet deployment, real user testing (20+ users)
**Bounty Value**: $8,000
**Complexity Level**: Advanced

**Last Updated**: December 14, 2025

---

## Part 1: Bounty Requirements Analysis

### Mandatory Acceptance Criteria

| Requirement | Status | Gap |
|------------|--------|-----|
| **Mainnet Deployment** | ⚠️ Partial | Devnet deployed with 2 markets, scripts ready. Sepolia/Mainnet pending |
| **Wallet connection & onboarding** | ✅ Complete | ArgentX/Braavos via @starknet-io/get-starknet, auto-reconnect |
| **Tokenization of yield-bearing assets** | ✅ Complete | SY, PT, YT contracts + Wrap/Mint UI in frontend |
| **Creation of PT and YT** | ✅ Complete | Factory + Mint page with Wrap→SY→PT+YT flow |
| **Buying and selling future yield** | ✅ Complete | AMM + Trade page (PT & YT swaps including flash swaps) |
| **Position management** | ✅ Complete | Portfolio page: balances, yield claims, redemptions |
| **Clear confirmation and error handling** | ✅ Complete | TxStatus component, toast notifications, loading states |
| **Fully functional backend** | ✅ Complete | All yield calculations + 2 markets deployed on devnet |
| **No placeholder logic/mocks** | ✅ Complete | Production code throughout, mocks only in test fixtures |
| **Real User Testing (20+ users)** | ❌ Not Done | No users yet - requires public network deployment |
| **Clear UX** | ✅ Complete | 5 polished pages, responsive design, intuitive flows |
| **No hackathon artifacts** | ✅ Clean | Professional codebase, no placeholder code |

### Evaluation Criteria (If Mandatory Met)

| Criterion | Current State | Action Needed |
|-----------|---------------|---------------|
| **UX Quality** | ✅ Good | 5 pages with intuitive flows, responsive design |
| **Product Thinking** | ✅ Excellent | Clear value prop, Pendle-style architecture |
| **Backend** | ✅ Excellent | 3,790 LOC contracts, 245 tests, 2 devnet markets |
| **Mainnet Deployment** | ⚠️ Devnet Only | Deploy to Sepolia then Mainnet |
| **Design and UI** | ✅ Complete | Tailwind + custom components, dark theme |

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

### What's Complete (Frontend)

```
packages/frontend/
├── app/
│   ├── page.tsx              ✅ Dashboard with stats, market list
│   ├── mint/page.tsx         ✅ Wrap→SY, Mint PT+YT, Unwrap flows
│   ├── trade/page.tsx        ✅ PT/YT swaps with slippage control
│   ├── pools/page.tsx        ✅ Add/remove liquidity
│   └── portfolio/page.tsx    ✅ Positions, yields, redemptions
├── components/
│   ├── wallet/               ✅ ConnectButton with auto-reconnect
│   ├── forms/                ✅ 7 form components (Mint, Swap, LP, etc.)
│   ├── markets/              ✅ MarketList, MarketCard, StatsOverview
│   └── ui/                   ✅ Button, Card, Input, Modal, Toast, etc.
├── hooks/                    ✅ 18+ hooks for all contract interactions
└── providers/                ✅ StarknetProvider with wallet state
```

### What's Complete (Deployment)

```
deploy/
├── scripts/
│   ├── deploy.sh             ✅ Full deployment script (sncast)
│   ├── declare.sh            ✅ Class declaration
│   └── export-addresses.sh   ✅ Address export to JSON
├── addresses/
│   ├── devnet.json           ✅ 2 markets deployed (nstSTRK, sSTRK)
│   └── .env.devnet           ✅ Environment configuration
└── README.md                 ✅ Deployment documentation
```

### What's Still Missing

| Component | Priority | Status |
|-----------|----------|--------|
| **Frontend Application** | Critical | ✅ DONE - 5 pages, 18+ hooks |
| **Wallet Integration** | Critical | ✅ DONE - ArgentX/Braavos |
| **Deployment Scripts** | Critical | ✅ DONE - Working on devnet |
| **Position Dashboard** | High | ✅ DONE - Portfolio page |
| **Sepolia Deployment** | Critical | ❌ NOT DONE - Scripts ready |
| **Mainnet Deployment** | Critical | ❌ NOT DONE - After Sepolia |
| **Real Yield Token Integration** | Critical | ⚠️ PARTIAL - Mock tokens on devnet |
| **User Testing Campaign** | Critical | ❌ NOT DONE - Need 20+ users |
| **Indexer/Subgraph** | Medium | ❌ NOT DONE - Using direct RPC |
| **Trade History** | Low | ❌ NOT DONE - Nice to have |
| **Analytics/Charts** | Low | ❌ NOT DONE - Nice to have |

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

### Contract Addresses (Deployed)

**Devnet (Deployed Dec 14, 2025)**
```json
{
  "devnet": {
    "Factory": "0x02d82d7cd464cbda48ac51b25e7ad955bd465275efb5e98bb1e995f58229aa6c",
    "MarketFactory": "0x06738c8c5de0d29a76ae7b9fbe73213dca129e3c688909d193874bc1145c7bec",
    "Router": "0x01272b774002bf20dec4e5c07a6a52540f35ab41f379068da3d239c31c1a90bc",
    "markets": {
      "nstSTRK": {
        "SY": "0x042c743af9d62e2693605f98ebe1ee33e8a9a9de7d6dda26321c513dc9140304",
        "PT": "0x3d13e44e66e6d0fa138f947bee79c5356188af760e14c946684548bad608a24",
        "YT": "0x6f81d9d2296fcba883ce75cf12b9c49a911eeede0d47be8fe512ec87f8d1830",
        "Market": "0x6b44a393b43842633a16a647a0748cd0dd0ba1baf77ab756accfb240eab0765"
      },
      "sSTRK": {
        "SY": "0x0042371669ff83073ec982bb4631dab0389d6e68d25550a4b16474e1efd6efd5",
        "PT": "0x311aa5d84a17b07c7c22a193c88802472458c232a7376832a3610589f9e13af",
        "YT": "0x203a2f08e5cea91180be8fad2992cebf5bd2692897304ea639822526a513c3c",
        "Market": "0x527836da697940a4e08ef2ed1062408dce88ccf1a7b18c645058ef5c4fa496f"
      }
    },
    "expiry": 1768270328
  },
  "sepolia": {
    "// TODO": "Deploy using deploy/scripts/deploy.sh"
  },
  "mainnet": {
    "// TODO": "Deploy after Sepolia validation"
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

### Development Phases (Updated)

| Phase | Components | Status | Remaining |
|-------|------------|--------|-----------|
| **Phase 1: Deployment** | Scripts, adapters | ✅ DONE | - |
| **Phase 2: Frontend** | All pages + components | ✅ DONE | Minor polish |
| **Phase 3: Indexing** | Events, data layer | ⏭️ SKIPPED | Using direct RPC |
| **Phase 4: Public Deploy** | Sepolia + Mainnet | ❌ NOT STARTED | 1-2 days |
| **Phase 5: User Testing** | 20+ users | ❌ NOT STARTED | 3-5 days |

**Remaining Effort**: 4-7 days

### Path to Submission

1. **Day 1**: Deploy to Sepolia, test all flows
2. **Day 2**: Deploy frontend to Vercel, fix any issues
3. **Day 3**: Deploy to mainnet with real yield tokens
4. **Day 4-7**: User acquisition campaign, collect evidence

### Frontend Features (All Complete)
- ✅ Wallet connection (ArgentX, Braavos)
- ✅ Wrap underlying → SY
- ✅ Mint PT+YT from SY
- ✅ Swap PT/SY and YT/SY
- ✅ Add/remove liquidity
- ✅ View positions
- ✅ Claim yield
- ✅ Redeem PT+YT (pre and post expiry)

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

### Completed Items

1. [x] Research yield-bearing tokens on Starknet mainnet
2. [x] Set up frontend project structure
3. [x] Create deployment scripts for testnet
4. [x] Deploy contracts to devnet (2 markets: nstSTRK, sSTRK)
5. [x] Test deployment end-to-end
6. [x] Build core frontend pages (Dashboard, Mint, Trade)
7. [x] Implement wallet connection (ArgentX, Braavos)
8. [x] Add transaction handling (TxStatus, toasts)
9. [x] Portfolio page with positions
10. [x] Mobile responsiveness

### Remaining Critical Tasks

11. [ ] Deploy contracts to Sepolia testnet
12. [ ] Deploy frontend to Vercel pointing to Sepolia
13. [ ] Test all flows on Sepolia (mint, swap, LP, redeem)
14. [ ] Research real yield tokens for mainnet (xSTRK, nstSTRK, etc.)
15. [ ] Deploy to mainnet

### User Acquisition Phase

16. [ ] Seed initial liquidity on mainnet
17. [ ] User outreach campaign (Starknet Discord, Twitter/X)
18. [ ] Collect 20+ unique user transactions
19. [ ] Gather user feedback/testimonials
20. [ ] Submit bounty application with evidence

---

## Conclusion

The project has made **significant progress** and is now near submission-ready:

### Completed (10/12 criteria met)
- ✅ Smart contracts: Complete with 245 tests
- ✅ Frontend: 5 polished pages with full functionality
- ✅ Wallet connection: ArgentX/Braavos with auto-reconnect
- ✅ Position management: Portfolio page with all features
- ✅ Deployment scripts: Working and tested on devnet
- ✅ 2 markets deployed on devnet (nstSTRK, sSTRK)

### Remaining Critical Path
1. **Sepolia deployment** - Scripts ready, just need to execute
2. **Mainnet deployment** - After Sepolia validation
3. **Real user testing** - Must have 20+ unique wallet interactions

### Progress Summary
| Category | Progress |
|----------|----------|
| Smart Contracts | 100% |
| Frontend | 95% |
| Deployment Infrastructure | 100% |
| Devnet Deployment | 100% |
| Sepolia Deployment | 0% |
| Mainnet Deployment | 0% |
| User Testing | 0% |

**Overall Completion: ~75%**

**Recommendation**: Deploy to Sepolia immediately, validate all flows, then proceed to mainnet and user acquisition. The heavy lifting (contracts + frontend) is done.
