1. **Phase 1 (Factory Fee Infrastructure)** - COMPLETE: Storage fields, constants, events, error constant, getter/setter functions, and tests implemented
2. **Phase 2 (Expiry Divisor)** - COMPLETE: Storage, event, getter/setter, interface, and validation in create_yield_contracts all implemented with tests
3. **Phase 3 (MarketFactory Yield Contract Factory)** - NOT IMPLEMENTED: `yield_contract_factory` does not exist in MarketFactory
4. **Phase 4 (Multi-Reward YT Integration)** - NOT IMPLEMENTED: YT does not use RewardManagerComponent
5. **Phase 5 (Router Dual Token Liquidity)** - NOT IMPLEMENTED: `add_liquidity_dual_token_and_pt`, `remove_liquidity_dual_token_and_pt`, `swap_tokens_to_tokens` do not exist
6. **Phase 6 (YT Flash Mint)** - NOT IMPLEMENTED: `i_flash_callback.cairo` does not exist, no flash mint functions
7. **Phase 7 (VERSION Constants)** - NOT IMPLEMENTED: No VERSION constants exist in any contracts

---

## Phase 1: Factory Fee Infrastructure **COMPLETE**

Add reward and interest fee rate storage and management to Factory contract.

### Phase Validation
```bash
cd contracts && scarb build && snforge test test_factory
```

### Step 1: Add factory fee rate storage fields **COMPLETE**

#### Goal
Add `reward_fee_rate: u256` and `default_interest_fee_rate: u256` storage variables to Factory contract with proper placement after existing storage fields.

#### Files
- `contracts/src/factory.cairo` - Add `reward_fee_rate: u256` and `default_interest_fee_rate: u256` storage fields after line 76 (treasury)

#### Validation
```bash
cd contracts && scarb build 2>&1 | grep -E "(error|warning)" | head -20 || echo "Build OK"
```

#### Failure modes
- Storage layout change may affect upgrades if deployed contracts exist
- Missing import for u256 if not already present

---

### Step 2: Add factory fee rate constants **COMPLETE**

#### Goal
Define `MAX_REWARD_FEE_RATE` (20% = 0.2e18) and `MAX_INTEREST_FEE_RATE` (50% = 0.5e18) constants for validation.

#### Files
- `contracts/src/factory.cairo` - Add constants after imports, before component declarations (before line 30)

#### Validation
```bash
grep -q "MAX_REWARD_FEE_RATE" contracts/src/factory.cairo && echo "OK"
```

#### Failure modes
- Constant name conflicts with existing definitions

---

### Step 3: Add factory fee rate events **COMPLETE**

#### Goal
Create `RewardFeeRateSet` and `DefaultInterestFeeRateSet` events for fee rate changes.

#### Files
- `contracts/src/factory.cairo` - Add event structs after existing events (after line 133, within Event enum and as separate structs)

#### Validation
```bash
grep -q "RewardFeeRateSet" contracts/src/factory.cairo && echo "OK"
```

#### Failure modes
- Event not added to Event enum

---

### Step 4: Add factory fee rate error constant **COMPLETE**

#### Goal
Add `FACTORY_INVALID_FEE_RATE` error constant for fee validation failures.

#### Files
- `contracts/src/libraries/errors.cairo` - Add error after line 81 (FACTORY_DEPLOY_FAILED)

#### Validation
```bash
grep -q "FACTORY_INVALID_FEE_RATE" contracts/src/libraries/errors.cairo && echo "OK"
```

#### Failure modes
- Error message exceeds felt252 length limit (31 chars)

---

### Step 5: Implement set_reward_fee_rate admin function **COMPLETE**

#### Goal
Add `set_reward_fee_rate(rate: u256)` owner-only function that validates rate <= MAX_REWARD_FEE_RATE and emits event.

#### Files
- `contracts/src/factory.cairo` - Add function in FactoryImpl after `set_treasury` (after line 461)

