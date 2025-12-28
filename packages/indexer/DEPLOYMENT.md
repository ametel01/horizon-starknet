# Horizon Indexer Deployment Guide

Complete checklist for deploying the Horizon Protocol indexer to Railway.

## Prerequisites

- [ ] GitHub account with repository access
- [ ] Railway account (https://railway.app) - sign up with GitHub
- [ ] Apibara DNA token from https://app.apibara.com (free tier available)

---

## Phase 1: Railway Project Setup

### 1.1 Create Railway Account

1. [ ] Go to https://railway.app
2. [ ] Click **Login** → **Login with GitHub**
3. [ ] Authorize Railway to access your GitHub
4. [ ] Add payment method (required for production, but has $5 free trial credit)

### 1.2 Create New Project

1. [ ] Click **New Project**
2. [ ] Select **Deploy from GitHub repo**
3. [ ] Find and select your `horizon-starknet` repository
4. [ ] Railway will auto-detect the Dockerfile

### 1.3 Configure Root Directory

Since the indexer is in a monorepo subdirectory:

1. [ ] Click on the deployed service
2. [ ] Go to **Settings** → **Build**
3. [ ] Set **Root Directory**: `packages/indexer`
4. [ ] Set **Watch Paths**: `packages/indexer/**`

---

## Phase 2: Add PostgreSQL Database

### 2.1 Add Database Service

1. [ ] In your Railway project, click **New**
2. [ ] Select **Database** → **Add PostgreSQL**
3. [ ] Railway will provision a PostgreSQL instance

### 2.2 Get Connection String

1. [ ] Click on the PostgreSQL service
2. [ ] Go to **Connect** tab
3. [ ] Copy the **DATABASE_URL** (looks like `postgresql://postgres:xxx@xxx.railway.app:5432/railway`)

---

## Phase 3: Configure Environment Variables

### 3.1 Set Indexer Environment Variables

1. [ ] Click on your indexer service
2. [ ] Go to **Variables** tab
3. [ ] Add the following variables:

| Variable | Value |
|----------|-------|
| `POSTGRES_CONNECTION_STRING` | `${{Postgres.DATABASE_URL}}` (use Railway reference) |
| `DNA_TOKEN` | Your Apibara DNA token |
| `DNA_STREAM_URL` | `https://mainnet.starknet.a5a.ch` |

**Using Railway variable references:**
- Click **Add Variable**
- For `POSTGRES_CONNECTION_STRING`, click **Add Reference** → Select **Postgres** → **DATABASE_URL**

### 3.2 Optional: Configure Network Preset

To deploy for a different network (sepolia, devnet), override the start command:

1. [ ] Go to **Settings** → **Deploy**
2. [ ] Set **Custom Start Command**:
   - Mainnet: `bun run apibara start --preset mainnet`
   - Sepolia: `bun run apibara start --preset sepolia`

---

## Phase 4: Create Railway Configuration

### 4.1 Create railway.json

Create `railway.json` in `packages/indexer/`:

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "Dockerfile"
  },
  "deploy": {
    "startCommand": "bun run apibara start --preset mainnet",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

### 4.2 Verify Dockerfile Exists

Ensure `packages/indexer/Dockerfile` exists (already created).

### 4.3 Push Changes

```bash
git add packages/indexer/railway.json
git commit -m "Add Railway deployment configuration"
git push origin main
```

Railway will automatically redeploy when you push to the connected branch.

---

## Phase 5: Deploy and Verify

### 5.1 Trigger Deployment

Deployments happen automatically on git push. To manually trigger:

1. [ ] Go to your indexer service
2. [ ] Click **Deployments** tab
3. [ ] Click **Redeploy** on the latest deployment

### 5.2 Monitor Logs

1. [ ] Click on the indexer service
2. [ ] Go to **Logs** tab
3. [ ] Watch for successful startup messages:
   ```
   Starting indexer...
   Connected to DNA stream
   Processing block XXXXXX
   ```

### 5.3 Verify Database

Use Railway's built-in query interface:

1. [ ] Click on PostgreSQL service
2. [ ] Go to **Data** tab
3. [ ] Run queries to verify tables:

```sql
-- Check tables were created
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public';

-- Check for indexed events
SELECT COUNT(*) FROM factory_yield_contracts_created;
SELECT COUNT(*) FROM market_factory_market_created;
```

---

## Phase 6: Production Configuration

### 6.1 Set Up Health Checks

In Railway service settings:

1. [ ] Go to **Settings** → **Healthcheck**
2. [ ] Railway monitors container health automatically

### 6.2 Configure Restart Policy

Already configured in `railway.json`. The indexer will restart on failure up to 10 times.

### 6.3 Set Resource Limits (Optional)

1. [ ] Go to **Settings** → **Resources**
2. [ ] Recommended minimums:
   - Memory: 1 GB
   - vCPU: 1

### 6.4 Enable Auto-Deploy

1. [ ] Go to **Settings** → **Build & Deploy**
2. [ ] Ensure **Auto Deploy** is enabled for your branch

---

## Railway CLI (Alternative Deployment Method)

### Install Railway CLI

```bash
# macOS
brew install railway

# npm
npm install -g @railway/cli

# Or curl
curl -fsSL https://railway.app/install.sh | sh
```

### CLI Commands

```bash
# Login
railway login

# Link to existing project
cd packages/indexer
railway link

# Deploy manually
railway up

# View logs
railway logs

# Open Railway dashboard
railway open

# Set environment variables
railway variables set DNA_TOKEN=your_token_here

# Connect to PostgreSQL locally
railway connect postgres

# Set environment variable to reset checkpoints
railway variables set RESET_CHECKPOINTS=true

# View checkpoints
SELECT * FROM airfoil.checkpoints ORDER BY order_key DESC;
```

---

## Operational Commands

### View Logs

- **Dashboard**: Service → Logs tab
- **CLI**: `railway logs -f`

### Restart Service

- **Dashboard**: Deployments → Redeploy
- **CLI**: `railway up`

### Database Access

```bash
# Connect via CLI
railway connect postgres

# Run SQL
railway run psql $DATABASE_URL

# Refresh materialized views
REFRESH MATERIALIZED VIEW CONCURRENTLY market_current_state;
REFRESH MATERIALIZED VIEW CONCURRENTLY protocol_daily_stats;
REFRESH MATERIALIZED VIEW CONCURRENTLY user_trading_stats;
REFRESH MATERIALIZED VIEW CONCURRENTLY rate_history;
REFRESH MATERIALIZED VIEW CONCURRENTLY oracle_rate_history;
REFRESH MATERIALIZED VIEW CONCURRENTLY market_daily_stats;
REFRESH MATERIALIZED VIEW CONCURRENTLY market_hourly_stats;
REFRESH MATERIALIZED VIEW CONCURRENTLY user_py_positions;
REFRESH MATERIALIZED VIEW CONCURRENTLY market_lp_positions;
```

### Resync from Scratch

**Option 1: Environment Variable (Recommended)**

Set `RESET_CHECKPOINTS=true` in Railway environment variables, then redeploy. This will automatically truncate the checkpoint table on startup, forcing all indexers to restart from their configured `startingBlock`.

After successful restart, remove the `RESET_CHECKPOINTS` variable to prevent repeated resets.

**Option 2: Manual SQL**

1. Connect to PostgreSQL via Railway dashboard or CLI
2. Truncate checkpoint table:
   ```sql
   TRUNCATE _apibara_checkpoints CASCADE;
   ```
3. Redeploy the indexer service

---

## Troubleshooting

### Build Fails

```bash
# Check build logs in Railway dashboard
# Common issues:
# 1. Wrong root directory (should be packages/indexer)
# 2. Missing Dockerfile
# 3. bun.lock out of sync - run `bun install` locally and push
```

### Indexer Crashes on Startup

Check logs for:
- `DNA_TOKEN` not set or invalid
- `POSTGRES_CONNECTION_STRING` not set
- Network connectivity issues

### Database Connection Refused

1. Verify PostgreSQL service is running
2. Check `POSTGRES_CONNECTION_STRING` uses Railway reference syntax: `${{Postgres.DATABASE_URL}}`

### Slow Sync Performance

The hosted Apibara DNA handles this well. If slow:
1. Check DNA service status at https://status.apibara.com
2. Verify starting block is set correctly in config

---

## Cost Estimate

Railway pricing (as of 2024):

| Resource | Pricing |
|----------|---------|
| Compute | $0.000231/min (~$10/mo for always-on) |
| Memory | $0.000231/GB/min |
| PostgreSQL | $0.000231/min + storage |
| **Estimated Total** | **$15-25/mo** |

Railway includes $5 free trial credit. Pricing scales with usage.

**Tips to reduce costs:**
- Railway automatically sleeps inactive services on hobby plan
- Use the Pro plan ($20/mo) for predictable pricing with included resources

---

## Quick Deploy Checklist

- [ ] Create Railway account (sign up with GitHub)
- [ ] Create new project from GitHub repo
- [ ] Set root directory to `packages/indexer`
- [ ] Add PostgreSQL database
- [ ] Configure environment variables:
  - [ ] `POSTGRES_CONNECTION_STRING` (reference Postgres.DATABASE_URL)
  - [ ] `DNA_TOKEN`
  - [ ] `DNA_STREAM_URL`
- [ ] Create and push `railway.json`
- [ ] Verify deployment in logs
- [ ] Check database tables created

---

## Project Structure for Railway

```
packages/indexer/
├── Dockerfile              # Multi-stage Bun build
├── railway.json            # Railway configuration
├── docker-compose.yml      # Local development only
├── docker-compose.prod.yml # Not used on Railway
├── package.json
├── apibara.config.ts
├── drizzle.config.ts
└── src/
    ├── indexers/           # Indexer files
    ├── schema/             # Drizzle schema
    └── lib/                # Shared utilities
```

```
# Truncate all tables in the database

TRUNCATE TABLE
    market_burn, market_mint, market_swap, market_fees_collected,
    market_implied_rate_updated,
    factory_class_hashes_updated, factory_yield_contracts_created,
    market_factory_class_hash_updated, market_factory_market_created,
    router_add_liquidity, router_mint_py, router_redeem_py,
    router_remove_liquidity, router_swap, router_swap_yt,
    sy_deposit, sy_redeem, sy_oracle_rate_updated,
    yt_expiry_reached, yt_interest_claimed, yt_mint_py,
    yt_redeem_py, yt_redeem_py_post_expiry
  CASCADE;
```

---

## Next Steps After Deployment

1. Set up Railway notifications (Slack, Discord, email)
2. Monitor usage in Railway dashboard
3. Add API layer to expose indexed data (separate Railway service)
4. Configure custom domain if needed (Settings → Networking)
