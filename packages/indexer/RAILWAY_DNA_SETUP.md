# Self-Hosted Apibara DNA on Railway

This guide explains how to deploy a self-hosted Apibara DNA server on Railway for faster indexing without rate limits.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        Railway                               │
│                                                              │
│  ┌──────────┐    ┌──────────┐    ┌──────────────────────┐  │
│  │  etcd    │◄───│   DNA    │───►│  MinIO (S3 storage)  │  │
│  │          │    │ Starknet │    │                      │  │
│  └──────────┘    └────┬─────┘    └──────────────────────┘  │
│                       │                                     │
│                       │ gRPC stream                         │
│                       ▼                                     │
│                 ┌──────────┐         ┌──────────────────┐  │
│                 │ Indexer  │────────►│    PostgreSQL    │  │
│                 │          │         │                  │  │
│                 └──────────┘         └──────────────────┘  │
│                       │                                     │
└───────────────────────┼─────────────────────────────────────┘
                        │
                        ▼ RPC calls
                 ┌──────────────┐
                 │ Starknet RPC │
                 │ (Alchemy/    │
                 │  Infura)     │
                 └──────────────┘
```

## Prerequisites

- Railway Pro account (for volumes and private networking)
- Starknet RPC endpoint (Alchemy, Infura, or Blast API key)
- Existing PostgreSQL service on Railway

## Step 1: Deploy etcd Service

etcd is used for DNA coordination and leader election.

### Create Service
1. Go to your Railway project
2. Click **+ New** → **Docker Image**
3. Enter image: `quay.io/coreos/etcd:v3.6.7`
4. Name the service: `etcd`

### Configure Variables
```env
ETCD_DATA_DIR=/data
ETCD_LISTEN_CLIENT_URLS=http://0.0.0.0:2379
ETCD_ADVERTISE_CLIENT_URLS=http://etcd.railway.internal:2379
```

### Configure Start Command
```bash
etcd
```

### Add Volume
- Mount path: `/data`
- Size: 1 GB (minimal usage)

### Health Check (optional)
- Path: Leave empty (TCP check)
- Port: 2379

---

## Step 2: Deploy MinIO Service

MinIO provides S3-compatible storage for DNA block data.

### Create Service
1. Click **+ New** → **Docker Image**
2. Enter image: `minio/minio:latest`
3. Name the service: `minio`

### Configure Variables
```env
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=<generate-a-secure-password>
```

### Configure Start Command
```bash
server /data --console-address :9001
```

### Add Volume
- Mount path: `/data`
- Size: 10-50 GB (depends on how much history you need)

### Expose Ports (internal only)
- Port 9000: S3 API
- Port 9001: Console (optional, for debugging)

---

## Step 3: Create MinIO Bucket

After MinIO is running, create the DNA bucket:

### Option A: Using MinIO Console
1. Temporarily expose port 9001 publicly
2. Access the console at the public URL
3. Login with your credentials
4. Create bucket named `dna-data`
5. Remove public exposure

### Option B: Using Railway Shell
1. Open a shell in the MinIO service
2. Run:
```bash
mc alias set local http://localhost:9000 minioadmin <your-password>
mc mb local/dna-data
```

### Option C: Init Container (Recommended)
Create a one-time job service with image `minio/mc:latest`:

**Start Command:**
```bash
/bin/sh -c "mc alias set myminio http://minio.railway.internal:9000 minioadmin <password> && mc mb myminio/dna-data --ignore-existing"
```

Run once, then delete the service.

---

## Step 4: Deploy DNA Starknet Service

The main Apibara DNA server that ingests and serves Starknet data.

### Create Service
1. Click **+ New** → **Docker Image**
2. Enter image: `quay.io/apibara/starknet:2.1.0`
3. Name the service: `dna-starknet`

### Configure Variables
```env
# Logging
RUST_LOG=info

# Starknet RPC (use your own API key)
STARKNET_RPC_URL=https://starknet-mainnet.g.alchemy.com/v2/YOUR_ALCHEMY_API_KEY

# S3 Configuration (MinIO)
DNA_S3_BUCKET=dna-data
DNA_S3_ENDPOINT=http://minio.railway.internal:9000
DNA_S3_REGION=us-east-1
AWS_ACCESS_KEY_ID=minioadmin
AWS_SECRET_ACCESS_KEY=<same-password-as-minio>