#### Validation
```bash
cd contracts && scarb build 2>&1 | grep -E "(error)" | head -10 || echo "Build OK"
```

#### Failure modes
- Missing owner assertion
- Incorrect event emission

---

### Step 6: Implement get_reward_fee_rate view function **COMPLETE**

#### Goal
Add `get_reward_fee_rate() -> u256` view function to read current reward fee rate.

#### Files
- `contracts/src/factory.cairo` - Add function after `set_reward_fee_rate`

#### Validation
```bash
cd contracts && scarb build 2>&1 | grep -E "(error)" | head -10 || echo "Build OK"
```

#### Failure modes
- None expected

---

### Step 7: Implement set_default_interest_fee_rate admin function **COMPLETE**

#### Goal
Add `set_default_interest_fee_rate(rate: u256)` owner-only function that validates rate <= MAX_INTEREST_FEE_RATE and emits event.

#### Files
- `contracts/src/factory.cairo` - Add function after `get_reward_fee_rate`

#### Validation
```bash
cd contracts && scarb build 2>&1 | grep -E "(error)" | head -10 || echo "Build OK"
```

#### Failure modes
- Missing owner assertion
- Incorrect max validation

---

### Step 8: Implement get_default_interest_fee_rate view function **COMPLETE**

#### Goal
Add `get_default_interest_fee_rate() -> u256` view function to read default interest fee rate.

#### Files
- `contracts/src/factory.cairo` - Add function after `set_default_interest_fee_rate`

#### Validation
```bash
cd contracts && scarb build 2>&1 | grep -E "(error)" | head -10 || echo "Build OK"
```

#### Failure modes
- None expected

---

### Step 9: Update IFactory interface with fee functions **COMPLETE**

#### Goal
Add `set_reward_fee_rate`, `get_reward_fee_rate`, `set_default_interest_fee_rate`, `get_default_interest_fee_rate` to IFactory trait.

#### Files
- `contracts/src/interfaces/i_factory.cairo` - Add 4 function signatures after `set_treasury` (after line 74)

#### Validation
```bash
cd contracts && scarb build 2>&1 | grep -E "(error)" | head -10 || echo "Build OK"
```

#### Failure modes
- Signature mismatch with implementation

---

### Step 10: Add factory fee rate unit tests **COMPLETE**

#### Goal
Create tests for reward and interest fee rate setter/getter functions with validation edge cases.

#### Files
- `contracts/tests/test_factory.cairo` - Add test functions for fee rate management

#### Validation
```bash
cd contracts && snforge test test_factory_fee_rate
```

#### Failure modes
- Test setup missing required mocks
- Incorrect expected values

---

## Phase 2: Factory Expiry Divisor

Add expiry standardization to concentrate liquidity at fixed intervals.

### Phase Validation
```bash
cd contracts && scarb build && snforge test test_factory
```

### Step 1: Add expiry_divisor storage field **COMPLETE**

#### Goal
Add `expiry_divisor: u64` storage field to Factory for expiry validation (0 = disabled).

#### Files
- `contracts/src/factory.cairo` - Add storage field after `default_interest_fee_rate` (after the new fee storage fields added in Phase 1)

#### Validation
```bash
cd contracts && scarb build 2>&1 | grep -E "(error)" | head -10 || echo "Build OK"
```

#### Failure modes
- Storage layout conflicts

---

### Step 2: Add expiry divisor error constant **COMPLETE**

#### Goal
Add `FACTORY_INVALID_EXPIRY_DIVISOR` error for expiry validation failures.

#### Files
- `contracts/src/libraries/errors.cairo` - Add error after `FACTORY_INVALID_FEE_RATE` (after the error added in Phase 1)

#### Validation
```bash
grep -q "FACTORY_INVALID_EXPIRY_DIVISOR" contracts/src/libraries/errors.cairo && echo "OK"
```

#### Failure modes
- Error message length exceeds limit

---

### Step 3: Add expiry divisor event **COMPLETE**

