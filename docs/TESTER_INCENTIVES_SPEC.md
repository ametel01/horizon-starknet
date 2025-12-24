# Tester Recruitment & Incentives Specification

Goal: Recruit 20+ independent users to test Horizon Protocol on mainnet for Starknet bounty submission.

## Tweet Templates

### Option A: Urgency + Reward Focus

```
Calling Starknet DeFi testers!

We're giving away 2000 STRK tokens, to cover for tx fees, to early testers of Horizon Protocol - the first yield tokenization protocol on Starknet.

What you'll do:
- Mint test tokens (free faucet)
- Wrap hrzSTRK into SY (Standardize Yield) token.
- Split SY into PT + YT
- Trade on our AMM
- Claim yield
- Redeem SY for hrzSTRK
- ~10 mins total

The first 20 wallets that will perform all of the above actions will get 100 STRK each.

https://splityield.org/

Who's in?
```

### Option B: Exclusive Access Angle

```
20 spots for Horizon Protocol alpha testers

We're selecting 20 testers to help battle-test our mainnet launch before a Starknet bounty submission.

In return:
- 25 STRK per qualified tester
- Early adopter NFT badge
- First access to future drops

Takes ~5 min. Real mainnet transactions.

DM or reply to claim a spot
```

### Option C: Community Challenge

```
Starknet builders challenge

First 20 wallets to complete ALL of these on Horizon Protocol:

1. Claim test tokens (faucet)
2. Mint PT+YT
3. Execute a swap
4. Add liquidity

...get 25 STRK each. No strings.

We're tracking via our indexer - just transact and you're in.

Start here: [link]
```

### Option D: Technical/Builder Focus

```
Building the first Pendle-style protocol on Starknet.

Need 20 testers for mainnet alpha. You'll be splitting yield-bearing assets into PT (fixed yield) and YT (variable yield), then trading them on our custom AMM.

Reward: 25 STRK per tester who completes all actions.

5 min of your time. Real DeFi on Starknet.

[link]
```

---

## Incentive Options

### Option 1: Off-Chain Points + Manual STRK Distribution

**Implementation time:** 1 day
**Complexity:** Low
**Cost:** 500 STRK (~$250)

#### How it works

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Your Indexer   │────>│  API Endpoint   │────>│  Leaderboard    │
│  (PostgreSQL)   │     │  (Next.js API)  │     │  (Frontend)     │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │
        v
┌─────────────────┐
│ Export CSV      │───> Manual STRK transfer via wallet
│ of top wallets  │
└─────────────────┘
```

#### Points formula

| Action | Points |
|--------|--------|
| Faucet claim | 10 |
| Mint PT+YT | 50 |
| Swap (any direction) | 30 |
| Add liquidity | 100 |
| Remove liquidity | 20 |
| Claim yield | 40 |

**Qualification threshold:** 100+ points (ensures multiple actions)

#### SQL query for leaderboard

```sql
WITH user_actions AS (
  -- Faucet claims (from underlying token transfers to faucet users)
  SELECT sender as user_address, 'mint_py' as action, COUNT(*) as count
  FROM router_mint_py
  GROUP BY sender

  UNION ALL

  SELECT sender as user_address, 'swap' as action, COUNT(*) as count
  FROM router_swap
  GROUP BY sender

  UNION ALL

  SELECT sender as user_address, 'swap_yt' as action, COUNT(*) as count
  FROM router_swap_yt
  GROUP BY sender

  UNION ALL

  SELECT sender as user_address, 'add_liquidity' as action, COUNT(*) as count
  FROM router_add_liquidity
  GROUP BY sender

  UNION ALL

  SELECT sender as user_address, 'remove_liquidity' as action, COUNT(*) as count
  FROM router_remove_liquidity
  GROUP BY sender

  UNION ALL

  SELECT user as user_address, 'claim_yield' as action, COUNT(*) as count
  FROM yt_interest_claimed
  GROUP BY user
)
SELECT
  user_address,
  SUM(CASE
    WHEN action = 'mint_py' THEN count * 50
    WHEN action IN ('swap', 'swap_yt') THEN count * 30
    WHEN action = 'add_liquidity' THEN count * 100
    WHEN action = 'remove_liquidity' THEN count * 20
    WHEN action = 'claim_yield' THEN count * 40
    ELSE 0
  END) as total_points,
  COUNT(DISTINCT action) as unique_actions
