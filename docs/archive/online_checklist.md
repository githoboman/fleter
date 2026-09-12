# BitDrum Public Deployment Checklist

**Goal:** Make BitDrum testable by anyone from anywhere — no local machine required.

---

## Deployment Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Vercel (frontend only)                                      │
│  Next.js app → https://bitdrum.vercel.app (or custom domain)│
└─────────────────────┬───────────────────────────────────────┘
                      │ REST + WebSocket
┌─────────────────────▼───────────────────────────────────────┐
│  Railway Project                                             │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │   Gateway    │  │   Indexer    │  │     Keeper       │  │
│  │ Express + WS │  │ Event sync   │  │ Oracle + settle  │  │
│  │  Port: auto  │  │ Long-running │  │ Long-running     │  │
│  └──────┬───────┘  └──────┬───────┘  └──────────────────┘  │
│         │                 │                                   │
│  ┌──────▼─────────────────▼──────┐                          │
│  │     PostgreSQL (Railway or    │                          │
│  │     Neon — see Phase 1)       │                          │
│  └───────────────────────────────┘                          │
└─────────────────────────────────────────────────────────────┘
                      │ on-chain
┌─────────────────────▼───────────────────────────────────────┐
│  Somnia Shannon Testnet (chainId 50312)                      │
│  All V2 contracts already deployed                           │
└─────────────────────────────────────────────────────────────┘
```

**Why not all on Vercel?** Vercel is serverless — it cannot run WebSocket servers, persistent listeners, or cron-like processes. The keeper and indexer need to run continuously.

---

## Accounts You Need

| Service  | URL                        | Cost          | Purpose             |
|----------|----------------------------|---------------|---------------------|
| GitHub   | github.com                 | Free          | Source of truth     |
| Vercel   | vercel.com                 | Free          | Frontend hosting    |
| Railway  | railway.app                | ~$5/mo        | Backend + Postgres  |
| Neon     | neon.tech (optional)       | Free tier     | Postgres alt        |
| Privy    | privy.io (already have)    | Already set   | Auth                |

---

## Phase 0: Push Code to GitHub

- [ ] Create a GitHub repository (public or private)
- [ ] Verify `.env` files are NOT tracked: `git status` should not show any `.env` files
  - The root `.gitignore` covers this — confirm with: `git ls-files | grep .env` (should return nothing)
- [ ] Push the full monorepo:
  ```bash
  cd /path/to/bitdrum
  git remote add origin https://github.com/YOUR_USERNAME/bitdrum.git
  git push -u origin main
  git push origin minimal  # push current branch too
  ```
- [ ] Make sure the `minimal` branch (or whichever is your latest) is pushed

---

## Phase 1: Database (PostgreSQL)

Choose **one** of these options:

### Option A — Railway Postgres (recommended, everything in one place)
- [ ] Create a Railway account at railway.app
- [ ] New Project → Add Database → PostgreSQL
- [ ] Click the Postgres service → **Variables** tab → copy `DATABASE_URL`
  - It looks like: `postgresql://postgres:PASSWORD@HOST:PORT/railway`
- [ ] Click **Connect** → open the **Query** tab (built-in SQL editor)
- [ ] Paste and run the schema (both files below, in order)

### Option B — Neon (free, separate)
- [ ] Create account at neon.tech
- [ ] New Project → choose a region close to your users
- [ ] Copy the **Connection string** (looks like `postgresql://user:pass@ep-xxx.neon.tech/neondb?sslmode=require`)
- [ ] Open the **SQL Editor** in Neon dashboard

### Run Schema Migrations (whichever option you chose)

Run these two SQL statements in the SQL editor, in order:

**Migration 1** (paste and run):
```sql
CREATE TABLE "ai_signals" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "market_id" text NOT NULL,
  "direction" text NOT NULL,
  "confidence" integer,
  "rationale" text,
  "is_accurate" boolean,
  "generated_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE "follows" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "follower_address" text NOT NULL,
  "following_address" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE "markets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "market_id" text NOT NULL,
  "opener_address" text NOT NULL,
  "opener_direction" text NOT NULL,
  "pom_profit_bps" integer NOT NULL,
  "stake" numeric NOT NULL,
  "long_pool" numeric DEFAULT '0' NOT NULL,
  "short_pool" numeric DEFAULT '0' NOT NULL,
  "join_deadline" bigint,
  "state" text DEFAULT 'OPEN' NOT NULL,
  "entry_price" numeric,
  "settlement_price" numeric,
  "outcome" text,
  "transaction_hash" text,
  "opened_at" timestamp with time zone DEFAULT now(),
  "settled_at" timestamp with time zone,
  CONSTRAINT "markets_market_id_unique" UNIQUE("market_id")
);

CREATE TABLE "stakes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "market_id" text NOT NULL,
  "participant_address" text NOT NULL,
  "direction" text NOT NULL,
  "stake_amount" numeric NOT NULL,
  "claimed" boolean DEFAULT false NOT NULL,
  "payout" numeric,
  "transaction_hash" text,
  "timestamp" timestamp with time zone DEFAULT now()
);

CREATE TABLE "traders" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "address" text NOT NULL,
  "display_name" text,
  "tier" text DEFAULT 'SCOUT' NOT NULL,
  "markets_entered" integer DEFAULT 0 NOT NULL,
  "wins" integer DEFAULT 0 NOT NULL,
  "losses" integer DEFAULT 0 NOT NULL,
  "draws" integer DEFAULT 0 NOT NULL,
  "total_staked" numeric DEFAULT '0' NOT NULL,
  "total_claimed" numeric DEFAULT '0' NOT NULL,
  "composite_score" numeric DEFAULT '0' NOT NULL,
  "last_active" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "traders_address_unique" UNIQUE("address")
);
```

**Migration 2** (paste and run separately):
```sql
ALTER TABLE "markets" ADD COLUMN IF NOT EXISTS "duration_seconds" bigint;
```

- [ ] Both migrations ran without errors
- [ ] Save your `POSTGRES_CONNECTION_STRING` somewhere safe — you'll need it for all three backend services

---

## Phase 2: Backend on Railway

### 2a — Create the Railway Project

- [ ] Go to railway.app → New Project → **Deploy from GitHub repo**
- [ ] Authorize Railway to access your GitHub
- [ ] Select the `bitdrum` repository

Railway will try to deploy the root — you'll configure it properly in the next steps.

### 2b — Deploy the Gateway

- [ ] In your Railway project, click **New Service** → **GitHub Repo** → select `bitdrum`
- [ ] Name it `gateway`
- [ ] Click the service → **Settings** tab:
  - **Root Directory:** `backend/gateway`
  - **Build Command:** `npm install && npm run build`
  - **Start Command:** `npm start`
  - **Watch Paths:** `backend/gateway/**`
- [ ] Go to **Variables** tab, add all of the following:

```
POSTGRES_CONNECTION_STRING=<your connection string from Phase 1>
SOMNIA_RPC_URL=https://dream-rpc.somnia.network
SOMNIA_RPC_FALLBACK_URL=https://rpc.somnia.network
SOMNIA_CHAIN_ID=50312
PREDICTION_MARKET_ADDRESS=0x87F8014110e5D6c69bb1A3e64f25dc595b4a861C
SETTLEMENT_ENGINE_ADDRESS=0x46c938d2D527A3Ca4a48ee8D8c4e72417618e67B
LIQUIDITY_VAULT_ADDRESS=0xB16927B62fccF99668B98544AFaF03c5C64d38ED
TREASURY_ADDRESS=0x13B4A6C86EFa533e9bF3E035228021ca7Fa52ad7
LEADERBOARD_ADDRESS=0x5BaC7081963c67518519bD70057dbA8E0e46ab45
PRIVY_APP_ID=cmn0pfvsw01in0cl20m2bupqo
PRIVY_APP_SECRET=<value from your local backend/gateway/.env>
SOMNIA_REACTIVITY_ENABLED=true
SOMNIA_REACTIVITY_WS_URL=wss://api.infra.testnet.somnia.network/ws
SOMNIA_REACTIVITY_HTTP_URL=https://dream-rpc.somnia.network
SOMNIA_STREAMS_ENABLED=true
STREAMS_PUBLISHER_PRIVATE_KEY=<value from your local backend/gateway/.env>
STREAMS_PUBLISHER_ADDRESS=0x25D27F36038511ed7a65f1689a639cD6dF0Bb2CD
WS_REFRESH_MS=60000
WS_USE_POLLING_FALLBACK=true
```