#### Goal
Create `ExpiryDivisorSet` event for expiry divisor changes.

#### Files
- `contracts/src/factory.cairo` - Add event struct after fee rate events

#### Validation
```bash
grep -q "ExpiryDivisorSet" contracts/src/factory.cairo && echo "OK"
```

#### Failure modes
- Event not registered in enum

---

### Step 4: Add expiry validation to create_yield_contracts **COMPLETE**

#### Goal
Modify `create_yield_contracts` to validate `expiry % divisor == 0` when divisor > 0.

#### Files
- `contracts/src/factory.cairo` - Add validation after existing expiry check (around line 183, after the "expiry must be in the future" check)

#### Validation
```bash
cd contracts && scarb build 2>&1 | grep -E "(error)" | head -10 || echo "Build OK"
```

#### Failure modes
- Modulo operation on u64 types
- Zero divisor handling

---

### Step 5: Implement set_expiry_divisor admin function **COMPLETE**

#### Goal
Add `set_expiry_divisor(divisor: u64)` owner-only function that updates divisor and emits event.

#### Files
- `contracts/src/factory.cairo` - Add function after interest fee rate functions

#### Validation
```bash
cd contracts && scarb build 2>&1 | grep -E "(error)" | head -10 || echo "Build OK"
```

#### Failure modes
- Missing owner assertion

---

### Step 6: Implement get_expiry_divisor view function **COMPLETE**

#### Goal
Add `get_expiry_divisor() -> u64` view function.

#### Files
- `contracts/src/factory.cairo` - Add function after `set_expiry_divisor`

#### Validation
```bash
cd contracts && scarb build 2>&1 | grep -E "(error)" | head -10 || echo "Build OK"
```

#### Failure modes
- None expected

---

### Step 7: Update IFactory interface with expiry divisor functions **COMPLETE**

#### Goal
Add `set_expiry_divisor(u64)` and `get_expiry_divisor() -> u64` to IFactory trait.

#### Files
- `contracts/src/interfaces/i_factory.cairo` - Add function signatures after fee functions

#### Validation
```bash
cd contracts && scarb build 2>&1 | grep -E "(error)" | head -10 || echo "Build OK"
```

#### Failure modes
- Signature mismatch

---

### Step 8: Add expiry divisor unit tests **COMPLETE**

#### Goal
Create tests for expiry divisor validation including edge cases (divisor=0, valid/invalid expiries).

#### Files
- `contracts/tests/test_factory.cairo` - Add test functions for expiry divisor

#### Validation
```bash
cd contracts && snforge test test_factory_expiry_divisor
```

#### Failure modes
- Test timestamp mocking issues

---

## Phase 3: MarketFactory Yield Contract Factory Reference

Add cross-factory validation for PT deployments.

### Phase Validation
```bash
cd contracts && scarb build && snforge test test_market_factory
```

### Step 1: Add yield_contract_factory storage field

#### Goal
Add `yield_contract_factory: ContractAddress` storage to MarketFactory for PT validation.

#### Files
- `contracts/src/market/market_factory.cairo` - Add storage field after `default_rate_impact_sensitivity` (after line 105)

#### Validation
```bash
cd contracts && scarb build 2>&1 | grep -E "(error)" | head -10 || echo "Build OK"
```

#### Failure modes
- Storage layout conflicts

---

### Step 2: Add MarketFactory invalid PT error

#### Goal
Add `MARKET_FACTORY_INVALID_PT` error constant for PT validation failures.

#### Files
- `contracts/src/libraries/errors.cairo` - Add error after `MARKET_FACTORY_OVERRIDE_TOO_HIGH` (after line 59)

#### Validation
```bash
grep -q "MARKET_FACTORY_INVALID_PT" contracts/src/libraries/errors.cairo && echo "OK"
```

#### Failure modes
- Error message length

---

### Step 3: Update MarketFactory constructor

#### Goal
Accept `yield_contract_factory: ContractAddress` parameter and store it during construction.

