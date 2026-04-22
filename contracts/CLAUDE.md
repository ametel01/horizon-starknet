# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build Commands

```bash
scarb build                           # Build contracts
snforge test                          # Run all tests
snforge test test_market              # Run specific test file
snforge test test_market::test_name   # Run specific test function
scarb fmt                             # Format Cairo code
```

## Code Architecture

### Module Structure

```
src/
├── factory.cairo      # Deploys SY/PT/YT token sets
├── router.cairo       # User entry point for all operations
├── tokens/
│   ├── sy.cairo       # Standardized Yield wrapper (ERC20)
│   ├── pt.cairo       # Principal Token (ERC20, redeemable 1:1 at expiry)
│   └── yt.cairo       # Yield Token (ERC20, accrues interest until expiry)
├── market/
│   ├── amm.cairo           # PT/SY AMM with time-decay curve
│   ├── market_factory.cairo # Deploys AMM markets
│   ├── market_math.cairo    # WAD-based AMM pricing
│   └── market_math_fp.cairo # Fixed-point AMM pricing (cairo_fp)
├── libraries/
│   ├── math.cairo     # WAD (10^18) fixed-point math, exp, ln
│   ├── math_fp.cairo  # cairo_fp-based math utilities
│   ├── errors.cairo   # Custom error definitions
│   └── roles.cairo    # RBAC role constants
├── interfaces/        # Contract interfaces (i_*.cairo)
├── oracles/
│   └── pragma_index_oracle.cairo  # Pragma TWAP oracle for yield index
└── mocks/             # Mock contracts for testing
```

### Token Flow

```
Underlying Asset → SY (deposit) → PT + YT (mint_py)
                                       ↓
                               Market (PT/SY AMM)
```

### Key Patterns

**WAD arithmetic:** All amounts and rates use 10^18 fixed-point. Use `math.cairo` functions for multiplication/division.

**Two math implementations:** `market_math.cairo` uses WAD-based math, `market_math_fp.cairo` uses the `cairo_fp` crate. Both implement the same Pendle AMM formulas.

**Access control:** Only YT can mint/burn PT tokens. Router handles user-facing operations with slippage protection.

**Upgradeability:** All core contracts use OpenZeppelin's OwnableComponent and UpgradeableComponent.

### Token Aggregation Functions

The Router supports swapping arbitrary tokens to/from PT, YT, and LP positions via external aggregators (e.g., DEX aggregators like Fibrous, AVNU). This enables users to enter/exit positions using any token, not just SY.

**Core Data Structures:**

```cairo
// Aggregator swap configuration
struct SwapData {
    aggregator: ContractAddress,  // DEX aggregator contract
    calldata: Span<felt252>,      // Encoded swap calldata
}

// Input token to swap via aggregator
struct TokenInput {
    token: ContractAddress,       // ERC20 token address
    amount: u256,                 // Amount to swap
    swap_data: SwapData,          // Aggregator routing data
}

// Output token to receive via aggregator
struct TokenOutput {
    token: ContractAddress,       // ERC20 token address
    min_amount: u256,             // Minimum to receive (slippage)
    swap_data: SwapData,          // Aggregator routing data
}
```

**Token → PT/YT/LP Functions:**

| Function | Flow |
|----------|------|
| `swap_exact_token_for_pt` | token → aggregator → underlying → SY → market → PT |
| `swap_exact_token_for_yt` | token → aggregator → underlying → SY → mint PT+YT → sell PT → YT |
| `add_liquidity_single_token` | token → aggregator → underlying → SY → add_liquidity_single_sy → LP |
| `add_liquidity_single_token_keep_yt` | token → aggregator → underlying → SY → mint PT+YT → add liquidity → LP + YT |

**PT/YT/LP → Token Functions:**

| Function | Flow |
|----------|------|
| `swap_exact_pt_for_token` | PT → market → SY → redeem → underlying → aggregator → token |
| `swap_exact_yt_for_token` | YT + collateral → buy PT → redeem → SY → underlying → aggregator → token |
| `remove_liquidity_single_token` | LP → burn → SY+PT → swap PT→SY → redeem → underlying → aggregator → token |

### ApproxParams (Binary Search Hints)

Several router functions use binary search to calculate optimal swap amounts. `ApproxParams` allows callers to provide hints for faster convergence:

```cairo
struct ApproxParams {
    guess_min: u256,      // Lower bound (0 = use default)
    guess_max: u256,      // Upper bound (0 = use default)
    guess_offchain: u256, // Pre-computed guess (0 = no hint)
    max_iteration: u256,  // Max iterations (default: 20)
    eps: u256,            // Precision in WAD (1e15 = 0.1%)
}
```

**Functions accepting ApproxParams:**

- `swap_exact_sy_for_pt_with_approx` - Optimized SY→PT swap
- `add_liquidity_single_sy_with_approx` - Optimized single-sided LP add

**Usage pattern:**
- For on-chain calls without hints, use zero values (falls back to defaults)
- For optimized off-chain integration, pre-compute `guess_offchain` using preview functions
- `eps` of `1e15` (0.1%) is typical; lower values need more iterations

## Testing

the tests should expose smart contract bugs not be adapted to implementation to make them pass, always assume the smart contract is wrong until full investigation is completed.

Test utilities in `tests/utils.cairo` provide:
- Standard test addresses: `admin()`, `user1()`, `user2()`, `alice()`, `bob()`
- Time constants: `CURRENT_TIME`, `ONE_YEAR`, `ONE_MONTH`, `ONE_DAY`, `DEFAULT_DEADLINE`
- Setup functions: `setup_sy()`, `setup_full()`, `setup_full_with_expiry()`
- Helper functions: `mint_and_deposit_sy()`, `mint_and_mint_py()`, `mint_yield_token_to_user()`, `set_yield_index()`

### Test File Naming

Tests mirror source files: `test_sy.cairo` tests `tokens/sy.cairo`, `test_market.cairo` tests `market/amm.cairo`.

## Dependencies

- `starknet 2.15.0` - Starknet core
- `openzeppelin_*` (v3.0.0) - Token standards, access control, upgrades
- `cairo_fp 1.0.0` - Fixed-point math library
- `snforge_std 0.54.1` - Testing framework

## Intentional Compaction

Intentional compaction is the deliberate compression of context into a minimal, high-signal representation.

Instead of dragging an ever-growing conversation forward, you:

- **Summarize the current state into a markdown artifact**
- **Review and validate it as a human**
- **Start a fresh context seeded with that artifact**
- **What to compact**
  - Relevant files and line ranges
  - Verified architectural behavior
  - Decisions already made
  - Explicit constraints and non-goals
- **What not to compact**
  - Raw logs
  - Tool traces
  - Full file contents
  - Repetitive error explanations
