# Implementation Plan: Horizon Protocol

This document outlines the implementation plan for Horizon, a Pendle-style yield tokenization protocol on Starknet.

---

## Phase 1: Foundation & Core Tokens

### 1.1 Project Setup & Dependencies

**Objective**: Configure the project with necessary dependencies and structure.

**Tasks**:
1. Update `Scarb.toml` to include OpenZeppelin Cairo contracts
2. Create directory structure:
   - `src/interfaces/`
   - `src/tokens/`
   - `src/market/`
   - `src/libraries/`
   - `src/mocks/`
3. Set up `lib.cairo` with module declarations
4. Create error constants library (`src/libraries/errors.cairo`)

**Files to create/modify**:
- `Scarb.toml` - add openzeppelin dependency
- `src/lib.cairo` - module structure
- `src/libraries/errors.cairo` - error codes

---

### 1.2 Math Utilities

**Objective**: Implement fixed-point math for accurate yield calculations.

**Tasks**:
1. Create math library with WAD (10^18) precision
2. Implement core operations:
   - `wad_mul(a, b)` - multiply with WAD precision
   - `wad_div(a, b)` - divide with WAD precision
   - `exp_wad(x)` - exponential function (for APY calculations)
   - `ln_wad(x)` - natural logarithm (for implied yield)
   - `pow_wad(base, exp)` - power function
3. Add overflow/underflow protections
4. Write comprehensive tests for edge cases

**Files**:
- `src/libraries/math.cairo`
- `tests/test_math.cairo`

**Key formulas to support**:
```
implied_apy = e^(ln_implied_yield) - 1
exchange_rate_growth = (rate_new / rate_old)^(365/days) - 1
```

---

### 1.3 Standardized Yield (SY) Interface & Base

**Objective**: Create the standardized wrapper for yield-bearing tokens.

**Interface definition**:
```cairo
#[starknet::interface]
trait ISY<TContractState> {
    // ERC20 standard functions
    fn name(self: @TContractState) -> ByteArray;
    fn symbol(self: @TContractState) -> ByteArray;
    fn decimals(self: @TContractState) -> u8;
    fn total_supply(self: @TContractState) -> u256;
    fn balance_of(self: @TContractState, account: ContractAddress) -> u256;
    fn allowance(self: @TContractState, owner: ContractAddress, spender: ContractAddress) -> u256;
    fn transfer(ref self: TContractState, recipient: ContractAddress, amount: u256) -> bool;
    fn transfer_from(ref self: TContractState, sender: ContractAddress, recipient: ContractAddress, amount: u256) -> bool;
    fn approve(ref self: TContractState, spender: ContractAddress, amount: u256) -> bool;

    // SY-specific functions
    fn deposit(ref self: TContractState, receiver: ContractAddress, amount_token_to_deposit: u256) -> u256;
    fn redeem(ref self: TContractState, receiver: ContractAddress, amount_sy_to_redeem: u256) -> u256;
    fn exchange_rate(self: @TContractState) -> u256;
    fn underlying_asset(self: @TContractState) -> ContractAddress;
    fn get_tokens_in(self: @TContractState) -> Array<ContractAddress>;
    fn get_tokens_out(self: @TContractState) -> Array<ContractAddress>;
}
```

**Tasks**:
1. Create `ISY` interface in `src/interfaces/i_sy.cairo`
2. Implement base SY contract with:
   - ERC20 functionality (using OpenZeppelin)
   - Deposit: underlying → SY
   - Redeem: SY → underlying
   - Exchange rate tracking
3. Create mock yield-bearing token for testing
4. Write tests for deposit/redeem flows

**Files**:
- `src/interfaces/i_sy.cairo`
- `src/tokens/sy.cairo`
- `src/mocks/mock_yield_token.cairo`
- `tests/test_sy.cairo`

---

### 1.4 Principal Token (PT)

**Objective**: Implement the principal token that represents the principal portion.