#### Files
- `contracts/src/market/market_factory.cairo` - Modify constructor at line 181

#### Validation
```bash
cd contracts && scarb build 2>&1 | grep -E "(error)" | head -10 || echo "Build OK"
```

#### Failure modes
- Constructor signature change breaks deployment scripts

---

### Step 4: Add PT factory validation to create_market

#### Goal
Validate that PT was deployed by linked yield contract factory using `IFactory.is_valid_pt()` (optional, can be skipped if factory is zero).

#### Files
- `contracts/src/market/market_factory.cairo` - Add validation after PT address check in `create_market` function

#### Validation
```bash
cd contracts && scarb build 2>&1 | grep -E "(error)" | head -10 || echo "Build OK"
```

#### Failure modes
- IFactory dispatcher import missing
- Zero factory address handling

---

### Step 5: Add set_yield_contract_factory admin function

#### Goal
Add `set_yield_contract_factory(factory: ContractAddress)` owner-only function for post-deployment configuration.

#### Files
- `contracts/src/market/market_factory.cairo` - Add function after `initialize_rbac`

#### Validation
```bash
cd contracts && scarb build 2>&1 | grep -E "(error)" | head -10 || echo "Build OK"
```

#### Failure modes
- Missing owner assertion

---

### Step 6: Add get_yield_contract_factory view function

#### Goal
Add `get_yield_contract_factory() -> ContractAddress` view function.

#### Files
- `contracts/src/market/market_factory.cairo` - Add after setter function

#### Validation
```bash
cd contracts && scarb build 2>&1 | grep -E "(error)" | head -10 || echo "Build OK"
```

#### Failure modes
- None expected

---

### Step 7: Update IMarketFactory interface

#### Goal
Add `set_yield_contract_factory` and `get_yield_contract_factory` to IMarketFactory trait.

#### Files
- `contracts/src/interfaces/i_market_factory.cairo` - Add function signatures after `set_default_rate_impact_sensitivity` (after line 128)

#### Validation
```bash
cd contracts && scarb build 2>&1 | grep -E "(error)" | head -10 || echo "Build OK"
```

#### Failure modes
- Signature mismatch

---

### Step 8: Update MarketFactory tests for factory reference

#### Goal
Add tests for yield contract factory validation in market creation.

#### Files
- `contracts/tests/market/test_market_factory.cairo` - Add validation tests

#### Validation
```bash
cd contracts && snforge test test_market_factory_yield_factory
```

#### Failure modes
- Factory mock setup issues

---

## Phase 4: Multi-Reward YT Integration

Integrate RewardManagerComponent into YT for multi-token reward tracking.

### Phase Validation
```bash
cd contracts && scarb build && snforge test test_yt
```

### Step 1: Add RewardManagerComponent to YT contract

#### Goal
Import and declare `RewardManagerComponent` in YT contract similar to Market's usage at amm.cairo:76.

#### Files
- `contracts/src/tokens/yt.cairo` - Add component declaration after ReentrancyGuardComponent (after line 44, in the component declarations section)

#### Validation
```bash
cd contracts && scarb build 2>&1 | grep -E "(error)" | head -10 || echo "Build OK"
```

#### Failure modes
- Import path incorrect
- Component macro syntax

---

### Step 2: Add reward_manager storage to YT

#### Goal
Add `reward_manager: RewardManagerComponent::Storage` substorage to YT Storage struct.

#### Files
- `contracts/src/tokens/yt.cairo` - Add substorage after line 103 (decimals field)

#### Validation
```bash
cd contracts && scarb build 2>&1 | grep -E "(error)" | head -10 || echo "Build OK"
```

#### Failure modes
- Storage layout affects upgrades

---

### Step 3: Add RewardManagerEvent to YT Event enum

#### Goal
Register RewardManagerComponent events in YT's Event enum for proper emission.

#### Files
- `contracts/src/tokens/yt.cairo` - Add `RewardManagerEvent: RewardManagerComponent::Event` to Event enum (within lines 106-133)