Note: `PORT` is set automatically by Railway — do not set it manually.

- [ ] Click **Deploy** — wait for build to succeed (check Logs tab)
- [ ] Once deployed, go to **Settings** → **Networking** → **Generate Domain**
  - You'll get a URL like `gateway-production-xxxx.up.railway.app`
- [ ] **Save this URL** — you need it for the frontend

### 2c — Deploy the Indexer

- [ ] Click **New Service** → **GitHub Repo** → select `bitdrum`
- [ ] Name it `indexer`
- [ ] Settings:
  - **Root Directory:** `backend/indexer`
  - **Build Command:** `npm install && npm run build`
  - **Start Command:** `npm start`
- [ ] Variables:

```
POSTGRES_CONNECTION_STRING=<same connection string as gateway>
SOMNIA_RPC_URL=https://dream-rpc.somnia.network
SOMNIA_RPC_FALLBACK_URL=https://rpc.somnia.network
SOMNIA_CHAIN_ID=50312
PREDICTION_MARKET_ADDRESS=0x87F8014110e5D6c69bb1A3e64f25dc595b4a861C
START_BLOCK=352594919
POLL_INTERVAL_MS=3000
BLOCK_BATCH_SIZE=500
```

- [ ] Deploy and verify logs show `[Indexer] Starting from block ...`

### 2d — Deploy the Keeper

- [ ] Click **New Service** → **GitHub Repo** → select `bitdrum`
- [ ] Name it `keeper`
- [ ] Settings:
  - **Root Directory:** `backend/keeper`
  - **Build Command:** `npm install && npm run build`
  - **Start Command:** `npm start`
- [ ] Variables:

```
SOMNIA_RPC_URL=https://dream-rpc.somnia.network
SOMNIA_RPC_FALLBACK_URL=https://rpc.somnia.network
SOMNIA_CHAIN_ID=50312
PRICE_ADAPTER_ADDRESS=0xDeED8D1c527F673507F445fB6cb635C48DE0acB1
PREDICTION_MARKET_ADDRESS=0x87F8014110e5D6c69bb1A3e64f25dc595b4a861C
SETTLEMENT_ENGINE_ADDRESS=0x46c938d2D527A3Ca4a48ee8D8c4e72417618e67B
LIQUIDITY_VAULT_ADDRESS=0xB16927B62fccF99668B98544AFaF03c5C64d38ED
TREASURY_ADDRESS=0x13B4A6C86EFa533e9bF3E035228021ca7Fa52ad7
LEADERBOARD_ADDRESS=0x5BaC7081963c67518519bD70057dbA8E0e46ab45
KEEPER_PRIVATE_KEY=<value from your local backend/keeper/.env>
POLLING_INTERVAL=3000
ORACLE_MAX_AGE_SECONDS=150
KEEPER_POM_BPS=0
```

**Security note:** `KEEPER_PRIVATE_KEY` controls the wallet that posts oracle prices and triggers settlements. Keep it private. It only needs a small STT balance for gas.

- [ ] Deploy and verify logs show `[PricePublisher]` and `[MarketLifecycle]` events

