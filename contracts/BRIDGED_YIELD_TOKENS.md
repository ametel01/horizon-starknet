# Bridged Yield-Bearing Tokens on Starknet

This document explains how Horizon Protocol handles yield-bearing assets like wstETH that are bridged to Starknet as plain ERC20 tokens.

## The Challenge with Bridged Yield Tokens

On **Ethereum**, wstETH exposes yield mechanics:
```solidity
// On Ethereum - wstETH has yield mechanics
function stEthPerToken() returns (uint256); // Exchange rate
function wrap(uint256 stETH) returns (uint256 wstETH);
function unwrap(uint256 wstETH) returns (uint256 stETH);
```

On **Starknet**, bridged wstETH is just a plain ERC20:
```cairo
// On Starknet - wstETH is just ERC20
fn balance_of(account: ContractAddress) -> u256;
fn transfer(recipient: ContractAddress, amount: u256) -> bool;
// No exchange rate function!
```

## Solution: External Oracle

The architecture separates the **underlying token** from the **index source**:

```
┌─────────────────────────────────────────────────────────────┐
│                     SY Contract                              │
├─────────────────────────────────────────────────────────────┤
│  underlying: wstETH (ERC20)    → holds user deposits        │
│  index_oracle: WstETHOracle    → provides exchange rate     │
└─────────────────────────────────────────────────────────────┘
                    │                        │
                    ▼                        ▼
            ┌──────────────┐        ┌──────────────────┐
            │   wstETH     │        │  WstETH Oracle   │
            │   (ERC20)    │        │  (IIndexOracle)  │
            └──────────────┘        └──────────────────┘
                                           │
                                           ▼
                                    ┌──────────────────┐
                                    │  Data Source     │
                                    │  (Pragma, L1     │
                                    │   bridge, etc.)  │
                                    └──────────────────┘
```

## Oracle Implementation Options

### Option 1: Pragma Oracle Integration

```cairo
#[starknet::contract]
mod WstETHPragmaOracle {
    use pragma_lib::abi::{IPragmaABIDispatcher, IPragmaABIDispatcherTrait};

    #[storage]
    struct Storage {
        pragma_oracle: ContractAddress,
        wsteth_feed_id: felt252,
    }

    #[abi(embed_v0)]
    impl IndexOracleImpl of IIndexOracle<ContractState> {
        fn index(self: @ContractState) -> u256 {
            let pragma = IPragmaABIDispatcher {
                contract_address: self.pragma_oracle.read()
            };
            // Get wstETH/ETH price from Pragma
            // Convert to index (wstETH value in terms of underlying ETH)
            pragma.get_spot_median(self.wsteth_feed_id.read())
        }
    }
}
```

### Option 2: L1 → L2 Message Bridge

```cairo
#[starknet::contract]
mod WstETHBridgeOracle {
    #[storage]
    struct Storage {
        current_index: u256,           // Updated via L1 messages
        last_update: u64,
        l1_handler_address: felt252,
    }

    #[l1_handler]
    fn update_index(ref self: ContractState, from_address: felt252, new_index: u256) {
        assert(from_address == self.l1_handler_address.read(), 'Unauthorized');
        self.current_index.write(new_index);
        self.last_update.write(get_block_timestamp());
    }

    #[abi(embed_v0)]
    impl IndexOracleImpl of IIndexOracle<ContractState> {
        fn index(self: @ContractState) -> u256 {
            // Could add staleness check here
            self.current_index.read()
        }
    }
}
```

## Complete User Flow

### Step 1: User Deposits wstETH

```
User has: 10 wstETH (bridged ERC20)
Oracle index: 1.15 (1 wstETH = 1.15 stETH worth of value)

Action: deposit(user, 10 wstETH)
Result: User receives 10 SY tokens
        SY contract holds 10 wstETH
```

### Step 2: User Mints PT + YT

```
User has: 10 SY
Current py_index: 1.15 WAD (from oracle)

Action: mint_py(user, 10 SY)
Result: User receives 10 PT + 10 YT
        YT contract holds 10 SY
        User's recorded index: 1.15 WAD
```

### Step 3: Time Passes, Yield Accrues

```
6 months later...
Oracle index: 1.20 (1 wstETH now = 1.20 stETH worth)

Yield accumulated: (1.20 - 1.15) / 1.20 * 10 = 0.417 SY worth of yield
```

### Step 4: User Claims Interest (YT Holder)