#### Validation
```bash
cd contracts && scarb build 2>&1 | grep -E "(error)" | head -10 || echo "Build OK"
```

#### Failure modes
- Flat vs non-flat event configuration

---

### Step 4: Implement RewardHooksTrait for YT

#### Goal
Implement `user_sy_balance` and `total_sy_supply` hooks using YT balance (not SY balance) since rewards distribute to YT holders.

#### Files
- `contracts/src/tokens/yt.cairo` - Add impl block after existing component impls (after line 44)

#### Validation
```bash
cd contracts && scarb build 2>&1 | grep -E "(error)" | head -10 || echo "Build OK"
```

#### Failure modes
- Hook returns wrong balance type (should use YT balance, not SY)

---

### Step 5: Update YT constructor for reward tokens

#### Goal
Accept `reward_tokens: Span<ContractAddress>` parameter and initialize RewardManagerComponent if non-empty.

#### Files
- `contracts/src/tokens/yt.cairo` - Modify constructor at line 322

#### Validation
```bash
cd contracts && scarb build 2>&1 | grep -E "(error)" | head -10 || echo "Build OK"
```

#### Failure modes
- Constructor calldata serialization in Factory

---

### Step 6: Hook reward updates into YT transfers

#### Goal
Call `reward_manager.update_rewards_for_two(from, to)` in YT's ERC20 transfer hook before balance changes.

#### Files
- `contracts/src/tokens/yt.cairo` - Add ERC20 hooks implementation (YT currently uses ERC20HooksEmptyImpl implicitly, need to implement custom hooks)

#### Validation
```bash
cd contracts && scarb build 2>&1 | grep -E "(error)" | head -10 || echo "Build OK"
```

#### Failure modes
- Hook called after transfer instead of before
- Missing edge cases (mint/burn)

---

### Step 7: Hook reward updates into _update_user_interest

#### Goal
Call `reward_manager.update_user_rewards(user)` in `_update_user_interest` (line 1556) to sync reward accounting with interest.

#### Files
- `contracts/src/tokens/yt.cairo` - Add call at start of `_update_user_interest`

#### Validation
```bash
cd contracts && scarb build 2>&1 | grep -E "(error)" | head -10 || echo "Build OK"
```

#### Failure modes
- Reward update timing relative to balance change

---

### Step 8: Implement claim_rewards in YT

#### Goal
Add `claim_rewards(user: ContractAddress) -> Span<u256>` that forwards to RewardManagerComponent.

#### Files
- `contracts/src/tokens/yt.cairo` - Add function in IYT implementation

#### Validation
```bash
cd contracts && scarb build 2>&1 | grep -E "(error)" | head -10 || echo "Build OK"
```

#### Failure modes
- None expected

---

### Step 9: Implement get_reward_tokens in YT

#### Goal
Add `get_reward_tokens() -> Span<ContractAddress>` view function that forwards to component.

#### Files
- `contracts/src/tokens/yt.cairo` - Add function in IYT implementation

#### Validation
```bash
cd contracts && scarb build 2>&1 | grep -E "(error)" | head -10 || echo "Build OK"
```

#### Failure modes
- None expected

---

### Step 10: Implement redeem_due_interest_and_rewards in YT

#### Goal
Add combined `redeem_due_interest_and_rewards(user, do_interest, do_rewards) -> (u256, Span<u256>)` for atomic claims.

#### Files
- `contracts/src/tokens/yt.cairo` - Add function in IYT implementation

#### Validation
```bash
cd contracts && scarb build 2>&1 | grep -E "(error)" | head -10 || echo "Build OK"
```

#### Failure modes
- Incorrect return tuple handling

---

### Step 11: Update IYT interface with reward functions

#### Goal
Add `get_reward_tokens`, `claim_rewards`, `redeem_due_interest_and_rewards`, and `accrued_rewards` to IYT trait.

#### Files
- `contracts/src/interfaces/i_yt.cairo` - Add function signatures after `interest_fee_rate` (after line 98)

