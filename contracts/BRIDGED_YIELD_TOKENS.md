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
