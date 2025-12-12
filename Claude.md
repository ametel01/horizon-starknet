# Yield Tokenization Protocol - Starknet

## Project Overview

A Pendle-like yield tokenization protocol implemented in Cairo for Starknet. The protocol enables users to split yield-bearing assets into Principal Tokens (PT) and Yield Tokens (YT), enabling fixed-yield strategies and yield trading.

## Architecture

### Core Components

1. **Standardized Yield (SY)** - Wrapper interface for yield-bearing tokens
2. **Principal Token (PT)** - Represents principal, redeemable at maturity for 1 unit of accounting asset
3. **Yield Token (YT)** - Represents yield rights until maturity, expires worthless
4. **AMM Market** - Time-aware AMM for PT/SY trading with implied yield pricing

### Key Relationships

```
PT Price + YT Price = SY Price (underlying)
1 SY deposit → 1 PT + 1 YT (minting)
1 PT + 1 YT → 1 SY (redemption pre-expiry)
1 PT → 1 accounting asset (redemption post-expiry)
```

## Tech Stack

- **Language**: Cairo 2.14.x
- **Framework**: Scarb 2.14.x
- **Testing**: Starknet Foundry (snforge)
- **Target**: Starknet mainnet/sepolia

## Project Structure

```
src/
├── lib.cairo                 # Module declarations
├── interfaces/
│   ├── i_sy.cairo           # ISY trait
│   ├── i_pt.cairo           # IPT trait
│   ├── i_yt.cairo           # IYT trait
│   ├── i_market.cairo       # IMarket trait
│   └── i_erc20.cairo        # IERC20 trait
├── tokens/
│   ├── sy.cairo             # Standardized Yield base
│   ├── pt.cairo             # Principal Token
│   └── yt.cairo             # Yield Token (minting/redemption logic)
├── market/
│   ├── market.cairo         # AMM implementation
│   └── market_math.cairo    # AMM curve math
├── libraries/
│   ├── math.cairo           # Fixed-point math utilities
│   └── errors.cairo         # Error codes
└── mocks/
    └── mock_yield_token.cairo  # Mock yield-bearing token for testing
tests/
├── test_sy.cairo
├── test_pt_yt.cairo
├── test_market.cairo
└── integration/
    └── test_full_flow.cairo
```

## Key Formulas

### PY Index (Exchange Rate)
```
py_index = max(sy.exchange_rate(), stored_py_index)
```
The index is monotonically non-decreasing.

### Minting PT/YT
```
amount_minted = sy_deposited * py_index
```

### Redemption
```
sy_redeemed = py_burned / current_py_index
```

### Implied APY
```
implied_apy = e^(ln_implied_yield) - 1
implied_apy = ((1 + yt_price/pt_price)^(365/days_to_expiry)) - 1
```

## Development Commands

```bash
# Build
scarb build

# Test
snforge test

# Format
scarb fmt
```

## Implementation Phases

### Phase 1: Core Infrastructure (MVP)
- ERC20 base implementation
- SY interface and base contract
- PT and YT tokens with minting/redemption
- Basic integration tests

### Phase 2: AMM
- Market contract with PT/SY pool
- Time-aware pricing curve
- Swap functions
- LP token management

### Phase 3: Advanced Features
- Flash swaps for YT trading
- Oracle integration (TWAP)
- Reward distribution
- Router contract

## Conventions

- Use `u256` for token amounts
- Use `u64` for timestamps
- Use fixed-point math with 18 decimals (WAD = 10^18)
- Error messages should be descriptive constants
- All public functions need comprehensive tests
- Follow Starknet/Cairo naming conventions (snake_case)

## External Dependencies

- OpenZeppelin Cairo contracts (for ERC20 base)
- Consider: alexandria-math for advanced math utilities

## Notes

- PT redeems to the **accounting asset** (e.g., ETH), not the yield-bearing token
- YT distributes yield continuously until maturity
- At maturity: PT price → 1, YT price → 0
- The AMM curve naturally shifts to push PT toward its underlying value as expiry approaches