#### Validation
```bash
cd contracts && scarb build 2>&1 | grep -E "(error)" | head -10 || echo "Build OK"
```

#### Failure modes
- Signature mismatch with implementation

---

### Step 12: Update Factory YT deployment for reward tokens

#### Goal
Modify Factory's `create_yield_contracts` to optionally accept reward tokens and pass to YT constructor.

#### Files
- `contracts/src/factory.cairo` - Update `create_yield_contracts` signature and calldata building (within lines 173-278)

#### Validation
```bash
cd contracts && scarb build 2>&1 | grep -E "(error)" | head -10 || echo "Build OK"
```

#### Failure modes
- Calldata serialization order
- Backward compatibility with existing callers

---

### Step 13: Update IFactory interface for reward tokens

#### Goal
Add optional reward_tokens parameter to `create_yield_contracts` signature.

#### Files
- `contracts/src/interfaces/i_factory.cairo` - Update function signature at line 6

#### Validation
```bash
cd contracts && scarb build 2>&1 | grep -E "(error)" | head -10 || echo "Build OK"
```

#### Failure modes
- Breaking change for existing callers

---

### Step 14: Add YT reward manager unit tests

#### Goal
Create comprehensive tests for YT reward tracking: initialization, accrual on transfer, claim, combined interest+rewards.

#### Files
- `contracts/tests/test_yt_rewards.cairo` - New test file (note: tests are in `contracts/tests/tokens/` directory)

#### Validation
```bash
cd contracts && snforge test test_yt_rewards
```

#### Failure modes
- Mock reward token setup
- Transfer timing for reward accrual

---

## Phase 5: Router Dual Token Liquidity Operations

Add mixed deposit/withdrawal operations for advanced liquidity provision.

### Phase Validation
```bash
cd contracts && scarb build && snforge test test_router
```

### Step 1: Add add_liquidity_dual_token_and_pt function signature to IRouter

#### Goal
Add `add_liquidity_dual_token_and_pt(market, receiver, input, pt_amount, min_lp_out, deadline) -> u256` to IRouter.

#### Files
- `contracts/src/interfaces/i_router.cairo` - Add function after `add_liquidity_single_token_keep_yt` (aggregator liquidity section, around line 610)

#### Validation
```bash
cd contracts && scarb build 2>&1 | grep -E "(error)" | head -10 || echo "Build OK"
```

#### Failure modes
- TokenInput struct usage

---

### Step 2: Implement add_liquidity_dual_token_and_pt in Router

#### Goal
Implement: swap input token → underlying via aggregator → deposit to SY → call market.mint with SY + provided PT.

#### Files
- `contracts/src/router.cairo` - Add function after `add_liquidity_single_token_keep_yt` (after line 2256)

#### Validation
```bash
cd contracts && scarb build 2>&1 | grep -E "(error)" | head -10 || echo "Build OK"
```

#### Failure modes
- Aggregator callback handling
- PT transfer from caller
- Slippage enforcement

---

### Step 3: Add remove_liquidity_dual_token_and_pt function signature to IRouter

#### Goal
Add `remove_liquidity_dual_token_and_pt(market, receiver, lp_to_burn, output, min_pt_out, deadline) -> (u256, u256)` to IRouter.

#### Files
- `contracts/src/interfaces/i_router.cairo` - Add function after `add_liquidity_dual_token_and_pt`

#### Validation
```bash
cd contracts && scarb build 2>&1 | grep -E "(error)" | head -10 || echo "Build OK"
```

#### Failure modes
- TokenOutput struct usage

---

### Step 4: Implement remove_liquidity_dual_token_and_pt in Router

#### Goal
Implement: burn LP → receive SY + PT → convert SY portion via aggregator → return (token_out, pt_out).

#### Files
- `contracts/src/router.cairo` - Add function after interface addition

#### Validation
```bash
cd contracts && scarb build 2>&1 | grep -E "(error)" | head -10 || echo "Build OK"
```