FROM user_actions
GROUP BY user_address
HAVING SUM(CASE
    WHEN action = 'mint_py' THEN count * 50
    WHEN action IN ('swap', 'swap_yt') THEN count * 30
    WHEN action = 'add_liquidity' THEN count * 100
    WHEN action = 'remove_liquidity' THEN count * 20
    WHEN action = 'claim_yield' THEN count * 40
    ELSE 0
  END) >= 100
ORDER BY total_points DESC
LIMIT 50;
```

#### Pros/Cons

| Pros | Cons |
|------|------|
| No smart contract work | Manual distribution |
| Uses existing indexer | Trust-based |
| Fast to implement | No on-chain proof |

---

### Option 2: On-Chain Points Contract

**Implementation time:** 3-5 days
**Complexity:** Medium
**Cost:** 500 STRK + gas for deployment

#### Contract interface

```cairo
#[starknet::interface]
pub trait IHorizonPoints<TContractState> {
    // Award points to a user (only callable by authorized contracts)
    fn award_points(ref self: TContractState, user: ContractAddress, action: felt252, amount: u256);

    // View functions
    fn get_points(self: @TContractState, user: ContractAddress) -> u256;
    fn get_action_count(self: @TContractState, user: ContractAddress, action: felt252) -> u32;
    fn get_total_users(self: @TContractState) -> u32;

    // Leaderboard (returns top N users)
    fn get_leaderboard(self: @TContractState, limit: u32) -> Array<(ContractAddress, u256)>;

    // Admin functions
    fn set_authorized_caller(ref self: TContractState, caller: ContractAddress, authorized: bool);
    fn withdraw_rewards(ref self: TContractState, token: ContractAddress, amount: u256);
}
```

#### Storage structure

```cairo
#[storage]
struct Storage {
    // User points
    user_points: Map<ContractAddress, u256>,
    // User action counts (user -> action -> count)
    user_actions: Map<(ContractAddress, felt252), u32>,
    // All users who have points
    users: Vec<ContractAddress>,
    user_exists: Map<ContractAddress, bool>,
    // Authorized callers (Router, etc.)
    authorized_callers: Map<ContractAddress, bool>,
    // Owner
    owner: ContractAddress,
}
```

#### Integration with Router

Add to Router contract after each action:

```cairo
// After successful mint_py
let points_contract = IHorizonPointsDispatcher { contract_address: self.points_contract.read() };
points_contract.award_points(caller, 'mint_py', 50);

// After successful swap
points_contract.award_points(caller, 'swap', 30);
```

#### Pros/Cons

| Pros | Cons |
|------|------|
| Fully transparent | Requires contract work |
| On-chain proof | Router upgrade needed |
| Trustless | More complex |

---

### Option 3: Galxe/Layer3 Quest Integration

**Implementation time:** 2-3 days
**Complexity:** Low
**Cost:** Platform fees + rewards

#### Galxe Setup

1. Create account at https://galxe.com
2. Create new campaign
3. Add credentials:
   - Contract interaction with Router (mint_py)
   - Contract interaction with Router (swap)
   - Contract interaction with Market (add_liquidity)
4. Set reward (STRK tokens or NFT)
5. Fund reward pool

#### Layer3 Setup

1. Create account at https://layer3.xyz
2. Create quest with multiple steps
3. Configure on-chain verification
4. Set bounty amount

#### Pros/Cons

| Pros | Cons |
|------|------|
| Built-in user base | Platform fees (~10-15%) |
| Handles verification | Less control |
| Social features | Dependent on platform |

---

### Option 4: NFT Early Tester Badge

**Implementation time:** 2 days
**Complexity:** Low-Medium
**Cost:** Gas only

#### Contract interface

```cairo
#[starknet::interface]
pub trait IHorizonTesterBadge<TContractState> {
    // Claim badge (verifies user has completed required actions)
    fn claim_badge(ref self: TContractState);

    // Check if user is eligible
    fn is_eligible(self: @TContractState, user: ContractAddress) -> bool;