# etcd Configuration
DNA_ETCD_ENDPOINTS=http://etcd.railway.internal:2379
DNA_ETCD_PREFIX=/dna/starknet

# Service Configuration
DNA_INGESTION_ENABLED=true
DNA_COMPACTION_ENABLED=true
DNA_SERVER_ENABLED=true

# Concurrency (adjust based on RPC rate limits)
# - Free RPC tier: 1-2
# - Paid RPC tier: 5-10
DNA_INGESTION_MAX_CONCURRENT_TASKS=5

# Server Configuration
DNA_SERVER_ADDRESS=0.0.0.0:7007

# Cache Configuration
DNA_CACHE_DIR=/cache
DNA_CACHE_DATA_DISK_SIZE=5Gi
DNA_CACHE_INDEX_DISK_SIZE=5Gi

# Skip pending transactions (not needed for indexing)
STARKNET_NO_INGEST_PENDING=true

# Optional: Start from a specific block (skip historical data)
# DNA_INGESTION_DANGEROUSLY_OVERRIDE_STARTING_BLOCK=4643300
```

### Configure Start Command
```bash
start
```

### Add Volume
- Mount path: `/cache`
- Size: 10-20 GB

### Resource Allocation
Recommended minimums:
- CPU: 1 vCPU
- Memory: 2 GB

---

## Step 5: Update Indexer Service

Update your indexer to use the self-hosted DNA server.

### Update Variables
```env
# Remove or comment out DNA_TOKEN (not needed for self-hosted)
# DNA_TOKEN=...

# Point to self-hosted DNA
DNA_STREAM_URL=http://dna-starknet.railway.internal:7007

# Keep existing variables
POSTGRES_CONNECTION_STRING=${{Postgres.DATABASE_URL}}
PG_POOL_MAX=15
PG_POOL_MIN=2
```

### Restart Indexer
Redeploy the indexer service to pick up the new DNA_STREAM_URL.

---

## Verification

### Check DNA Server Status
Open a shell in the `dna-starknet` service and check logs:
```bash
# Logs should show block ingestion progress
# Look for: "Ingested block XXXXX"
```

### Check Indexer Connection
Indexer logs should show:
```
[router] Starting indexer with streamUrl: http://dna-starknet.railway.internal:7007
```

### Monitor Sync Progress
Query your database to check indexing progress:
```sql
SELECT 'router' as indexer, MAX(block_number) as latest_block FROM router_swap
UNION ALL
SELECT 'market', MAX(block_number) FROM market_swap;
```

---

## Cost Estimates

| Service | CPU | Memory | Storage | Est. Monthly Cost |
|---------|-----|--------|---------|-------------------|
| etcd | 0.5 vCPU | 512 MB | 1 GB | ~$3-5 |
| MinIO | 0.5 vCPU | 512 MB | 20 GB | ~$5-8 |
| DNA Starknet | 1 vCPU | 2 GB | 15 GB | ~$15-25 |
| **Total** | | | | **~$25-40/month** |

Plus RPC costs:
- Alchemy Growth: $49/month (300M compute units)
- Infura: Pay-as-you-go
- Blast API: Free tier available

---

## Troubleshooting

### DNA server not starting
1. Check etcd is healthy: `etcdctl endpoint health`
2. Check MinIO is accessible: `curl http://minio.railway.internal:9000/minio/health/live`
3. Verify bucket exists in MinIO

### Slow ingestion
1. Increase `DNA_INGESTION_MAX_CONCURRENT_TASKS` (if RPC allows)
2. Use a faster RPC provider
3. Check RPC rate limits in DNA logs

### Indexer can't connect to DNA
1. Verify DNA server is running: check logs for "Server listening on 0.0.0.0:7007"
2. Check Railway private networking is working
3. Try using the Railway service reference: `${{dna-starknet.RAILWAY_PRIVATE_DOMAIN}}:7007`

### Out of storage
1. Increase MinIO volume size
2. Enable DNA compaction: `DNA_COMPACTION_ENABLED=true`
3. Prune old data (if supported)

---

## Alternative: Hybrid Approach

If self-hosting is too complex, consider a hybrid approach:

1. **Use hosted DNA for real-time**: Keep using `mainnet.starknet.a5a.ch` for live data
2. **Self-host for backfill only**: Run DNA locally to catch up, then switch to hosted

This reduces Railway costs while still getting fast initial sync.