**Interface definition**:
```cairo
#[starknet::interface]
trait IPT<TContractState> {
    // ERC20 functions
    fn name(self: @TContractState) -> ByteArray;
    fn symbol(self: @TContractState) -> ByteArray;
    fn decimals(self: @TContractState) -> u8;
    fn total_supply(self: @TContractState) -> u256;
    fn balance_of(self: @TContractState, account: ContractAddress) -> u256;
    fn transfer(ref self: TContractState, recipient: ContractAddress, amount: u256) -> bool;
    fn transfer_from(ref self: TContractState, sender: ContractAddress, recipient: ContractAddress, amount: u256) -> bool;
    fn approve(ref self: TContractState, spender: ContractAddress, amount: u256) -> bool;
    fn allowance(self: @TContractState, owner: ContractAddress, spender: ContractAddress) -> u256;

    // PT-specific
    fn sy(self: @TContractState) -> ContractAddress;
    fn yt(self: @TContractState) -> ContractAddress;
    fn expiry(self: @TContractState) -> u64;
    fn is_expired(self: @TContractState) -> bool;
}
```

**Tasks**:
1. Create `IPT` interface
2. Implement PT contract:
   - ERC20 base (mintable by YT contract only)
   - Link to SY and YT addresses
   - Expiry timestamp
   - `is_expired()` check
3. Only YT contract can mint/burn PT

**Files**:
- `src/interfaces/i_pt.cairo`
- `src/tokens/pt.cairo`

---

### 1.5 Yield Token (YT) with Minting/Redemption

**Objective**: Implement the yield token and the core minting/redemption logic.

**Interface definition**:
```cairo
#[starknet::interface]
trait IYT<TContractState> {
    // ERC20 functions
    fn name(self: @TContractState) -> ByteArray;
    fn symbol(self: @TContractState) -> ByteArray;
    fn decimals(self: @TContractState) -> u8;
    fn total_supply(self: @TContractState) -> u256;
    fn balance_of(self: @TContractState, account: ContractAddress) -> u256;
    fn transfer(ref self: TContractState, recipient: ContractAddress, amount: u256) -> bool;
    fn transfer_from(ref self: TContractState, sender: ContractAddress, recipient: ContractAddress, amount: u256) -> bool;
    fn approve(ref self: TContractState, spender: ContractAddress, amount: u256) -> bool;
    fn allowance(self: @TContractState, owner: ContractAddress, spender: ContractAddress) -> u256;

    // YT-specific
    fn sy(self: @TContractState) -> ContractAddress;
    fn pt(self: @TContractState) -> ContractAddress;
    fn expiry(self: @TContractState) -> u64;
    fn is_expired(self: @TContractState) -> bool;

    // Core operations
    fn mint_py(ref self: TContractState, receiver: ContractAddress, amount_sy_to_mint: u256) -> (u256, u256);
    fn redeem_py(ref self: TContractState, receiver: ContractAddress, amount_py_to_redeem: u256) -> u256;
    fn redeem_py_post_expiry(ref self: TContractState, receiver: ContractAddress, amount_pt: u256) -> u256;

    // Yield tracking
    fn py_index_current(self: @TContractState) -> u256;
    fn py_index_stored(self: @TContractState) -> u256;

    // Yield claiming
    fn redeem_due_interest(ref self: TContractState, user: ContractAddress) -> u256;
    fn get_user_interest(self: @TContractState, user: ContractAddress) -> u256;
}
```

**Core Logic**:

```
Minting (SY → PT + YT):
1. User deposits SY into YT contract
2. Calculate: amount_py = sy_amount * py_index
3. Mint equal amounts of PT and YT to user
4. Store user's entry index for yield calculation

Redemption Pre-Expiry (PT + YT → SY):
1. Burn equal amounts of PT and YT
2. Calculate: sy_amount = py_amount / py_index
3. Transfer SY to user

Redemption Post-Expiry (PT → SY):
1. Only PT required (YT is worthless)
2. Calculate: sy_amount = pt_amount / py_index
3. Transfer SY to user

Yield Claiming:
1. Track user's last claimed index
2. interest = yt_balance * (current_index - user_index) / user_index
3. Distribute yield as SY
```

**Tasks**:
1. Create `IYT` interface
2. Implement YT contract with:
   - ERC20 base
   - `mint_py()` - deposit SY, mint PT+YT
   - `redeem_py()` - burn PT+YT, return SY
   - `redeem_py_post_expiry()` - burn PT only after expiry
   - PY index tracking (monotonically non-decreasing)
   - User interest tracking via index snapshots
   - `redeem_due_interest()` - claim accrued yield