```
Action: redeem_due_interest(user)

Calculation:
  - User's YT balance: 10
  - User's recorded index: 1.15
  - Current index: 1.20
  - Interest = 10 * (1.20 - 1.15) / 1.20 = 0.417 SY

Result: User receives ~0.417 SY as yield
```

### Step 5: At Expiry, Redeem PT

```
At expiry...
Oracle index: 1.25 (final value)

Action: redeem_py_post_expiry(user, 10 PT)

Calculation:
  - PT represents claim on principal
  - SY returned = PT_amount / current_index * initial_index
  - Approximately 10 * 1.15 / 1.25 = 9.2 SY

Result: User receives ~9.2 SY (which wraps 9.2 wstETH)
        User can redeem SY for 9.2 wstETH
```

## Value Breakdown

```
Initial deposit:     10 wstETH @ index 1.15 = 11.5 ETH value
Final index:         1.25 (8.7% yield over period)

PT holder receives:  9.2 wstETH @ index 1.25 = 11.5 ETH value (principal preserved)
YT holder received:  ~0.8 wstETH in yield claims = 1.0 ETH value (captured yield)

Total:               10 wstETH out = 12.5 ETH value ✓
```

## Deployment Example

```cairo
// 1. Deploy the oracle
let oracle = deploy_wsteth_pragma_oracle(pragma_address, wsteth_feed_id);

// 2. Deploy SY with wstETH as underlying, oracle as index source
let sy = deploy_sy(
    name: "SY-wstETH",
    symbol: "SY-wstETH",
    underlying: WSTETH_ADDRESS,      // Bridged wstETH ERC20
    index_oracle: oracle.contract_address  // Pragma-based oracle
);

// 3. Deploy YT/PT pair
let (pt, yt) = factory.create_yield_contracts(sy.contract_address, expiry);

// 4. Optionally create market for trading
let market = market_factory.create_market(pt.contract_address, ...);
```

## Key Insights

1. **Underlying token doesn't need yield interface** - SY wraps any ERC20
2. **Oracle provides the "yield" signal** - Exchange rate changes drive YT value
3. **1:1 share relationship** - Depositing N wstETH gives N SY (not value-adjusted)
4. **Value is implicit** - The index tells us what each share is worth
5. **Oracle reliability is critical** - Bad oracle data = incorrect yield calculations

## Comparison: Native vs Bridged Yield Tokens

| Aspect | Native Yield Token | Bridged Yield Token |
|--------|-------------------|---------------------|
| Example | Starknet-native staking | wstETH on Starknet |
| underlying | Token address | Token address |
| index_oracle | Same as underlying | External oracle |
| Exchange rate source | Token's `index()` | Oracle's `index()` |
| Trust assumption | Token contract | Oracle + data source |

## Supported Oracle Data Sources

- **Pragma** - Decentralized oracle network on Starknet
- **L1 Bridge** - Cross-chain messaging from Ethereum
- **DEX TWAP** - Time-weighted average from on-chain swaps
- **Custom** - Any contract implementing `IIndexOracle`

## Security Considerations

1. **Oracle Manipulation** - Use TWAP or multiple sources
2. **Staleness** - Add timestamp checks to oracle reads
3. **L1 Finality** - For bridge oracles, consider reorg risk
4. **Price Deviation** - Circuit breakers for abnormal rate changes

This architecture enables Horizon Protocol to support any yield-bearing asset on Starknet, regardless of whether the token itself exposes yield mechanics.

---

## Why Split into PT and YT? Trading Yield Tokens

The real power of yield tokenization comes from the ability to **trade PT and YT separately**, enabling sophisticated yield strategies.

### Strategy 1: Fixed Yield (Sell YT, Keep PT)

```
User wants: Guaranteed fixed return, no yield volatility

Action:
  - Deposit 100 wstETH → get 100 SY
  - Mint 100 PT + 100 YT
  - Sell 100 YT on market for ~5 SY (current yield priced in)
  - Hold 100 PT until maturity

Result:
  - Paid: 100 wstETH
  - Received upfront: 5 SY (from selling YT)
  - At maturity: 100 wstETH equivalent (from PT)
  - Total: 105 wstETH equivalent = 5% fixed yield, GUARANTEED
```

### Strategy 2: Leveraged Yield (Buy YT)

```
User wants: 10x exposure to yield

Action:
  - Has 10 wstETH worth of capital
  - Buys 100 YT on market for ~10 SY

Result:
  - If yield is 10% APY: earns yield on 100 wstETH worth = 10 wstETH
  - 100% return on capital (vs 10% if just holding)
  - Risk: If yield drops, YT loses value fast
```