#### Failure modes
- PT forwarding to receiver
- Aggregator swap for SY portion

---

### Step 5: Add swap_tokens_to_tokens function signature to IRouter

#### Goal
Add `swap_tokens_to_tokens(input, output, receiver, deadline) -> u256` general aggregator routing.

#### Files
- `contracts/src/interfaces/i_router.cairo` - Add function in aggregator section

#### Validation
```bash
cd contracts && scarb build 2>&1 | grep -E "(error)" | head -10 || echo "Build OK"
```

#### Failure modes
- None expected

---

### Step 6: Implement swap_tokens_to_tokens in Router

#### Goal
Implement general aggregator routing without PT/YT involvement.

#### Files
- `contracts/src/router.cairo` - Add function implementation

#### Validation
```bash
cd contracts && scarb build 2>&1 | grep -E "(error)" | head -10 || echo "Build OK"
```

#### Failure modes
- Aggregator whitelist validation if applicable

---

### Step 7: Add dual liquidity operation tests

#### Goal
Create tests for add_liquidity_dual_token_and_pt and remove_liquidity_dual_token_and_pt.

#### Files
- `contracts/tests/router/test_router_dual_liquidity.cairo` - New test file

#### Validation
```bash
cd contracts && snforge test test_router_dual_liquidity
```

#### Failure modes
- Mock aggregator setup
- Market state initialization

---

## Phase 6: YT Flash Mint

Add flash mint pattern for atomic PT+YT operations.

### Phase Validation
```bash
cd contracts && scarb build && snforge test test_yt_flash
```

### Step 1: Create IFlashCallback interface

#### Goal
Define `IFlashCallback` trait with `flash_callback(pt_amount, yt_amount, data)` function.

#### Files
- `contracts/src/interfaces/i_flash_callback.cairo` - New file

#### Validation
```bash
test -f contracts/src/interfaces/i_flash_callback.cairo && echo "OK"
```

#### Failure modes
- Module registration in lib.cairo

---

### Step 2: Register IFlashCallback in interfaces module

#### Goal
Add `pub mod i_flash_callback;` to interfaces module declaration.

#### Files
- `contracts/src/lib.cairo` - Add module declaration in the interfaces block (around line 12)

#### Validation
```bash
grep -q "i_flash_callback" contracts/src/lib.cairo && echo "OK"
```

#### Failure modes
- None expected

---

### Step 3: Add flash mint error constants

#### Goal
Add `YT_FLASH_CALLBACK_FAILED` and `YT_FLASH_REPAYMENT_FAILED` errors.

#### Files
- `contracts/src/libraries/errors.cairo` - Add after existing YT errors (after line 37)

#### Validation
```bash
grep -q "YT_FLASH" contracts/src/libraries/errors.cairo && echo "OK"
```

#### Failure modes
- Error message length

---

### Step 4: Add FlashMintPY event to YT

#### Goal
Create `FlashMintPY` event for flash mint tracking.

#### Files
- `contracts/src/tokens/yt.cairo` - Add event struct after existing events (after line 320)

#### Validation
```bash
grep -q "FlashMintPY" contracts/src/tokens/yt.cairo && echo "OK"
```

#### Failure modes
- Event not registered in enum

---

### Step 5: Implement flash_mint_py in YT

#### Goal
Add `flash_mint_py(receiver, amount_sy, data) -> (u256, u256)` that mints PT+YT, calls callback, verifies SY repayment.

#### Files
- `contracts/src/tokens/yt.cairo` - Add function in IYT implementation (within lines 394-1284)

#### Validation
```bash
cd contracts && scarb build 2>&1 | grep -E "(error)" | head -10 || echo "Build OK"
```

#### Failure modes
- Reentrancy with callback
- SY balance verification
- Interest update timing

---

### Step 6: Update IYT interface with flash_mint_py

#### Goal
Add `flash_mint_py(receiver, amount_sy, data) -> (u256, u256)` to IYT trait.