---

## Phase 3: Frontend on Vercel

- [ ] Go to vercel.com → New Project → Import Git Repository → select `bitdrum`
- [ ] On the **Configure Project** screen:
  - **Framework Preset:** Next.js (auto-detected)
  - **Root Directory:** `frontend`
  - **Build Command:** leave as default (`next build`) or `npm run build`
  - **Output Directory:** leave as default (`.next`)
- [ ] Expand **Environment Variables** and add:

```
NEXT_PUBLIC_PRIVY_APP_ID=cmn0pfvsw01in0cl20m2bupqo
NEXT_PUBLIC_API_URL=https://gateway-production-xxxx.up.railway.app/api
NEXT_PUBLIC_WS_URL=wss://gateway-production-xxxx.up.railway.app/ws
NEXT_PUBLIC_CHAIN_ID=50312
NEXT_PUBLIC_PREDICTION_MARKET_ADDR=0x87F8014110e5D6c69bb1A3e64f25dc595b4a861C
```

Replace `gateway-production-xxxx.up.railway.app` with the actual Railway gateway URL from Phase 2b.

- [ ] Click **Deploy**
- [ ] Once deployed, note your Vercel URL (e.g., `bitdrum.vercel.app`)

---

## Phase 4: Post-Deploy Configuration

### 4a — Add Vercel Domain to Privy

- [ ] Log in to privy.io dashboard
- [ ] Go to your app → **Settings** → **Allowed Origins** (or "Domains")
- [ ] Add your Vercel URL: `https://bitdrum.vercel.app`
  - Also add any custom domain you plan to use
- [ ] Save — without this, Privy wallet login will be blocked by CORS

### 4b — Fund the Keeper Wallet

The keeper wallet needs STT for gas to post prices and settle markets.

- [ ] Find the keeper wallet address — it's derived from `KEEPER_PRIVATE_KEY`
  - Run locally: `node -e "const {Wallet} = require('ethers'); console.log(new Wallet('KEEPER_PRIVATE_KEY_HERE').address)"`
- [ ] Get testnet STT from the Somnia faucet: https://testnet.somnia.network/faucet
- [ ] Send at least **0.5 STT** to the keeper wallet address
- [ ] Verify in Railway keeper logs that transactions are landing (look for `market_locked` or `price_published` events)

### 4c — Fund the Liquidity Vault (Initial Liquidity)

The vault (`0xB16927B62fccF99668B98544AFaF03c5C64d38ED`) needs STT deposited so it can match trades. Without vault liquidity, markets open with 0% payout.

- [ ] Connect your wallet on the deployed Vercel URL
- [ ] Get testnet STT from the faucet for your own wallet
- [ ] Deposit STT into the vault — call `deposit()` on the LiquidityVaultV2 contract
  - Easiest: use Remix IDE, connect to Somnia, call `deposit` with value
  - Or use a script: `cd contracts && npx hardhat run scripts/fund-vault.js --network somnia`
  - Recommended minimum: **10 STT** (above VAULT_LOW_WATER threshold for better payouts)

---

## Phase 5: Verification

Work through this end-to-end after all deployments are live.

### Health Check
- [ ] Visit: `https://gateway-production-xxxx.up.railway.app/health`
  - Should return `{"status":"healthy","checks":{"db":"ok",...}}`
  - `keeper` may show `unknown` — that's expected (different container)