    // Check if user has claimed
    fn has_claimed(self: @TContractState, user: ContractAddress) -> bool;

    // Get total badges minted
    fn total_minted(self: @TContractState) -> u256;

    // ERC721 standard functions
    fn balance_of(self: @TContractState, owner: ContractAddress) -> u256;
    fn owner_of(self: @TContractState, token_id: u256) -> ContractAddress;
    fn token_uri(self: @TContractState, token_id: u256) -> ByteArray;
}
```

#### Eligibility verification

Badge contract queries Router/Market to verify user has:
- At least 1 mint_py transaction
- At least 1 swap transaction
- At least 1 add_liquidity transaction

Or simpler: Badge contract trusts off-chain verification, owner can whitelist addresses.

#### Metadata example

```json
{
  "name": "Horizon Alpha Tester #42",
  "description": "Awarded to early testers of Horizon Protocol on Starknet mainnet.",
  "image": "ipfs://...",
  "attributes": [
    { "trait_type": "Test Period", "value": "December 2024" },
    { "trait_type": "Network", "value": "Starknet Mainnet" },
    { "trait_type": "Badge Type", "value": "Alpha Tester" }
  ]
}
```

#### Pros/Cons

| Pros | Cons |
|------|------|
| Lasting recognition | Requires contract |
| Shareable/visible | No monetary value |
| Creates community | Extra step for users |

---

## Recommended Approach

### Phase 1: Immediate (Today)

1. Deploy indexer to production (if not already)
2. Add `/api/leaderboard` endpoint to frontend
3. Add `/leaderboard` page to display rankings
4. Post tweet with 500 STRK reward announcement

### Phase 2: This Week

1. Deploy simple NFT badge contract
2. Add "Claim Badge" button for qualified users
3. This becomes permanent proof for bounty submission

### Phase 3: After Testing

1. Export qualified wallet addresses from indexer
2. Distribute STRK rewards manually
3. Document all transaction hashes for bounty evidence

---

## Implementation Checklist

### Leaderboard Feature

- [ ] Create API route `/api/leaderboard`
- [ ] Query indexer database for user activity
- [ ] Calculate points per user
- [ ] Return sorted leaderboard JSON
- [ ] Create `/leaderboard` page component
- [ ] Display user rankings with points
- [ ] Show qualifying threshold
- [ ] Add countdown/end date for campaign

### Evidence Collection for Bounty

- [ ] Export unique wallet addresses
- [ ] Export transaction hashes per user
- [ ] Document action types completed
- [ ] Screenshot leaderboard
- [ ] Create summary document

---

## Budget Breakdown

| Item | Cost |
|------|------|
| STRK rewards (20 users x 25 STRK) | 500 STRK |
| NFT badge deployment gas | ~5 STRK |
| Marketing/promotion | $0 (organic) |
| **Total** | **~505 STRK (~$250)** |

---

## Timeline

| Day | Task |
|-----|------|
| Day 1 | Deploy indexer, add leaderboard API/page, post tweet |
| Day 2-5 | Monitor signups, engage on Twitter/Telegram |
| Day 5 | Deploy NFT badge contract (optional) |
| Day 7 | Close campaign, export data |
| Day 8 | Distribute STRK rewards |
| Day 9 | Submit bounty with evidence |

---

## Evidence Format for Bounty Submission

```markdown
## Real User Testing Evidence

### Summary
- Total unique users: 25
- Qualified users (100+ points): 22
- Total transactions: 156
- Testing period: Dec 20-27, 2024

### Qualified Wallets

| Wallet | Points | Actions | Key Tx Hash |
|--------|--------|---------|-------------|
| 0x0715...0691 | 280 | mint, swap, LP | 0xabc123... |
| 0x0234...5678 | 230 | mint, swap x3 | 0xdef456... |
| ... | ... | ... | ... |

### Transaction Categories

| Action | Count | Example Tx |
|--------|-------|------------|
| Faucet claims | 25 | 0x... |
| Mint PT+YT | 23 | 0x... |
| Swaps | 45 | 0x... |
| Add liquidity | 18 | 0x... |
| Remove liquidity | 12 | 0x... |
| Claim yield | 8 | 0x... |
```
