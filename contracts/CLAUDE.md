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

## Testing

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
- `snforge_std 0.54.0` - Testing framework