### Markets Load
- [ ] Open `https://bitdrum.vercel.app`
- [ ] Page loads without console errors
- [ ] Market list renders (may be empty on a fresh deployment — that's fine)

### Wallet Connect
- [ ] Click Connect Wallet
- [ ] Privy login modal appears without errors
- [ ] Wallet connects and shows your address

### Open a Market
- [ ] Navigate to the arena / trade page
- [ ] Select a timeframe and direction (UP or DOWN)
- [ ] Enter a stake amount (e.g., 0.1 STT)
- [ ] Confirm the transaction in your wallet
- [ ] Market appears in the list with status OPEN

### Trade Executes
- [ ] The ExecutionCard appears in the price chart
- [ ] Countdown timer ticks down
- [ ] Status shows "Active"

### Market Locks
- [ ] Wait for the joining window to expire (30-60s depending on timeframe)
- [ ] Market state changes to LOCKED
- [ ] Keeper logs on Railway show `{"event":"market_locked",...}`

### Market Settles
- [ ] Wait for market expiry (full timeframe duration)
- [ ] Keeper logs show `{"event":"pre_settle_publish",...}` then `{"event":"market_settled",...}`
- [ ] Market state changes to CLAIMABLE
- [ ] Outcome is UP or DOWN (not DRAW — if you see DRAW consistently, check keeper logs)

### Claim Winnings
- [ ] If you won, the Claim button appears
- [ ] Claim transaction succeeds
- [ ] STT balance increases

---

## Troubleshooting

### Frontend shows "Failed to fetch" or blank markets
- CORS issue or wrong `NEXT_PUBLIC_API_URL`
- Verify: the Railway gateway URL in Vercel env vars has no trailing slash
- Verify: gateway is running — check `/health` endpoint

### Privy login fails
- Domain not added to Privy allowed origins (Phase 4a)

### Markets always settle as DRAW
- Keeper is not running or not posting fresh prices
- Check Railway keeper logs for `binance` source in price events
- Verify `KEEPER_PRIVATE_KEY` is set correctly and wallet has STT for gas

### Market stays LOCKED and never settles
- Keeper wallet ran out of STT gas
- Settlement revert: check keeper logs for errors
- Verify `SETTLEMENT_ENGINE_ADDRESS` and `PRICE_ADAPTER_ADDRESS` env vars match what's in the contract

### WebSocket not connecting
- Make sure `NEXT_PUBLIC_WS_URL` uses `wss://` (not `ws://`) for Railway's HTTPS domain
- Railway domains are always HTTPS/WSS

### Railway build fails
- Check that `Root Directory` is set correctly (e.g., `backend/gateway`, not `backend/gateway/`)
- Make sure `npm install && npm run build` runs TypeScript successfully locally first

---

## Quick Reference: All URLs After Deployment

| Service          | URL                                               |
|------------------|---------------------------------------------------|
| Frontend         | `https://bitdrum.vercel.app`                      |
| Gateway REST     | `https://gateway-xxx.up.railway.app/api`          |
| Gateway WS       | `wss://gateway-xxx.up.railway.app/ws`             |
| Gateway Health   | `https://gateway-xxx.up.railway.app/health`       |
| Markets API      | `https://gateway-xxx.up.railway.app/api/markets`  |
| Leaderboard API  | `https://gateway-xxx.up.railway.app/api/leaderboard` |

---

## Quick Reference: Railway Service Config Summary

| Service  | Root Directory    | Build                        | Start         |
|----------|-------------------|------------------------------|---------------|
| gateway  | `backend/gateway` | `npm install && npm run build` | `npm start` |
| indexer  | `backend/indexer` | `npm install && npm run build` | `npm start` |
| keeper   | `backend/keeper`  | `npm install && npm run build` | `npm start` |

---

## Estimated Railway Cost

| Service  | RAM   | CPU    | Est. $/month |
|----------|-------|--------|--------------|
| gateway  | 256MB | shared | ~$1-2        |
| indexer  | 256MB | shared | ~$1-2        |
| keeper   | 256MB | shared | ~$1-2        |
| postgres | 1GB   | shared | ~$5          |
| **Total**|       |        | **~$8-11**   |

Railway's Hobby plan costs $5/month base + usage. With the 3 services above at low traffic it fits comfortably within $10-15/month. The free Starter plan provides $5 of usage credit per month which may cover initial testing.