### Strategy 3: Yield Speculation

```
Bullish on yields? → Buy YT
Bearish on yields? → Sell YT (or hold PT only)
```

## How YT Trading Works: Flash Swaps

The Market contract only trades PT/SY directly. YT trading is done **synthetically** through flash swaps:

### Buy YT (SY → YT)

```
1. User wants to buy YT with SY
2. Flash: Borrow extra SY from pool
3. Mint PT+YT from total SY
4. Sell PT back to pool for SY
5. Repay flash loan
6. User keeps the YT

Net effect: User paid SY, received YT
```

### Sell YT (YT → SY)

```
1. User wants to sell YT for SY
2. Flash: Borrow PT from pool
3. Combine PT + user's YT → redeem for SY
4. Repay PT loan (sell some SY for PT)
5. User keeps remaining SY

Net effect: User paid YT, received SY
```

## Router Interface for YT Trading

```cairo
trait IRouter {
    // Existing functions
    fn mint_py_from_sy(...);
    fn redeem_py_to_sy(...);

    // YT Trading via flash swaps
    fn swap_exact_sy_for_yt(
        yt: ContractAddress,
        market: ContractAddress,
        receiver: ContractAddress,
        sy_in: u256,
        min_yt_out: u256
    ) -> u256;

    fn swap_exact_yt_for_sy(
        yt: ContractAddress,
        market: ContractAddress,
        receiver: ContractAddress,
        yt_in: u256,
        min_sy_out: u256
    ) -> u256;
}
```

## YT Price Derivation

The YT price isn't set directly - it's **derived from the PT price** in the AMM.

### The Fundamental Invariant

```
PT + YT = SY  (always, by construction)
```

Since 1 PT + 1 YT can always be redeemed for 1 SY:

```
YT_price = SY_price - PT_price
         = 1 - PT_price  (since SY_price = 1 by definition)
```

### PT Price Determines Everything

The AMM trades **PT/SY**. The PT price reflects the market's expectation of yield:

```
PT trades at DISCOUNT before expiry
  → because PT only gives you principal (no yield rights)
  → the discount = expected yield until maturity

At expiry: PT_price → 1.0 (converges to par)
```

### Implied Yield Calculation

From the PT price, we calculate the **implied APY**:

```cairo
// Simple approximation (for short periods)
implied_yield = (1 - pt_price) / pt_price / time_to_expiry_years

// More accurate (continuous compounding)
implied_apy = (1 / pt_price) ^ (1 / time_to_expiry_years) - 1
```

### Example Calculation

```
Given:
  - PT price: 0.95 SY
  - Time to expiry: 1 year

YT price = 1 - 0.95 = 0.05 SY

Implied APY = (1 / 0.95) ^ (1/1) - 1
            = 1.0526 - 1
            = 5.26%

So 100 YT ≈ 5 SY (capturing ~5% expected yield on 100 underlying)
```

### With Different Time to Expiry

```
Same PT price (0.95), but only 6 months to expiry:

Implied APY = (1 / 0.95) ^ (1/0.5) - 1
            = (1.0526) ^ 2 - 1
            = 10.8%

The shorter the time, the higher the implied rate for the same discount.
```

### Who Sets the PT Price?

**Market participants** through trading:

```
Buyer thinks yield will be HIGH → buys YT → sells PT → PT price drops
Buyer thinks yield will be LOW  → buys PT → sells YT → PT price rises

Supply/Demand on the AMM establishes equilibrium price
```

### The AMM Curve

The Market uses a time-weighted curve that:

1. **Incorporates time-to-expiry** - Rate scalar changes as expiry approaches
2. **Concentrates liquidity** - Around expected yield rates
3. **Converges PT to 1** - As expiry approaches, curve pushes PT → par

```cairo
// From market_math.cairo
fn get_rate_scalar(scalar_root: u256, time_to_expiry: u256) -> u256 {
    // Scalar increases as expiry approaches, reducing price impact
    // This helps PT converge to 1.0 at expiry
}

fn get_exchange_rate(proportion: u256, rate_scalar: u256, rate_anchor: u256) -> u256 {
    // Uses logit-style curve for PT/SY pricing
    // ln(proportion / (1 - proportion)) * rate_scalar + rate_anchor
}
```