#### Files
- `contracts/src/interfaces/i_yt.cairo` - Add function signature (after line 110)

#### Validation
```bash
cd contracts && scarb build 2>&1 | grep -E "(error)" | head -10 || echo "Build OK"
```

#### Failure modes
- Signature mismatch

---

### Step 7: Add flash mint unit tests

#### Goal
Create tests for flash mint including callback verification, repayment failure, and reentrancy protection.

#### Files
- `contracts/tests/tokens/test_yt_flash.cairo` - New test file

#### Validation
```bash
cd contracts && snforge test test_yt_flash
```

#### Failure modes
- Mock callback contract setup

---

## Phase 7: Version Constants and Minor Gaps

Add VERSION constants and minor compatibility items.

### Phase Validation
```bash
cd contracts && scarb build && snforge test
```

### Step 1: Add VERSION constant to PT

#### Goal
Add `const VERSION: felt252 = 1;` to PT contract.

#### Files
- `contracts/src/tokens/pt.cairo` - Add constant after imports (after line 28, before component declarations)

#### Validation
```bash
grep -q "VERSION.*1" contracts/src/tokens/pt.cairo && echo "OK"
```

#### Failure modes
- None expected

---

### Step 2: Add VERSION constant to YT

#### Goal
Add `const VERSION: felt252 = 1;` to YT contract.

#### Files
- `contracts/src/tokens/yt.cairo` - Add constant after imports (before line 31, before component declarations)

#### Validation
```bash
grep -q "VERSION.*1" contracts/src/tokens/yt.cairo && echo "OK"
```

#### Failure modes
- None expected

---

### Step 3: Add VERSION constant to Factory

#### Goal
Add `const VERSION: felt252 = 1;` to Factory contract.

#### Files
- `contracts/src/factory.cairo` - Add constant after imports (before line 30, before component declarations)

#### Validation
```bash
grep -q "VERSION.*1" contracts/src/factory.cairo && echo "OK"
```

#### Failure modes
- None expected

---

### Step 4: Add VERSION constant to MarketFactory

#### Goal
Add `const VERSION: felt252 = 1;` to MarketFactory contract.

#### Files
- `contracts/src/market/market_factory.cairo` - Add constant after existing constants (after line 48, after MAX_LN_FEE_RATE_ROOT)

#### Validation
```bash
grep -q "VERSION.*1" contracts/src/market/market_factory.cairo && echo "OK"
```

#### Failure modes
- None expected

---

### Step 5: Add get_market_state view to Market

#### Goal
Add `get_market_state() -> MarketState` external view function exposing full state for integrations.

**Note:** Market already has internal `_get_market_state()` (line 1488), `_get_market_state_view()` (line 1514), and `_get_market_state_with_effective_fee()` (line 1542) functions. This step adds a public external wrapper.

#### Files
- `contracts/src/market/amm.cairo` - Add function in IMarket implementation

#### Validation
```bash
cd contracts && scarb build 2>&1 | grep -E "(error)" | head -10 || echo "Build OK"
```

#### Failure modes
- MarketState struct is already defined in `market_math_fp.cairo` at line 27

---

### Step 6: Update IMarket interface with get_market_state

#### Goal
Add `get_market_state() -> MarketState` to IMarket trait.

**Note:** Need to import MarketState from market_math_fp module in the interface file.

#### Files
- `contracts/src/interfaces/i_market.cairo` - Add function signature and MarketState import (after line 97)

#### Validation
```bash
cd contracts && scarb build 2>&1 | grep -E "(error)" | head -10 || echo "Build OK"
```

#### Failure modes
- Struct field order matching internal state
- Import path for MarketState

---

### Step 7: Run full test suite

#### Goal
Verify all changes pass existing test suite with no regressions.

#### Files
- None (validation only)

#### Validation
```bash
cd contracts && snforge test
```

#### Failure modes
- Existing test failures from interface changes
- Storage layout changes affecting mocks

---