3. Deploy pattern: YT deploys PT in constructor

**Files**:
- `src/interfaces/i_yt.cairo`
- `src/tokens/yt.cairo`
- `tests/test_pt_yt.cairo`

---

### 1.6 Factory Contract

**Objective**: Create a factory for deploying new PT/YT pairs.

**Interface**:
```cairo
#[starknet::interface]
trait IFactory<TContractState> {
    fn create_yield_contracts(
        ref self: TContractState,
        sy: ContractAddress,
        expiry: u64
    ) -> (ContractAddress, ContractAddress);  // Returns (PT, YT)

    fn get_pt(self: @TContractState, sy: ContractAddress, expiry: u64) -> ContractAddress;
    fn get_yt(self: @TContractState, sy: ContractAddress, expiry: u64) -> ContractAddress;
    fn is_valid_pt(self: @TContractState, pt: ContractAddress) -> bool;
    fn is_valid_yt(self: @TContractState, yt: ContractAddress) -> bool;
}
```

**Tasks**:
1. Implement factory with `deploy_syscall` for PT/YT creation
2. Registry mapping: `(SY, expiry) → (PT, YT)`
3. Validation functions for authenticity checks

**Files**:
- `src/interfaces/i_factory.cairo`
- `src/factory.cairo`
- `tests/test_factory.cairo`

---

## Phase 2: AMM Market

### 2.1 Market Math Library

**Objective**: Implement the time-aware AMM curve mathematics.

**Key Concepts**:
- The AMM trades PT against SY
- PT price naturally converges to 1 as expiry approaches
- Uses a modified curve that accounts for time decay

**Core Formulas**:

```
// Implied rate from PT price
ln_implied_rate = ln(1/pt_price) / time_to_expiry

// PT price from implied rate
pt_price = e^(-ln_implied_rate * time_to_expiry)

// Exchange rate (proportion)
proportion = pt_reserves / (pt_reserves + sy_reserves)

// Rate anchor adjustment over time
rate_anchor = initial_anchor + rate_scalar * (1 - time_to_expiry/initial_time_to_expiry)
```

**Tasks**:
1. Implement curve math functions:
   - `get_market_exchange_rate()`
   - `calc_trade(amount_in, reserves, time_to_expiry)`
   - `get_ln_implied_rate()`
   - `calc_proportional_value()`
2. Implement fee calculations
3. Add slippage protection helpers

**Files**:
- `src/market/market_math.cairo`
- `tests/test_market_math.cairo`

---

### 2.2 Market Contract

**Objective**: Implement the AMM pool for PT/SY trading.

**Interface**:
```cairo
#[starknet::interface]
trait IMarket<TContractState> {
    // Pool info
    fn sy(self: @TContractState) -> ContractAddress;
    fn pt(self: @TContractState) -> ContractAddress;
    fn yt(self: @TContractState) -> ContractAddress;
    fn expiry(self: @TContractState) -> u64;
    fn is_expired(self: @TContractState) -> bool;

    // Reserves
    fn get_reserves(self: @TContractState) -> (u256, u256);  // (sy_reserve, pt_reserve)
    fn total_supply(self: @TContractState) -> u256;  // LP token supply

    // LP operations
    fn mint(
        ref self: TContractState,
        receiver: ContractAddress,
        sy_desired: u256,
        pt_desired: u256
    ) -> (u256, u256, u256);  // (sy_used, pt_used, lp_minted)

    fn burn(
        ref self: TContractState,
        receiver: ContractAddress,
        lp_to_burn: u256
    ) -> (u256, u256);  // (sy_out, pt_out)

    // Swaps
    fn swap_exact_pt_for_sy(
        ref self: TContractState,
        receiver: ContractAddress,
        exact_pt_in: u256,
        min_sy_out: u256
    ) -> u256;

    fn swap_sy_for_exact_pt(
        ref self: TContractState,
        receiver: ContractAddress,
        exact_pt_out: u256,
        max_sy_in: u256
    ) -> u256;

    fn swap_exact_sy_for_pt(
        ref self: TContractState,
        receiver: ContractAddress,
        exact_sy_in: u256,
        min_pt_out: u256
    ) -> u256;

    fn swap_pt_for_exact_sy(
        ref self: TContractState,
        receiver: ContractAddress,
        exact_sy_out: u256,
        max_pt_in: u256
    ) -> u256;

    // Market state
    fn read_state(self: @TContractState) -> MarketState;
    fn get_ln_implied_rate(self: @TContractState) -> u256;
}
```