### Price Discovery Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    PRICE DISCOVERY FLOW                         │
└─────────────────────────────────────────────────────────────────┘

  Market Participants          AMM (PT/SY Pool)           Derived
  ─────────────────           ────────────────           ────────

  "I think yields     ──────►  PT/SY trades    ──────►   PT Price
   will be 8%"                 establish                  = 0.93
                               equilibrium
                                    │
                                    ▼
                              YT Price = 1 - PT
                                    = 0.07
                                    │
                                    ▼
                              Implied APY
                              = (1/0.93)^(1/t) - 1
                              ≈ 7.5% (if t=1yr)
```

### What Happens When User "Sells 100 YT for ~5 SY"

The flash swap executes:

```
1. User has 100 YT, wants SY
2. Router executes flash swap:
   a. Borrow 100 PT from market
   b. Combine 100 PT + 100 YT → redeem for 100 SY
   c. Sell enough SY to buy back 100 PT (costs ~95 SY at current price)
   d. User keeps the difference: ~5 SY

The 5 SY received = 100 * (1 - PT_price) = 100 * 0.05 = 5 SY
```

The "~5 SY" comes directly from the PT price established by the market, which reflects the collective expectation of ~5% yield until maturity.

## Implementation: swap_exact_sy_for_yt

```cairo
fn swap_exact_sy_for_yt(
    ref self: ContractState,
    yt: ContractAddress,
    market: ContractAddress,
    receiver: ContractAddress,
    sy_in: u256,
    min_yt_out: u256
) -> u256 {
    let yt_dispatcher = IYTDispatcher { contract_address: yt };
    let market_dispatcher = IMarketDispatcher { contract_address: market };
    let sy = yt_dispatcher.sy();
    let pt = yt_dispatcher.pt();

    // Calculate how much PT we can sell to recover our SY
    let (sy_to_mint, pt_to_sell) = calculate_swap_amounts(market, sy_in);

    // 1. Transfer SY from user
    IERC20Dispatcher { contract_address: sy }
        .transfer_from(get_caller_address(), get_contract_address(), sy_in);

    // 2. Mint PT + YT (equal amounts)
    IERC20Dispatcher { contract_address: sy }.approve(yt, sy_to_mint);
    let (pt_minted, yt_minted) = yt_dispatcher.mint_py(get_contract_address(), sy_to_mint);

    // 3. Sell PT for SY to recover capital
    IERC20Dispatcher { contract_address: pt }.approve(market, pt_minted);
    let sy_received = market_dispatcher.swap_exact_pt_for_sy(
        get_contract_address(),
        pt_minted,
        0
    );

    // 4. Transfer YT to receiver
    IERC20Dispatcher { contract_address: yt }.transfer(receiver, yt_minted);

    // 5. Return excess SY to user
    let sy_excess = sy_received - (sy_to_mint - sy_in);
    if sy_excess > 0 {
        IERC20Dispatcher { contract_address: sy }.transfer(receiver, sy_excess);
    }

    assert(yt_minted >= min_yt_out, 'Slippage exceeded');
    yt_minted
}
```

## Feature Completeness

| Feature | Status | Description |
|---------|--------|-------------|
| Deposit/Withdraw SY | Done | Wrap/unwrap underlying |
| Mint/Redeem PT+YT | Done | Split and combine |
| Trade PT ↔ SY | Done | AMM for PT |
| Trade YT ↔ SY | TODO | Flash swap pattern |
| Claim YT Interest | Done | Yield distribution |
| YT Price Discovery | Derived | From PT price |

## User Journey Summary

```
                    ┌─────────────────────────────────────┐
                    │         USER STRATEGIES              │
                    └─────────────────────────────────────┘
                                    │
        ┌───────────────────────────┼───────────────────────────┐
        ▼                           ▼                           ▼
┌───────────────┐          ┌───────────────┐          ┌───────────────┐
│  HOLD PT+YT   │          │  FIXED YIELD  │          │ LEVERAGED YLD │
│  (default)    │          │  (sell YT)    │          │  (buy YT)     │
├───────────────┤          ├───────────────┤          ├───────────────┤
│ Keep both     │          │ Sell YT →     │          │ Buy YT with   │
│ tokens, claim │          │ guaranteed    │          │ capital, get  │
│ yield via YT  │          │ fixed return  │          │ multiplied    │
│ redeem at     │          │ on PT at      │          │ yield         │
│ expiry        │          │ maturity      │          │ exposure      │
└───────────────┘          └───────────────┘          └───────────────┘
        │                           │                           │
        └───────────────────────────┼───────────────────────────┘
                                    ▼
                    ┌─────────────────────────────────────┐
                    │     All strategies use same         │
                    │     underlying yield source         │
                    │     (wstETH via oracle)             │
                    └─────────────────────────────────────┘
```
