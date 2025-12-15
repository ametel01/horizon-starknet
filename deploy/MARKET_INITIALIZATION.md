# Market Initialization Guide

This document explains how to properly initialize Horizon Protocol markets, the implications of each parameter, and the required transactions.

## Overview

A Horizon market consists of:
- **SY (Standardized Yield)**: Wrapper for the yield-bearing token
- **PT (Principal Token)**: Represents principal, redeemable at maturity
- **YT (Yield Token)**: Represents yield rights until maturity
- **Market**: AMM pool for PT/SY trading

## Market Parameters

### 1. Scalar Root (`MARKET_SCALAR_ROOT`)

Controls the rate sensitivity of the AMM curve.

```
ln_implied_rate = anchor ± scalar_root * arcsinh(proportion / scalar_root)
```

**Recommended value**: `5000000000000000000` (5 WAD = 5.0)

**Impact**:
- Higher values → More stable rates, less price impact per trade
- Lower values → More volatile rates, higher price impact
- With `scalar_root = 5` and near-expiry markets (~30 days), even small reserve imbalances cause dramatic APY swings

### 2. Initial Anchor (`MARKET_INITIAL_ANCHOR`)

The starting `ln(implied_rate)` for the market. This determines the initial implied APY.

**Calculation**:
```bash
# Use the calc-anchor.sh script
./deploy/scripts/calc-anchor.sh <target_apy_percent>

# Example: For 5% APY
./deploy/scripts/calc-anchor.sh 5
# Output: 48790164169431697 (0.0488 WAD)
```

**Recommended values**:
- Low-yield tokens (ETH staking ~3-4%): `38480520568064000` (~3.85%)
- Medium-yield tokens (STRK staking ~8%): `76961041136128000` (~7.7%)
- High-yield tokens: Calculate with `calc-anchor.sh`

### 3. Fee Rate (`MARKET_FEE_RATE`)

Swap fee charged on each trade.

**Recommended value**: `3000000000000000` (0.003 WAD = 0.3%)

### 4. Expiry Timestamp (`EXPIRY_TIMESTAMP`)

Unix timestamp when PT becomes redeemable 1:1 for the accounting asset.

**Important**: As expiry approaches:
- PT price converges to 1.0 (underlying value)
- YT price converges to 0.0
- AMM becomes more sensitive to imbalances

## Liquidity Seeding

### Why It Matters

Insufficient liquidity causes:
- High slippage on trades
- Volatile implied APY from small trades
- Poor user experience

### Recommended Liquidity

**Minimum**: 1,000,000 tokens (1M) per market

The deploy scripts default to:
```bash
SEED_LIQUIDITY_AMOUNT=1000000000000000000000000  # 1M tokens (18 decimals)
```

### Seeding Process

Liquidity is added as a 50/50 split of SY and PT:

1. **Mint SY from underlying**:
   - Approve yield token to SY contract
   - Deposit yield token → receive SY

2. **Mint PT+YT from SY**:
   - Approve SY to YT contract
   - Mint PT+YT using half the SY

3. **Add liquidity**:
   - Approve SY to Market
   - Approve PT to Market
   - Call `market.mint()` with equal amounts

## Required Transactions

### Full Deployment Flow

```
1. Declare all class hashes (7 contracts)
   └── deploy.sh handles this automatically

2. Deploy core contracts
   ├── Factory (creates PT/YT pairs)
   ├── MarketFactory (creates markets)
   └── Router (user-facing entry point)

3. For each yield token:
   ├── Deploy SY wrapper
   ├── Create PT/YT via Factory
   ├── Create Market via MarketFactory
   └── Seed liquidity (see below)
```

### Liquidity Seeding Transactions

For each market, the following transactions are required:

```bash
# 1. Approve yield token to SY
sncast invoke \
  --contract-address $YIELD_TOKEN \
  --function approve \
  --calldata $SY_ADDRESS u256:$AMOUNT

# 2. Deposit to get SY
sncast invoke \
  --contract-address $SY_ADDRESS \
  --function deposit \
  --calldata $DEPLOYER_ADDRESS u256:$AMOUNT

# 3. Approve SY to YT for minting PT+YT
sncast invoke \
  --contract-address $SY_ADDRESS \
  --function approve \
  --calldata $YT_ADDRESS u256:$HALF_AMOUNT

# 4. Mint PT+YT
sncast invoke \
  --contract-address $YT_ADDRESS \
  --function mint_py \
  --calldata $DEPLOYER_ADDRESS u256:$HALF_AMOUNT

# 5. Approve SY to Market
sncast invoke \
  --contract-address $SY_ADDRESS \
  --function approve \
  --calldata $MARKET_ADDRESS u256:$HALF_AMOUNT

# 6. Approve PT to Market
sncast invoke \
  --contract-address $PT_ADDRESS \
  --function approve \
  --calldata $MARKET_ADDRESS u256:$HALF_AMOUNT

# 7. Add liquidity
sncast invoke \
  --contract-address $MARKET_ADDRESS \
  --function mint \
  --calldata $DEPLOYER_ADDRESS u256:$HALF_AMOUNT u256:$HALF_AMOUNT
```

## Common Issues and Solutions

### Issue: 0% Implied APY

**Cause**: Missing or empty environment variable during deployment caused seeding to fail.

**Solution**:
1. Verify all env vars are set before deployment
2. If already deployed, manually seed liquidity:
   ```bash
   # Follow the seeding transactions above
   ```

### Issue: Extreme APY Values (e.g., 3.9e24%)

**Cause**: Severely unbalanced reserves (e.g., 99.9% PT, 0.1% SY).

**Solution**:
1. Execute swaps to rebalance reserves toward 50/50:
   ```bash
   # Swap PT → SY if too much PT
   sncast invoke \
     --contract-address $ROUTER_ADDRESS \
     --function swap_exact_pt_for_sy \
     --calldata $DEPLOYER_ADDRESS $MARKET_ADDRESS u256:$SWAP_AMOUNT u256:0

   # Swap SY → PT if too much SY
   sncast invoke \
     --contract-address $ROUTER_ADDRESS \
     --function swap_exact_sy_for_pt \
     --calldata $DEPLOYER_ADDRESS $MARKET_ADDRESS u256:$SWAP_AMOUNT u256:0
   ```

2. Monitor reserves and APY after each swap
3. Add more liquidity once balanced

### Issue: High Slippage on Trades

**Cause**: Insufficient liquidity.

**Solution**: Add more liquidity (recommended: 1M+ tokens per market).

## Monitoring Market Health

### Check Reserves
```bash
sncast call \
  --contract-address $MARKET_ADDRESS \
  --function read_state
```

Response: `(total_pt, total_sy, ...)`

Healthy market: PT and SY reserves should be relatively balanced (within 2:1 ratio).

### Check Implied Rate
```bash
sncast call \
  --contract-address $MARKET_ADDRESS \
  --function get_ln_implied_rate
```

The ln_implied_rate should be:
- Positive for markets with yield
- Stable across small trades
- Converging toward 0 as expiry approaches

## Best Practices

1. **Always verify env vars** before running deployment scripts
2. **Use adequate liquidity** (1M+ tokens per market)
3. **Calculate appropriate anchor** for the expected yield rate
4. **Test on devnet/fork** before deploying to testnet/mainnet
5. **Monitor markets** after deployment for any imbalances
6. **Document expiry dates** clearly for users

## Related Scripts

- `deploy/scripts/deploy.sh` - Main deployment script
- `deploy/scripts/calc-anchor.sh` - Calculate initial anchor from APY
- `deploy/scripts/export-addresses.sh` - Export deployed addresses