**Tasks**:
1. Implement Market contract:
   - LP token (ERC20) for liquidity providers
   - `mint()` - add liquidity, receive LP tokens
   - `burn()` - remove liquidity, receive PT + SY
   - All four swap variants
   - Market parameters: scalar_root, initial_anchor, fee_rate
2. Implement fee collection (stored in contract)
3. Add events for all operations

**Files**:
- `src/interfaces/i_market.cairo`
- `src/market/market.cairo`
- `tests/test_market.cairo`

---

### 2.3 Market Factory

**Objective**: Factory for deploying markets.

**Interface**:
```cairo
#[starknet::interface]
trait IMarketFactory<TContractState> {
    fn create_market(
        ref self: TContractState,
        pt: ContractAddress,
        scalar_root: u256,
        initial_anchor: u256,
        fee_rate_root: u256
    ) -> ContractAddress;

    fn get_market(self: @TContractState, pt: ContractAddress) -> ContractAddress;
    fn is_valid_market(self: @TContractState, market: ContractAddress) -> bool;
}
```

**Tasks**:
1. Implement market factory
2. Store market registry
3. Set reasonable default parameters

**Files**:
- `src/market/market_factory.cairo`
- `tests/test_market_factory.cairo`

---

## Phase 3: Integration & Router

### 3.1 Router Contract

**Objective**: User-friendly entry point aggregating all operations.

**Interface**:
```cairo
#[starknet::interface]
trait IRouter<TContractState> {
    // Mint/Redeem through router
    fn mint_sy_from_token(
        ref self: TContractState,
        sy: ContractAddress,
        min_sy_out: u256,
        input: TokenInput
    ) -> u256;

    fn redeem_sy_to_token(
        ref self: TContractState,
        sy: ContractAddress,
        amount_sy_in: u256,
        output: TokenOutput
    ) -> u256;

    fn mint_py_from_sy(
        ref self: TContractState,
        yt: ContractAddress,
        receiver: ContractAddress,
        amount_sy_in: u256
    ) -> (u256, u256);

    fn mint_py_from_token(
        ref self: TContractState,
        yt: ContractAddress,
        min_py_out: u256,
        input: TokenInput
    ) -> (u256, u256);

    fn redeem_py_to_sy(
        ref self: TContractState,
        yt: ContractAddress,
        receiver: ContractAddress,
        amount_py_in: u256
    ) -> u256;

    fn redeem_py_to_token(
        ref self: TContractState,
        yt: ContractAddress,
        amount_py_in: u256,
        output: TokenOutput
    ) -> u256;

    // Market operations through router
    fn add_liquidity(
        ref self: TContractState,
        market: ContractAddress,
        receiver: ContractAddress,
        sy_desired: u256,
        pt_desired: u256,
        min_lp_out: u256
    ) -> (u256, u256, u256);

    fn remove_liquidity(
        ref self: TContractState,
        market: ContractAddress,
        receiver: ContractAddress,
        lp_to_burn: u256,
        min_sy_out: u256,
        min_pt_out: u256
    ) -> (u256, u256);

    fn swap_exact_token_for_pt(
        ref self: TContractState,
        market: ContractAddress,
        min_pt_out: u256,
        input: TokenInput
    ) -> u256;

    fn swap_exact_pt_for_token(
        ref self: TContractState,
        market: ContractAddress,
        exact_pt_in: u256,
        output: TokenOutput
    ) -> u256;
}
```

**Tasks**:
1. Implement router with approval handling
2. Add slippage protection on all operations
3. Add deadline parameter for time-sensitive operations
4. Implement multi-hop swaps (token → SY → PT in one tx)

**Files**:
- `src/interfaces/i_router.cairo`
- `src/router.cairo`
- `tests/test_router.cairo`

---

### 3.2 Integration Tests

**Objective**: End-to-end tests for complete user flows.

**Test Scenarios**:

1. **Basic Yield Tokenization Flow**:
   - Deploy mock yield token + SY
   - Deposit underlying → get SY
   - Mint PT + YT from SY
   - Simulate yield accrual (exchange rate increase)
   - Claim yield as YT holder
   - Redeem PT + YT back to SY

2. **Market Trading Flow**:
   - Create market for PT/SY
   - Add liquidity
   - Swap PT ↔ SY
   - Check implied rate changes
   - Remove liquidity

3. **Expiry Behavior**:
   - Fast forward to expiry
   - Verify YT becomes worthless
   - Redeem PT-only post-expiry
   - Verify PT redeems for correct amount

4. **Edge Cases**:
   - Zero amounts
   - Max amounts
   - Exactly at expiry timestamp
   - Multiple users interacting

**Files**:
- `tests/integration/test_full_flow.cairo`
- `tests/integration/test_market_flow.cairo`
- `tests/integration/test_expiry.cairo`

---

## Phase 4: Advanced Features (Future)

### 4.1 Flash Swaps for YT Trading

**Objective**: Enable YT trading through the PT/SY pool.

**Mechanism**:
```
Buy YT:
1. Borrow SY from pool
2. Mint PT + YT
3. Sell PT back to pool
4. User receives YT, pays SY difference

Sell YT:
1. Borrow PT from pool
2. Burn PT + YT → SY
3. Sell SY for PT to repay
4. User receives SY difference
```

**Tasks**:
- Add flash loan callback interface
- Implement flash swap logic in market
- Add YT swap functions to router

---

### 4.2 Oracle Integration

**Objective**: TWAP oracle for manipulation-resistant pricing.

**Tasks**:
- Track cumulative ln_implied_rate
- Implement observation array (similar to Uniswap V3)
- Add TWAP query functions
- LP token pricing oracle

---

### 4.3 Reward Distribution

**Objective**: Distribute external rewards to YT holders.

**Tasks**:
- Track reward tokens per SY
- Implement reward index tracking
- Add claim functions for reward tokens
- Handle multiple reward token types

---

### 4.4 vePENDLE Equivalent (Governance)

**Objective**: Vote-escrowed token for governance and fee sharing.

**Tasks**:
- Lock mechanism with time decay
- Voting controller for market incentives
- Fee distribution to voters
- LP reward boost based on ve balance

---

## Implementation Order Summary

```
Week 1-2: Phase 1.1 - 1.3 (Setup, Math, SY)
Week 3-4: Phase 1.4 - 1.6 (PT, YT, Factory)
Week 5-6: Phase 2.1 - 2.2 (Market Math, Market Contract)
Week 7:   Phase 2.3, 3.1 (Market Factory, Router)
Week 8:   Phase 3.2 (Integration Tests, Bug Fixes)
```

---

## Testing Strategy

### Unit Tests
- Every public function must have tests
- Test edge cases: zero, max, overflow
- Test access control
- Test event emissions

### Integration Tests
- Full user journey tests
- Multi-user interaction tests
- Time-based behavior (expiry)

### Fuzzing
- Use snforge fuzzing for math functions
- Random input testing for swaps

### Fork Testing (Future)
- Test against real yield-bearing tokens on testnet

---

## Security Considerations

1. **Reentrancy**: Use checks-effects-interactions pattern
2. **Integer Overflow**: Cairo handles this natively, but verify math
3. **Access Control**: Only YT can mint/burn PT
4. **Oracle Manipulation**: Use TWAP for pricing
5. **Rounding**: Always round in protocol's favor
6. **Time Manipulation**: Use block timestamp carefully
7. **Flash Loan Attacks**: Ensure atomic operations are safe

---

## Open Questions / Decisions

1. **Accounting Asset**: Should PT always redeem to a specific asset (ETH/USDC) or the underlying yield token?
   - *Recommendation*: Follow Pendle - redeem to accounting asset

2. **Fee Structure**: What fees to charge?
   - *Recommendation*: Start with 0.1% swap fee, adjustable

3. **Expiry Granularity**: Monthly? Quarterly?
   - *Recommendation*: Allow any expiry, suggest monthly

4. **LP Token**: Separate ERC20 or built into market?
   - *Recommendation*: Built into market (simpler)

5. **Negative Yield Handling**: How to handle if exchange rate drops?
   - *Recommendation*: PY index never decreases (watermark)
