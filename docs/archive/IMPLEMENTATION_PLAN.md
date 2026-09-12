# BitDrum Somnia Implementation Plan

**Target**: Complete, production-ready BitDrum system on Somnia EVM Chain (Chain ID: 5031)  
**Timeline**: Phased development with dependency ordering  
**Last Updated**: 2026-04-03

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Phase Overview](#2-phase-overview)
3. [Phase 1: Foundation & Contract Layer](#3-phase-1-foundation--contract-layer)
4. [Phase 2: Backend Infrastructure](#4-phase-2-backend-infrastructure)
5. [Phase 3: Frontend Development](#5-phase-3-frontend-development)
6. [Phase 4: Integration & Testing](#6-phase-4-integration--testing)
7. [Phase 5: Security & Launch](#7-phase-5-security--launch)
8. [Git Commit Strategy](#8-git-commit-strategy)
9. [Environment & Deployment](#9-environment--deployment)
10. [Success Criteria](#10-success-criteria)

---

## 1. Executive Summary

**Current State**: BitDrum is architectured for Starknet (Cairo VM, Starkzap SDK, Pragma Oracle, STRK gas).

**Target State**: BitDrum fully migrated to Somnia EVM (Solidity, Ethers.js v6, DIA/Protofire Oracles, SOMI gas).

**Scope**: Complete rewrite of:
- Smart Contracts (Solidity)
- Keeper Bot (Ethers.js)
- API Gateway & Indexer (Somnia event listeners)
- Frontend (Privy + Wagmi wallet integration)
- Deployment & Environment orchestration

**Key Principles**:
- **Protocol Logic Unchanged** — All market mechanics, POM calculations, settlement rules remain identical.
- **Incremental Testability** — Each phase ships a working state before moving to the next.
- **Gas Optimization** — Leverage Somnia's 1M+ TPS and sub-second finality for seamless UX.
- **Non-Custodial Architecture** — No component ever holds unilateral control of user funds.

---

## 2. Phase Overview

| Phase | Focus | Duration | Dependencies |
|-------|-------|----------|--------------|
| **Phase 1** | Smart Contracts + Local Testing | Weeks 1-2 | None |
| **Phase 2** | Backend Services (Keeper, Indexer, Gateway) | Weeks 2-3 | Phase 1 contracts deployed |
| **Phase 3** | Frontend UI + Wallet Integration | Weeks 3-4 | Phase 2 services running |
| **Phase 4** | End-to-End Integration & QA | Week 5 | All prior phases complete |
| **Phase 5** | Security Audit + Mainnet Launch | Week 6+ | Phase 4 green light |

**Parallel Workstreams** (can begin independently):
- Phase 1: Contract development + local testing
- Phase 2: Backend services architecture
- Phase 3: Frontend mockups and component library setup

---

## 3. Phase 1: Foundation & Contract Layer

### 3.1 Objective

Deploy a fully functional set of immutable Solidity smart contracts to Somnia Shannon Testnet (Chain ID: 50312). These contracts form the foundation for all subsequent layers.

### 3.2 Prerequisites

- [ ] Foundry installed: `curl -L https://foundry.paradigm.xyz | bash && foundryup`
- [ ] Node.js 20+ installed
- [ ] Access to [Somnia Shannon Testnet RPC](https://dream-rpc.somnia.network)
- [ ] Somnia testnet account with STT for gas (~1 STT required)

### 3.3 Steps

#### 3.3.1 Initialize Foundry Project

```bash
cd contracts
forge init . --force
```

**Git Commit**: `chore: init foundry project for solidity contracts`

---

#### 3.3.2 Configure Foundry for Somnia

**File**: `foundry.toml`

```toml
[profile.default]
src = "src"
out = "out"
libs = ["lib"]
remappings = [
  "@openzeppelin/contracts=lib/openzeppelin-contracts/contracts",
]
solc_version = "0.8.20"

[rpc_endpoints]
shannon = "https://dream-rpc.somnia.network"
mainnet = "https://api.infra.mainnet.somnia.network"

[etherscan]
shannon = { key = "", url = "https://shannon-explorer.somnia.network/api" }
mainnet = { key = "", url = "https://explorer.somnia.network/api" }

[fmt]
line_length = 120
wrap_comments = true
```

Add OpenZeppelin contracts:
```bash
forge install OpenZeppelin/openzeppelin-contracts --no-commit
```

**Git Commit**: `chore: configure foundry and add openzeppelin lib`

---

#### 3.3.3 Implement Core Contracts

Create the following Solidity contracts in `src/`:

##### **3.3.3.1 PredictionMarket.sol** — Market lifecycle & state management

**Location**: `src/PredictionMarket.sol`

**Responsibilities**:
- Accept market openings (direction, duration, strike price)
- Record strikes on-chain via DIA Oracle
- Track participant stakes during joining window
- Lock market at expiry of joining window
- Enforce state transitions: OPEN → LOCKED → SETTLED → CLAIMABLE → CLOSED

**Key Functions**:
```solidity
function openMarket(
    Direction direction,
    uint256 durationSeconds,
    uint256 stakeAmount,
    OracleData calldata strikeData
) external returns (uint256 marketId);

function joinMarket(
    uint256 marketId,
    Direction direction,
    uint256 stakeAmount
) external;

function lockMarket(uint256 marketId) external;
```

**Estimated LOC**: ~350 lines

**Git Commit**: `feat: implement PredictionMarket.sol core logic`

---

##### **3.3.3.2 SettlementEngine.sol** — Oracle-driven settlement & payout logic

**Location**: `src/SettlementEngine.sol`

**Responsibilities**:
- Receive settlement transactions from Keeper bot
- Verify oracle price freshness (≤30 seconds old)
- Compare final price to strike price
- Determine outcome: UP / DOWN / DRAW
- Apply POM profit percentage
- Route 2% protocol fees to Treasury

**Key Functions**:
```solidity
function settle(
    uint256 marketId,
    uint128 finalPrice,
    uint128 priceTimestamp
) external onlyKeeper;
```

**Estimated LOC**: ~250 lines

**Git Commit**: `feat: implement SettlementEngine.sol oracle settlement logic`

---

##### **3.3.3.3 LiquidityVault.sol** — Counterparty funding & winner payouts

**Location**: `src/LiquidityVault.sol`

**Responsibilities**:
- Auto-stake on opposite side of market opener
- Absorb 100% of losing stakes
- Fund winner profits (up to 70% of stake)
- Track vault balance and replenishment

**Estimated LOC**: ~200 lines

**Git Commit**: `feat: implement LiquidityVault.sol counterparty & funding logic`

---

##### **3.3.3.4 Treasury.sol** — Protocol fees & allocation

**Location**: `src/Treasury.sol`

**Responsibilities**:
- Accumulate 2% protocol fees from settled markets
- Allocate: 40% vault replenishment, 35% AI fund, 25% reserves

**Estimated LOC**: ~150 lines

**Git Commit**: `feat: implement Treasury.sol fee allocation`

---

##### **3.3.3.5 LeaderboardRegistry.sol** — Append-only trader stats

**Location**: `src/LeaderboardRegistry.sol`

**Responsibilities**:
- Record per-wallet win/loss/P&L on settlement
- Immutable append-only store
- Read by Social Indexer, AI Agent, frontend

**Estimated LOC**: ~120 lines

**Git Commit**: `feat: implement LeaderboardRegistry.sol on-chain stats`

---

##### **3.3.3.6 SubscriptionsContract.sol** — Signal tier management

**Location**: `src/SubscriptionsContract.sol`

**Responsibilities**:
- Manage Signal Pro / Signal Elite subscriptions
- Track tier expiry per wallet
- Route payments to Signal Revenue Pool

**Estimated LOC**: ~140 lines

**Git Commit**: `feat: implement SubscriptionsContract.sol tier gating`

---

#### 3.3.4 Implement Oracle Interfaces

**Location**: `src/interfaces/IOracle.sol`

```solidity
interface IOracle {
    function getValue(string calldata pair) external view returns (uint128 price, uint128 timestamp);
}
```

Implement adapters for DIA and Protofire with fallback logic.

**Git Commit**: `feat: implement oracle adapters (DIA + Protofire)`

---

#### 3.3.5 Write Comprehensive Tests

**Location**: `test/`

Create test files:
- `test/PredictionMarket.t.sol` — Market lifecycle (open → join → lock → settle → claim)
- `test/SettlementEngine.t.sol` — Settlement with multiple outcomes (UP/DOWN/DRAW)
- `test/LiquidityVault.t.sol` — Vault funding under edge cases (100% one side, POM variations)
- `test/Treasury.t.sol` — Fee allocation
- `test/Integration.t.sol` — End-to-end market flow

**Coverage Target**: ≥90% line coverage

```bash
forge coverage
```

**Git Commit**: `test: add comprehensive unit and integration tests (90%+ coverage)`

---

#### 3.3.6 Deploy to Somnia Shannon Testnet

**Setup**:
```bash
export PRIVATE_KEY=0x...  # Your testnet account private key
export SHANNON_RPC=https://dream-rpc.somnia.network
```

**Deploy script** — `script/Deploy.s.sol`:
```solidity
// Deploy all contracts in dependency order
// Output addresses to deployments/shannon.json
```

**Execute**:
```bash
forge script script/Deploy.s.sol \
  --rpc-url $SHANNON_RPC \
  --private-key $PRIVATE_KEY \
  --broadcast
```

**Verify**:
```bash
forge verify-contract <contract_address> \
  --rpc-url $SHANNON_RPC \
  --verifier blockscout \
  --verifier-url https://shannon-explorer.somnia.network/api
```

**Expected Output**: `deployments/shannon.json` containing all contract addresses

**Git Commit**: `deploy: testnet contracts to somnia shannon (initial deploy)`

Record contract addresses in `DEPLOYMENT_ADDRESSES.md`:
```markdown
# Somnia Shannon Testnet Deployment

- PredictionMarket: 0x...
- SettlementEngine: 0x...
- LiquidityVault: 0x...
- Treasury: 0x...
- LeaderboardRegistry: 0x...
- SubscriptionsContract: 0x...
- WBTC: 0x... (or use external Somnia WBTC)
- DIA Oracle: 0x...
```

**Git Commit**: `docs: record shannon testnet deployment addresses`

---

#### 3.3.7 Sanity Check — OpenMarket Transaction

```bash
cast send \
  --rpc-url $SHANNON_RPC \
  --private-key $PRIVATE_KEY \
  <PREDICTION_MARKET_ADDRESS> \
  "openMarket(uint8,uint256,uint256,(uint128,uint128))" \
  1 \  # Direction.UP
  60 \  # 1 minute duration
  100000000 \  # 0.001 WBTC (in smallest unit)
  "(50000000000, $(date +%s))"  # Strike price & timestamp
```

Verify transaction succeeds and market ID is emitted.

**Git Commit**: `test: verify contract deployment with sanity check txn`

---

### 3.4 Phase 1 Deliverables

- ✅ Foundry project initialized with OpenZeppelin libs
- ✅ 6 core Solidity contracts implemented (1,200+ LOC)
- ✅ Oracle adapters for DIA + Protofire
- ✅ ≥90% test coverage with unit + integration tests
- ✅ Contracts deployed to Somnia Shannon Testnet
- ✅ Deployment addresses recorded in version control
- ✅ Sanity check transaction confirmed on-chain

**Phase 1 Git Commits**: ~12 commits

**Branch**: `phase-1-contracts`

---

## 4. Phase 2: Backend Infrastructure

### 4.1 Objective

Implement the five backend services that automate market settlement, index on-chain events, generate AI signals, and expose a unified API.

### 4.2 Services Overview

| Service | Language | Role | Port |
|---------|----------|------|------|
| **Keeper Bot** | Node.js / TS | Polls Somnia every 3s, triggers settlement | N/A (async) |
| **Social Indexer** | Node.js / TS | Listens to events, builds leaderboard | N/A (async) |
| **AI Agent** | Python / FastAPI | Signal inference + POM calc | 8000 |
| **API Gateway** | Node.js / Express | REST + WebSocket aggregation | 3001 |
| **Subscription Distributor** | Node.js / TS | Monthly ORACLE reward payout | N/A (cron) |

### 4.3 Prerequisites

- [ ] PostgreSQL 16+ running locally or cloud-hosted
- [ ] Redis instance (local or cloud)
- [ ] Node.js 20+
- [ ] Python 3.11+
- [ ] `.env` template ready for each service

### 4.4 Steps

---

#### 4.4.1 Keeper Bot — Ethers.js Settlement Automation

**Location**: `backend/keeper/`

**Responsibilities**:
- Poll Somnia RPC every 3 seconds for expired markets
- Fetch signed price from DIA Oracle
- Fallback to Protofire if DIA is stale
- Submit `settle()` transaction to SettlementEngine
- Emit event to event bus for Social Indexer + AI Agent

**Setup**:

```bash
cd backend/keeper
npm init -y
npm install ethers@6 dotenv zod pino pino-pretty
npm install -D typescript ts-node @types/node
```

**Core Implementation** — `src/index.ts`:

```typescript
import { ethers } from 'ethers';

const provider = new ethers.JsonRpcProvider(process.env.SOMNIA_RPC_URL);
const keeperSigner = new ethers.Wallet(process.env.KEEPER_PRIVATE_KEY, provider);
const settlement = new ethers.Contract(
  process.env.SETTLEMENT_ENGINE_ADDR,
  SETTLEMENT_ABI,
  keeperSigner
);
const diaOracle = new ethers.Contract(
  process.env.DIA_ORACLE_ADDR,
  ORACLE_ABI,
  provider
);

async function runLoop() {
  const now = Math.floor(Date.now() / 1000);
  const expiredMarkets = await settlement.getExpiredMarkets(now);

  for (const marketId of expiredMarkets) {
    // Fetch price from DIA
    let priceData;
    try {
      const [price, timestamp] = await diaOracle.getValue('BTC/USD');
      if (now - Number(timestamp) > 30) throw new Error('stale');
      priceData = { price, timestamp };
    } catch (_) {
      // Fallback to Protofire
      const [price, timestamp] = await protofireOracle.getLatestAnswer();
      priceData = { price, timestamp };
    }

    // Submit settlement
    const tx = await settlement.settle(marketId, priceData.price, priceData.timestamp);
    const receipt = await tx.wait();
    console.log(`Settled market ${marketId} in tx ${receipt.transactionHash}`);
    
    // Emit to event bus
    eventBus.emit('marketSettled', { marketId, ...priceData });
  }
}

setInterval(runLoop, 3000);
```

**Create** `.env`:

```env
SOMNIA_RPC_URL=https://dream-rpc.somnia.network
SETTLEMENT_ENGINE_ADDR=0x...
DIA_ORACLE_ADDR=0x...
PROTOFIRE_ORACLE_ADDR=0x...
KEEPER_PRIVATE_KEY=0x...
KEEPER_STATE_FILE=data/keeper-state.json
POLLING_INTERVAL=3000
```

**Add to package.json**:
```json
{
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "ts-node src/index.ts"
  }
}
```

**Test locally** (against Somnia Shannon):
```bash
npm run dev
# Should output: "Polling for expired markets..." every 3s
```

**Git Commit**: `feat(keeper): implement ethers.js settlement automation`

---

#### 4.4.2 Social Indexer — Event Listener + Leaderboard Builder

**Location**: `backend/indexer/`

**Responsibilities**:
- Listen to PredictionMarket, SettlementEngine, LeaderboardRegistry events
- Store market history, trader stats, leaderboard snapshots in PostgreSQL
- Compute weekly/all-time rankings
- Cache in Redis for fast API lookups

**Setup**:

```bash
cd backend/indexer
npm init -y
npm install ethers@6 pg redis dotenv zod pino
npm install -D typescript ts-node @types/node @types/pg
```

**Database Schema** — `db/schema.sql`:

```sql
CREATE TABLE markets (
  id SERIAL PRIMARY KEY,
  market_id TEXT UNIQUE NOT NULL,
  opener_address TEXT NOT NULL,
  direction VARCHAR(4) NOT NULL,  -- UP or DOWN
  strike_price BIGINT NOT NULL,
  staking_token TEXT NOT NULL,
  pool_up BIGINT NOT NULL DEFAULT 0,
  pool_down BIGINT NOT NULL DEFAULT 0,
  outcome VARCHAR(4),  -- UP, DOWN, or DRAW
  pom_profit_bps INT,
  created_at TIMESTAMP DEFAULT NOW(),
  settled_at TIMESTAMP
);

CREATE TABLE trader_stats (
  id SERIAL PRIMARY KEY,
  wallet_address TEXT UNIQUE NOT NULL,
  markets_entered INT DEFAULT 0,
  wins INT DEFAULT 0,
  losses INT DEFAULT 0,
  net_pnl_btc DECIMAL(18, 8) DEFAULT 0,
  avg_stake DECIMAL(18, 8) DEFAULT 0,
  tier VARCHAR(12) DEFAULT 'SCOUT',  -- ORACLE, PROPHET, TRADER, SCOUT
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE signal_log (
  id SERIAL PRIMARY KEY,
  market_id TEXT NOT NULL,
  signal_direction VARCHAR(10) NOT NULL,  -- UP, DOWN, NEUTRAL
  confidence INT NOT NULL,
  generated_at TIMESTAMP DEFAULT NOW(),
  outcome VARCHAR(4),  -- Once market settles
  correct BOOLEAN
);

CREATE INDEX idx_markets_outcome ON markets(outcome);
CREATE INDEX idx_trader_stats_tier ON trader_stats(tier);
CREATE INDEX idx_signal_log_market ON signal_log(market_id);
```

**Core Implementation** — `src/index.ts`:

```typescript
import { ethers } from 'ethers';
import { Client } from 'pg';
import { createClient } from 'redis';

const provider = new ethers.JsonRpcProvider(process.env.SOMNIA_RPC_URL);
const leaderboard = new ethers.Contract(
  process.env.LEADERBOARD_REGISTRY_ADDR,
  LEADERBOARD_ABI,
  provider
);

const db = new Client({ /* postgres config */ });
const redis = createClient({ /* redis config */ });

// Listen to OutcomeRecorded event
leaderboard.on('OutcomeRecorded', async (trader, won, stakeAmount, profitAmount) => {
  await db.query(
    `INSERT INTO trader_stats (wallet_address, markets_entered, wins, losses, net_pnl_btc)
     VALUES ($1, 1, $2, $3, $4)
     ON CONFLICT (wallet_address) DO UPDATE SET
       markets_entered = trader_stats.markets_entered + 1,
       wins = trader_stats.wins + $2,
       losses = trader_stats.losses + $3,
       net_pnl_btc = trader_stats.net_pnl_btc + $4`,
    [trader, won ? 1 : 0, won ? 0 : 1, won ? profitAmount : -stakeAmount]
  );
  
  // Invalidate cache
  await redis.del('leaderboard:cache');
});

// Compute leaderboard tiers weekly
async function computeLeaderboards() {
  const topTraders = await db.query(`
    SELECT wallet_address,
           (wins::float / (wins + losses)) AS win_rate,
           ROW_NUMBER() OVER (ORDER BY net_pnl_btc DESC) AS rank
    FROM trader_stats WHERE markets_entered >= 10
    ORDER BY rank
  `);

  for (const row of topTraders.rows) {
    let tier = 'SCOUT';
    if (row.rank <= topTraders.rows.length * 0.01) tier = 'ORACLE';
    else if (row.rank <= topTraders.rows.length * 0.05) tier = 'PROPHET';
    else if (row.rank <= topTraders.rows.length * 0.20) tier = 'TRADER';

    await db.query(
      `UPDATE trader_stats SET tier = $1 WHERE wallet_address = $2`,
      [tier, row.wallet_address]
    );
  }

  await redis.del('leaderboard:cache');
}

// Run weekly
setInterval(computeLeaderboards, 7 * 24 * 60 * 60 * 1000);

await db.connect();
await redis.connect();
```

**Create** `.env`:

```env
SOMNIA_RPC_URL=https://dream-rpc.somnia.network
LEADERBOARD_REGISTRY_ADDR=0x...
PREDICTION_MARKET_ADDR=0x...
DATABASE_URL=postgres://user:password@localhost/bitdrum
REDIS_URL=redis://localhost:6379
```

**Initialize DB**:
```bash
npm run db:init  # Runs db/schema.sql
npm run dev
```

**Git Commit**: `feat(indexer): implement event listener + leaderboard computation`

---

#### 4.4.3 API Gateway — REST + WebSocket Aggregation

**Location**: `backend/gateway/`

**Responsibilities**:
- Expose REST endpoints for markets, signals, leaderboards, subscriptions
- Gate Signal Pro/Elite features based on on-chain subscription tier
- Broadcast real-time updates via WebSocket
- Proxy requests to AI Agent, Social Indexer

**Setup**:

```bash
cd backend/gateway
npm init -y
npm install express ethers@6 dotenv zod cors ws pino
npm install -D typescript ts-node @types/express @types/node
```

**Core Implementation** — `src/index.ts`:

```typescript
import express from 'express';
import { WebSocketServer } from 'ws';
import { ethers } from 'ethers';

const app = express();
const subscriptions = new ethers.Contract(
  process.env.SUBSCRIPTIONS_ADDR,
  SUBSCRIPTIONS_ABI,
  provider
);

// Subscription tier gating middleware
async function gateSignal(req, res, next) {
  const userAddress = req.query.user || req.headers['x-wallet'];
  const tier = await subscriptions.subscriptions(userAddress);
  req.userTier = tier.tier;
  next();
}

// REST Endpoints
app.get('/api/markets', async (req, res) => {
  const markets = await db.query('SELECT * FROM markets WHERE outcome IS NULL');
  res.json(markets.rows);
});

app.get('/api/signals/:marketId', gateSignal, async (req, res) => {
  const signal = await aiAgent.getSignal(req.params.marketId);
  
  if (req.userTier < 1) {  // Free tier
    return res.json({ direction: signal.direction });
  }
  if (req.userTier < 2) {  // Pro tier
    return res.json(signal);  // Full signal without elite features
  }
  
  // Elite tier
  return res.json({ ...signal, oracleAlerts: true });
});

app.get('/api/leaderboard', async (req, res) => {
  const cached = await redis.get('leaderboard:cache');
  if (cached) return res.json(JSON.parse(cached));
  
  const rows = await db.query(`
    SELECT wallet_address, tier, wins, losses, net_pnl_btc
    FROM trader_stats
    ORDER BY tier DESC, net_pnl_btc DESC
    LIMIT 100
  `);
  
  await redis.set('leaderboard:cache', JSON.stringify(rows.rows), { EX: 300 });
  res.json(rows.rows);
});

// WebSocket for real-time updates
const wss = new WebSocketServer({ noServer: true });
app.listen(3001, () => console.log('Gateway running on :3001'));
```

**Git Commit**: `feat(gateway): implement REST + WebSocket aggregation`

---

#### 4.4.4 AI Agent — Signal Inference + POM Engine

**Location**: `backend/ai-agent/`

**Responsibilities**:
- Receive market data from Social Indexer
- Compute directional signal (UP/DOWN/NEUTRAL) using ONNX classifier
- Generate confidence score
- Produce natural-language rationale (OpenAI or template-based)
- Calculate POM (5-70%) based on market conditions
- Expose FastAPI endpoints for Gateway

**Setup**:

```bash
cd backend/ai-agent
python3 -m venv .venv
source .venv/bin/activate
pip install fastapi uvicorn onnxruntime postgresql psycopg2-binary redis openai pydantic
```

**Core Implementation** — `main.py`:

```python
from fastapi import FastAPI, Query
from fastapi.responses import JSONResponse
import onnxruntime as rt
from typing import Optional
import numpy as np

app = FastAPI()

# Load ONNX model (pre-trained time-series classifier)
sess = rt.InferenceSession("models/signal_classifier.onnx")

@app.get("/signals/{market_id}")
async def get_signal(market_id: str, user_address: Optional[str] = None):
    """Generate AI signal for a market"""
    
    # Fetch market context from DB
    market = db.query(
        "SELECT * FROM markets WHERE market_id = %s",
        (market_id,)
    )[0]
    
    # Extract features
    top_traders = db.query(
        "SELECT * FROM trader_stats WHERE tier IN ('ORACLE', 'PROPHET')"
    )
    
    features = np.array([
        market['pool_up'] / (market['pool_up'] + market['pool_down']),
        market['price_volatility_1m'],
        market['price_volatility_5m'],
        len([t for t in top_traders if t['last_staked_direction'] == 'UP']) / len(top_traders),
    ]).reshape(1, -1).astype(np.float32)
    
    # Infer signal direction
    output = sess.run(None, {'features': features})
    direction_prob = output[0][0]  # Probability UP
    
    direction = "UP" if direction_prob > 0.5 else "DOWN"
    confidence = int(abs((direction_prob - 0.5) * 2) * 100)
    
    # Generate rationale
    if confidence > 70:
        intensity = "strong"
    elif confidence > 50:
        intensity = "moderate"
    else:
        intensity = "weak"
    
    rationale = f"{intensity.capitalize()} {direction} signal. {len([t for t in top_traders if t['last_staked_direction'] == direction])} qualifying traders positioned {direction}."
    
    return JSONResponse({
        "market_id": market_id,
        "signal": {
            "direction": direction,
            "confidence": confidence,
            "rationale": rationale,
            "generated_at": datetime.utcnow().isoformat()
        }
    })

@app.get("/pom/{market_id}")
async def get_pom(market_id: str):
    """Calculate Probable Outcome Multiplier for market"""
    
    market = db.query("SELECT * FROM markets WHERE market_id = %s", (market_id,))[0]
    
    # POM formula inputs
    pool_imbalance = abs(market['pool_up'] - market['pool_down']) / (market['pool_up'] + market['pool_down'])
    volatility = market['price_volatility_1m']  # ATR-based
    top_trader_alignment = 0.75  # Example: 75% of ORACLE traders agree on direction
    
    # Weighted calculation
    raw_pom = (
        pool_imbalance * 0.30 +
        volatility * 0.25 +
        top_trader_alignment * 0.25 +
        time_of_day_factor * 0.10 +
        signal_confidence * 0.10
    )
    
    # Clamp between 5% and 70%
    profit_pct = max(0.05, min(0.70, 0.05 + (raw_pom * 0.65)))
    
    return JSONResponse({
        "market_id": market_id,
        "pom_profit_bps": int(profit_pct * 10000),
        "pom_percentage": profit_pct
    })

@app.get("/health")
async def health():
    return {"status": "ok"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
```

**Create** `.env`:

```env
DATABASE_URL=postgres://user:password@localhost/bitdrum
REDIS_URL=redis://localhost:6379
OPENAI_API_KEY=sk-...  (optional)
GATEWAY_URL=http://localhost:3001/api
```

**Run**:
```bash
python main.py
# Health check: curl http://localhost:8000/health
```

**Git Commit**: `feat(ai-agent): implement signal inference + POM calculation`

---

#### 4.4.5 Subscription Distributor — Monthly ORACLE Reward Payout

**Location**: `backend/subscription-distributor/`

**Responsibilities**:
- Monthly trigger (first day of month)
- Query ORACLE-tier traders from Social Indexer
- Calculate proportional shares from Signal Elite revenue pool
- Submit batch payout transaction to Somnia

**Setup**:

```bash
cd backend/subscription-distributor
npm init -y
npm install ethers@6 pg redis dotenv pino
npm install -D typescript ts-node @types/node
```

**Core Implementation** — `src/distributor.ts`:

```typescript
import { ethers } from 'ethers';

async function distributeMonthlyRewards() {
  // Query ORACLE traders
  const oracleTraders = await db.query(
    `SELECT wallet_address, net_pnl_btc FROM trader_stats WHERE tier = 'ORACLE'`
  );
  
  if (oracleTraders.rows.length === 0) return;
  
  // Calculate total Signal Elite revenue for this month
  const totalRevenue = await db.query(
    `SELECT SUM(amount) as total FROM signal_elite_subscriptions 
     WHERE created_at >= DATE_TRUNC('month', NOW() - INTERVAL '1 month')`
  );
  
  const revenueShare = totalRevenue.rows[0].total * 0.20;  // 20% to ORACLE tier
  const sharePerTrader = revenueShare / oracleTraders.rows.length;
  
  // Build batch payout transaction
  const recipients = oracleTraders.rows.map(r => r.wallet_address);
  const amounts = oracleTraders.rows.map(_ => ethers.parseUnits(sharePerTrader.toString(), 8));
  
  const tx = await treasury.batchDistribute(recipients, amounts);
  await tx.wait();
  
  console.log(`Distributed ${revenueShare} WBTC to ${recipients.length} ORACLE traders`);
}

// Cron: First day of month at 00:00 UTC
const job = cron.schedule('0 0 1 * *', distributeMonthlyRewards);
```

**Git Commit**: `feat(subscription-distributor): implement monthly ORACLE rewards distribution`

---

### 4.5 Phase 2 Integration Testing

Create an end-to-end integration test:

**Test Scenario**:
1. Open a market from testnet account
2. Wait 3 seconds → Keeper detects expiry
3. Keeper fetches DIA price + submits settlement
4. Social Indexer processes settlement event
5. Leaderboard updated in DB
6. API Gateway serves updated trader stats

```bash
npm run test:integration
# Should pass in < 30 seconds on testnet
```

**Git Commit**: `test: add phase 2 integration tests (keeper + indexer + api)`

---

### 4.6 Phase 2 Deliverables

- ✅ 5 backend microservices implemented (1,500+ LOC)
- ✅ PostgreSQL schema for leaderboard + market history
- ✅ Redis caching layer for API performance
- ✅ Keeper bot settled ≥1 market on Somnia Shannon
- ✅ Social Indexer indexed ≥5 on-chain events
- ✅ API Gateway exposing ≥10 REST endpoints
- ✅ AI Agent generating signals for live markets
- ✅ Subscription Distributor logic tested locally
- ✅ End-to-end integration test passing

**Phase 2 Git Commits**: ~8 commits

**Branch**: `phase-2-backend`

---

## 5. Phase 3: Frontend Development

### 5.1 Objective

Build a fully functional Next.js frontend with:
- Market feed + live price chart
- Trading UI (stake panel)
- Leaderboard + trader profiles
- Wallet connection (Privy + MetaMask/Rainbow Kit)
- Real-time signal + POM updates via WebSocket

### 5.2 Prerequisites

- [ ] Node.js 20+ installed
- [ ] Frontend design mockups reviewed (Figma links or design specs)
- [ ] API Gateway running locally (`npm run dev` from backend/gateway)

### 5.3 Steps

---

#### 5.3.1 Initialize Next.js Project

```bash
cd frontend
npx create-next-app@latest . \
  --typescript \
  --tailwind \
  --app-router \
  --no-src-dir \
  --eslint
```

**Git Commit**: `chore: init next.js 14 + tailwind + typescript`

---

#### 5.3.2 Install Core Dependencies

```bash
npm install ethers@6 wagmi viem @wagmi/core @rainbow-me/rainbowkit @privy-io/react-auth
npm install zustand react-query recharts date-fns
npm install -D typescript eslint prettier
```

**Git Commit**: `chore: install ethers + wagmi + privy dependencies`

---

#### 5.3.3 Configure Wagmi + Privy for Somnia

**File**: `lib/wagmi-config.ts`

```typescript
import { createConfig, http } from 'wagmi';
import { defineChain } from 'viem';
import { walletConnect, injected, rainbowWallet } from 'wagmi/connectors';

export const somnia = defineChain({
  id: 5031,
  name: 'Somnia',
  nativeCurrency: { name: 'SOMI', symbol: 'SOMI', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://api.infra.mainnet.somnia.network'] },
    public: { http: ['https://api.infra.mainnet.somnia.network'] },
  },
  blockExplorers: {
    default: { name: 'Somnia Explorer', url: 'https://explorer.somnia.network' },
  },
  testnet: false,
});

export const somniaShannon = defineChain({
  id: 50312,
  name: 'Somnia Shannon',
  nativeCurrency: { name: 'STT', symbol: 'STT', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://dream-rpc.somnia.network'] },
    public: { http: ['https://dream-rpc.somnia.network'] },
  },
  blockExplorers: {
    default: { name: 'Somnia Shannon Explorer', url: 'https://shannon-explorer.somnia.network' },
  },
  testnet: true,
});

export const wagmiConfig = createConfig({
  chains: [process.env.NEXT_PUBLIC_CHAIN_ID === '50312' ? somniaShannon : somnia],
  connectors: [
    walletConnect({ projectId: process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID }),
    injected(),
    rainbowWallet(),
  ],
  transports: {
    [somnia.id]: http(),
    [somniaShannon.id]: http(),
  },
});
```

**File**: `lib/privy-config.ts`

```typescript
import { PrivyProvider } from '@privy-io/react-auth';
import { somnia, somniaShannon } from './wagmi-config';

export function PrivyConfig({ children }) {
  const chainId = process.env.NEXT_PUBLIC_CHAIN_ID === '50312' ? somniaShannon.id : somnia.id;
  
  return (
    <PrivyProvider
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID}
      config={{
        defaultChain: chainId === somniaShannon.id ? somniaShannon : somnia,
        supportedChains: [chainId === somniaShannon.id ? somniaShannon : somnia],
        externalWallets: {
          rainbowkit: true,
        },
      }}
    >
      {children}
    </PrivyProvider>
  );
}
```

**Git Commit**: `config: setup wagmi + privy for somnia chain`

---

#### 5.3.4 Create Layout + Providers

**File**: `app/layout.tsx`

```typescript
import { Providers } from '@/components/Providers';
import './globals.css';

export const metadata = {
  title: 'BitDrum — Intelligent Prediction Markets',
  description: 'Trade Bitcoin with AI signals on Somnia',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

**File**: `components/Providers.tsx`

```typescript
'use client';

import { WagmiProvider } from 'wagmi';
import { RainbowKitProvider } from '@rainbow-me/rainbowkit';
import { PrivyConfig } from '@/lib/privy-config';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { wagmiConfig } from '@/lib/wagmi-config';

const queryClient = new QueryClient();

export function Providers({ children }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          <PrivyConfig>{children}</PrivyConfig>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
```

**Git Commit**: `config: setup next.js layout + wagmi/privy providers`

---

#### 5.3.5 Implement Market Feed Page

**File**: `app/page.tsx`

```typescript
'use client';

import { useEffect, useState } from 'react';
import { TradingDashboard } from '@/components/TradingDashboard';
import { SocialFeed } from '@/components/SocialFeed';
import { useAccount } from 'wagmi';

export default function Home() {
  const { address, isConnected } = useAccount();
  const [markets, setMarkets] = useState([]);

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/markets`)
      .then(r => r.json())
      .then(setMarkets);
  }, []);

  if (!isConnected) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-4">BitDrum</h1>
          <p className="text-lg mb-8">Connect your wallet to start trading</p>
          <ConnectButton />
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-4 p-8">
      <div className="col-span-2">
        <TradingDashboard markets={markets} />
      </div>
      <div>
        <SocialFeed />
      </div>
    </div>
  );
}
```

**Git Commit**: `feat(frontend): implement home page + market feed`

---

#### 5.3.6 Implement Core Components

Create the following components in `components/`:

##### **5.3.6.1 TradingDashboard.tsx** — Market list + BTC chart

```typescript
// Live market feed + real-time price chart
// Show: Market ID, Strike Price, Countdown, Pool Sizes, AI Signal, POM
// Action: "Stake UP" / "Stake DOWN" button
```

**Git Commit**: `feat(frontend): implement TradingDashboard component`

---

##### **5.3.6.2 TradePanel.tsx** — Stake input + execution

```typescript
// Input: stake amount in WBTC
// Display: Expected WIN payout, Expected LOSS (0)
// Action: Approve WBTC + Join Market transaction
// Uses wagmi useContractWrite hook
```

**Git Commit**: `feat(frontend): implement TradePanel component`

---

##### **5.3.6.3 PriceChart.tsx** — TradingView Lightweight Charts

```typescript
// Real-time candlestick chart for BTC/USD
// Mark strike price as horizontal line
// Update every 5 seconds from WebSocket
```

**Git Commit**: `feat(frontend): implement PriceChart via TradingView`

---

##### **5.3.6.4 LeaderboardPage.tsx** — Trader rankings

```typescript
// Display: Trader tier, Win Rate, P&L, Markets Entered
// Tier badges: ORACLE, PROPHET, TRADER, SCOUT
// Click trader → Profile page
```

**Git Commit**: `feat(frontend): implement Leaderboard page + tier badges`

---

##### **5.3.6.5 TraderProfile.tsx** — Individual trader stat view

```typescript
// Display: Wallet address, ENS name, tier, win-loss history
// Charts: P&L over time, win rate by duration
// Action: Follow / Unfollow (off-chain)
```

**Git Commit**: `feat(frontend): implement TraderProfile detail page`

---

##### **5.3.6.6 SignalPanel.tsx** — AI Signal display by tier

```typescript
// Free tier: Direction only (UP / DOWN)
// Pro tier: + Confidence % + Rationale
// Elite tier: + ORACLE trader positions + Early POM access
```

**Git Commit**: `feat(frontend): implement SignalPanel with tier gating`

---

#### 5.3.7 Implement Wallet Connection Flow

**File**: `components/WalletProvider.tsx`

```typescript
'use client';

import { useConnect, useAccount, useDisconnect } from 'wagmi';
import { usePrivy, useLogin } from '@privy-io/react-auth';

export function WalletProvider() {
  const { address, isConnected } = useAccount();
  const { connectors, connect } = useConnect();
  const { user } = usePrivy();
  const { login } = useLogin();

  if (isConnected && address) {
    return (
      <div className="flex items-center gap-4">
        <span className="text-sm">{address.slice(0, 6)}...{address.slice(-4)}</span>
        <DisconnectButton />
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <button onClick={() => login()}>Sign in with Privy (Social)</button>
      {connectors.map((connector) => (
        <button key={connector.uid} onClick={() => connect({ connector })}>
          Connect with {connector.name}
        </button>
      ))}
    </div>
  );
}
```

**Git Commit**: `feat(frontend): implement wallet connection flow (privy + wagmi)`

---

#### 5.3.8 Implement Real-Time WebSocket Connection

**File**: `lib/useWebSocket.ts`

```typescript
import { useEffect, useState } from 'react';

export function useWebSocket(url: string) {
  const [data, setData] = useState(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const ws = new WebSocket(url);

    ws.onopen = () => setConnected(true);
    ws.onmessage = (event) => setData(JSON.parse(event.data));
    ws.onclose = () => setConnected(false);

    return () => ws.close();
  }, [url]);

  return { data, connected };
}
```

**Usage in TradingDashboard.tsx**:
```typescript
const { data: signals } = useWebSocket(`${process.env.NEXT_PUBLIC_WS_URL}/signals`);
const { data: pomUpdates } = useWebSocket(`${process.env.NEXT_PUBLIC_WS_URL}/pom`);
```

**Git Commit**: `feat(frontend): implement websocket real-time updates`

---

#### 5.3.9 Environment Variables

**File**: `frontend/.env.local`

```env
NEXT_PUBLIC_CHAIN_ID=50312  # Shannon testnet initially
NEXT_PUBLIC_API_URL=http://localhost:3001/api
NEXT_PUBLIC_WS_URL=ws://localhost:3001/ws
NEXT_PUBLIC_PRIVY_APP_ID=...
NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=...
NEXT_PUBLIC_PREDICTION_MARKET_ADDR=0x...
NEXT_PUBLIC_WBTC_ADDR=0x...
```

**Git Commit**: `config: setup frontend environment variables`

---

#### 5.3.10 Test Frontend Locally

```bash
npm run dev
# Open http://localhost:3000
# Connect wallet → See live markets
# Click "Stake UP" → Confirm transaction on Somnia RPC
```

**Manual Test Checklist**:
- [ ] Wallet connection (Privy)
- [ ] Wallet connection (MetaMask / Rainbow Kit)
- [ ] Market feed displays
- [ ] Stake UP/DOWN executes transactions
- [ ] Leaderboard loads
- [ ] Signals display by tier
- [ ] WebSocket updates in real-time

**Git Commit**: `test: manual testing checklist + verified on testnet`

---

### 5.4 Phase 3 Deliverables

- ✅ Next.js 14 project with Tailwind + TypeScript
- ✅ Wagmi + Privy wallet integration for Somnia
- ✅ 6+ React components (Trading UI, Leaderboard, Signals, Profiles)
- ✅ Real-time WebSocket connections working
- ✅ End-to-end trade flow: Connect → Stake → Confirm → View Market
- ✅ Responsive design for desktop + mobile (Expo React Native TBD Phase 4)
- ✅ Manual testing on Somnia Shannon Testnet verified

**Phase 3 Git Commits**: ~15 commits

**Branch**: `phase-3-frontend`

---

## 6. Phase 4: Integration & Testing

### 6.1 Objective

Verify all layers work together end-to-end. Run smoke tests, performance benchmarks, and security checks.

### 6.2 Steps

---

#### 6.2.1 Full Stack Local Test

**Prerequisites**: All services running locally

```bash
# Terminal 1: Keeper Bot
cd backend/keeper && npm run dev

# Terminal 2: Social Indexer
cd backend/indexer && npm run dev

# Terminal 3: AI Agent
cd backend/ai-agent && python main.py

# Terminal 4: API Gateway
cd backend/gateway && npm run dev

# Terminal 5: Frontend
cd frontend && npm run dev

# Terminal 6: PostgreSQL + Redis (if not running as service)
docker-compose up postgres redis
```

**Expected**: All services healthy
```bash
curl http://localhost:3000  # Frontend loads
curl http://localhost:3001/api/health  # Gateway OK
curl http://localhost:8000/health  # AI Agent OK
```

**Git Commit**: `test: full-stack local integration test passing`

---

#### 6.2.2 Testnet E2E Workflow

**Scenario**: User opens market → Keeper settles → Leaderboard updates → Signal improves

```bash
# Step 1: Open market via frontend
# http://localhost:3000 → Connect wallet → Click "Create Market"

# Step 2: Verify keeper auto-settles (check logs)
# "Settled market 0x... in tx 0x..."

# Step 3: Verify indexer indexed event
# Check: SELECT * FROM markets WHERE market_id = 0x...

# Step 4: Verify leaderboard updated
# curl http://localhost:3001/api/leaderboard

# Step 5: Verify signal accuracy logged
# SELECT * FROM signal_log WHERE market_id = 0x... AND outcome IS NOT NULL
```

**Expected**: All steps complete in < 60 seconds

**Git Commit**: `test: e2e workflow verified on testnet`

---

#### 6.2.3 Performance & Load Testing

**Keeper Bot**: Settle ≥100 markets in parallel
```bash
# Deploy 100 markets to testnet
# Measure keeper settlement time per market
# Expected: < 5 seconds per market on Somnia (sub-second finality)
```

**API Gateway**: Handle ≥100 requests/second
```bash
# Load test: ab -n 10000 -c 100 http://localhost:3001/api/leaderboard
# Expected: 99% latency < 200ms
```

**Git Commit**: `test: performance benchmarks (keeper + api gateway)`

---

#### 6.2.4 Security Checklist

- [ ] No hardcoded private keys (use .env)
- [ ] No admin functions in contracts (immutable design)
- [ ] Oracle staleness protection verified (30s check)
- [ ] Keeper isolation tested (offline keeper = still-settling market)
- [ ] WBTC approval limits checked (per-market, not infinite)
- [ ] No reentrancy vulnerabilities in settlement
- [ ] Access control verified (only Settlement Engine can call Leaderboard)

**Git Commit**: `security: pre-audit checklist completed`

---

#### 6.2.5 Smoke Tests

**Location**: `tests/smoke.test.ts`

```typescript
describe('BitDrum Smoke Tests', () => {
  it('User can open a market', async () => { /* ... */ });
  it('User can join a market', async () => { /* ... */ });
  it('Keeper auto-settles expired market', async () => { /* ... */ });
  it('Winners claim correct payout', async () => { /* ... */ });
  it('Loser stake absorbed by vault', async () => { /* ... */ });
  it('Leaderboard tier computed correctly', async () => { /* ... */ });
  it('Signal accuracy logged on settlement', async () => { /* ... */ });
  it('API Gateway gates Signal Pro correctly', async () => { /* ... */ });
  it('WBTC subscription payment processed', async () => { /* ... */ });
  it('ORACLE reward distributed monthly', async () => { /* ... */ });
});

npm run test:smoke
```

**Expected**: All 10 tests pass
```
✓ User can open a market (2.3s)
✓ User can join a market (1.8s)
✓ Keeper auto-settles expired market (3.1s)
✓ Winners claim correct payout (1.9s)
✓ Loser stake absorbed by vault (2.0s)
✓ Leaderboard tier computed correctly (1.5s)
✓ Signal accuracy logged on settlement (1.2s)
✓ API Gateway gates Signal Pro correctly (0.8s)
✓ WBTC subscription payment processed (2.1s)
✓ ORACLE reward distributed monthly (1.9s)

============================
10 passing (18.6s)
```

**Git Commit**: `test: smoke tests (10/10 passing)`

---

### 6.3 Phase 4 Deliverables

- ✅ Full-stack running locally with all 5 backend services
- ✅ E2E workflow (market open → settlement → leaderboard) verified
- ✅ Performance benchmarks documented (keeper: <5s/market, API: <200ms p99)
- ✅ Security checklist completed
- ✅ 10 smoke tests passing
- ✅ No blocking issues or data inconsistencies

**Phase 4 Git Commits**: ~6 commits

**Branch**: `phase-4-integration`

---

## 7. Phase 5: Security & Launch

### 7.1 Objective

Obtain security audit sign-off, deploy to mainnet, and launch to users.

### 7.2 Steps

---

#### 7.2.1 Smart Contract Audit

**Option A: Third-Party Firm** (Recommended)
- Engage firm (e.g., CertiK, Trail of Bits, Zokyo)
- Provide codebase → 2-week audit
- Fix critical/high findings before launch
- Publish audit report (transparency)

**Option B: Internal Review**
- Pair review of all contract code
- Solidity static analysis: `slither contracts/src/`
- Manual verification of oracle staleness checks
- Reentrancy pattern verification

**Exit Criteria**:
- [ ] No critical findings
- [ ] All high findings fixed
- [ ] < 5 medium findings with mitigation plans
- [ ] Audit report (public or private)

**Git Commit**: `security: smart contract audit completed (findings addressed)`

---

#### 7.2.2 Backend Services Audit

**Checklist**:
- [ ] No SQL injection vulnerabilities (use parameterized queries)
- [ ] No unencrypted secrets in code (all via .env)
- [ ] Rate limiting on API endpoints (prevent DDoS)
- [ ] Keeper bot signature validation (verify DIA attestation format)
- [ ] Event listener crash recovery (graceful restart after DB disconnect)

**Tools**:
```bash
# Node.js security scan
npm audit --production

# Python dependency check
pip audit
```

**Git Commit**: `security: backend services security audit`

---

#### 7.2.3 Deploy to Mainnet

**Prerequisites**:
- [ ] All tests passing
- [ ] Audit report approved
- [ ] Contracts verified on Somnia Explorer
- [ ] Mainnet RPC endpoints ready
- [ ] Gnosis Safe multisig wallet created (2-of-3 signers minimum)

**Deployment Steps**:

**Step 1**: Deploy contracts via Gnosis Safe

```bash
forge script script/Deploy.s.sol \
  --rpc-url https://api.infra.mainnet.somnia.network \
  --verify \
  --verifier blockscout \
  --broadcast
# Output: deployment/mainnet.json
```

**Step 2**: Verify all contracts on Somnia Explorer

```bash
# Each contract address: https://explorer.somnia.network/address/0x...
# Should show "Contract Verified" badge
```

**Step 3**: Update frontend environment variables

```env
NEXT_PUBLIC_CHAIN_ID=5031  # Mainnet
NEXT_PUBLIC_API_URL=https://api.bitdrum.xyz
NEXT_PUBLIC_WS_URL=wss://api.bitdrum.xyz/ws
NEXT_PUBLIC_PREDICTION_MARKET_ADDR=0x...  # Mainnet address
```

**Step 4**: Deploy backend services to production

```bash
# Each service deployed to production cloud (Railway, Render, Vercel)
# Environment variables set in cloud dashboard
```

**Step 5**: Deploy frontend to Vercel

```bash
vercel deploy --prod
```

**Step 6**: Smoke test production

```bash
# Connect wallet to mainnet
# Create market
# Verify keeper settles
# Check leaderboard
```

**Expected**: All smoke tests pass on production

**Git Commit**: `deploy: mainnet contracts + backend + frontend (launch ready)`

---

#### 7.2.4 Post-Launch Monitoring

**First 24 hours**:
- [ ] Monitor keeper bot logs (no crash)
- [ ] Monitor API Gateway latency (< 200ms p99)
- [ ] Monitor PostgreSQL query times (< 500ms p95)
- [ ] Monitor blockchain gas costs (track POM cap)
- [ ] Zero critical incidents (pagerduty / slack alerts)

**First Week**:
- [ ] ≥10 markets opened by users
- [ ] ≥5 users reached SCOUT tier
- [ ] Settlement 100% successful (no failures)
- [ ] No fund loss incidents

**Git Commit**: `monitoring: production metrics dashboard + alerts configured`

---

### 7.3 Phase 5 Deliverables

- ✅ Security audit completed (critical/high findings addressed)
- ✅ Smart contracts deployed to Somnia Mainnet (verified on Explorer)
- ✅ Backend services deployed to production
- ✅ Frontend deployed to Vercel (mainnet env vars)
- ✅ Post-launch monitoring active (24/7 alerting)
- ✅ Documentation updated for mainnet (RPC URLs, contract addresses, etc.)
- ✅ Launch announcement ready (social media, Discord, tweets)

**Phase 5 Git Commits**: ~4 commits

**Branch**: `phase-5-launch`

---

## 8. Git Commit Strategy

### 8.1 Commit Frequency

**After Each Major Update**:
- Feature implementation complete (1-2 hours' work)
- Test suite passes
- No console errors/warnings

**Commit Message Format**:
```
type(scope): brief description

[Optional] Longer explanation if needed.

Ticket: #123 (if using issue tracking)
```

**Types**:
- `feat`: New feature
- `fix`: Bug fix
- `refactor`: Code restructuring
- `test`: Test additions/updates
- `config`: Config file changes
- `deploy`: Deployment-related commits
- `security`: Security fixes/audits
- `chore`: Maintenance tasks
- `docs`: Documentation updates

### 8.2 Phase Branches

```
main (production)
  ↑
  └─ phase-5-launch (security + mainnet)
      ↑
      └─ phase-4-integration (e2e testing)
          ↑
          └─ phase-3-frontend (next.js + wallet)
              ↑
              └─ phase-2-backend (keeper + indexer)
                  ↑
                  └─ phase-1-contracts (solidity)
```

**Merging**:
- Each phase branch → main on completion
- Use squash merge for clean history
- Tag each phase: `v1.phase1`, `v1.phase2`, etc.

### 8.3 Example Commit Log at Launch

```
v1.phase5 - Production Launch
├── deploy: mainnet contracts + backend + frontend (launch ready)
├── monitoring: production metrics dashboard + alerts configured
├── security: backend services security audit
├── security: smart contract audit completed (findings addressed)
├─ v1.phase4 - Integration & Testing
│ ├── test: smoke tests (10/10 passing)
│ ├── test: e2e workflow verified on testnet
│ ├── test: full-stack local integration test passing
├─ v1.phase3 - Frontend Development
│ ├── feat(frontend): websocket real-time updates
│ ├── feat(frontend): wallet connection flow
│ ├── feat(frontend): signal panel with tier gating
│ ├── [...15 more commits...]
├─ v1.phase2 - Backend Infrastructure
│ ├── feat(subscription-distributor): monthly ORACLE rewards distribution
│ ├── feat(ai-agent): signal inference + POM calculation
│ ├── feat(gateway): REST + WebSocket aggregation
│ ├── feat(indexer): event listener + leaderboard computation
│ ├── feat(keeper): ethers.js settlement automation
├─ v1.phase1 - Smart Contracts
│ ├── deploy: testnet contracts to somnia shannon (initial deploy)
│ ├── test: comprehensive unit and integration tests (90%+ coverage)
│ ├── feat: implement oracle adapters (DIA + Protofire)
│ ├── feat: implement SubscriptionsContract.sol tier gating
│ ├── feat: implement LeaderboardRegistry.sol on-chain stats
│ ├── feat: implement Treasury.sol fee allocation
│ ├── feat: implement LiquidityVault.sol counterparty & funding logic
│ ├── feat: implement SettlementEngine.sol oracle settlement logic
│ ├── feat: implement PredictionMarket.sol core logic
│ ├── chore: configure foundry and add openzeppelin lib
│ └── chore: init foundry project for solidity contracts
```

---

## 9. Environment & Deployment

### 9.1 Environment Breakdown

| Environment | Chain | Chain ID | RPC | Use Case |
|---|---|---|---|---|
| **Development** | Shannon Testnet | 50312 | https://dream-rpc.somnia.network | Local dev + testing |
| **Staging** | Shannon Testnet | 50312 | https://dream-rpc.somnia.network | Pre-launch QA |
| **Production** | Somnia Mainnet | 5031 | https://api.infra.mainnet.somnia.network | Live users |

### 9.2 Deployment Platform Recommendations

| Service | Platform | Rationale |
|---|---|---|
| Contracts | Somnia EVM (immutable) | On-chain, no platform dependency |
| Keeper Bot | Railway or Fly.io | Low-latency RPC polling, always-on |
| Social Indexer | Railway + PostgreSQL + Redis | Stateful service, needs persistent storage |
| AI Agent | Render or Railway | Python FastAPI, auto-scaling |
| API Gateway | Vercel (serverless) or Railway | Stateless, high request volume |
| Frontend | Vercel | Next.js native support, CDN |
| Database | PostgreSQL (Supabase, Railway, AWS RDS) | Production-grade reliability |
| Cache | Redis (Redis Cloud, Railway) | Sub-millisecond latency |

### 9.3 Production Secrets (.env)

**Keeper Bot**:
```env
SOMNIA_RPC_URL=https://api.infra.mainnet.somnia.network
KEEPER_PRIVATE_KEY=0x...  # Non-custodial wallet, funded with SOMI for gas
SETTLEMENT_ENGINE_ADDR=0x...
DIA_ORACLE_ADDR=0x...
```

**Social Indexer**:
```env
DATABASE_URL=postgres://...
REDIS_URL=redis://...
SOMNIA_RPC_URL=https://api.infra.mainnet.somnia.network
```

**AI Agent**:
```env
DATABASE_URL=postgres://...
REDIS_URL=redis://...
OPENAI_API_KEY=sk-...
```

**API Gateway**:
```env
DATABASE_URL=postgres://...
REDIS_URL=redis://...
SUBSCRIPTIONS_CONTRACT_ADDR=0x...
```

**Frontend (.env.local)**:
```env
NEXT_PUBLIC_CHAIN_ID=5031
NEXT_PUBLIC_API_URL=https://api.bitdrum.xyz
NEXT_PUBLIC_WS_URL=wss://api.bitdrum.xyz/ws
NEXT_PUBLIC_PREDICTION_MARKET_ADDR=0x...
```

---

## 10. Success Criteria

### 10.1 Phase 1 — Contracts

- ✅ All 6 core contracts deployed to Shannon Testnet
- ✅ >90% test coverage
- ✅ Can open market, join market, settle market end-to-end
- ✅ Oracle staleness protection verified
- ✅ Payout logic tested (WIN/LOSS/DRAW)

### 10.2 Phase 2 — Backend

- ✅ Keeper bot settles ≥1 market on testnet
- ✅ Social Indexer indexes all event types
- ✅ API Gateway exposes ≥10 endpoints
- ✅ AI Agent generates valid signals
- ✅ Subscription Distributor logic tested

### 10.3 Phase 3 — Frontend

- ✅ User can connect wallet (Privy + MetaMask)
- ✅ User can see live markets
- ✅ User can open/join market
- ✅ User can see leaderboard + profile
- ✅ Real-time WebSocket updates working

### 10.4 Phase 4 — Integration

- ✅ Full stack runs locally (all 5 services)
- ✅ E2E workflow: market open → settlement → leaderboard → claim
- ✅ 10 smoke tests passing
- ✅ Performance benchmarks: keeper <5s/market, API <200ms p99
- ✅ Security checklist 100% complete

### 10.5 Phase 5 — Launch

- ✅ Audit report approved
- ✅ Contracts on Somnia Mainnet verified
- ✅ All backend services deployed
- ✅ Frontend on Vercel (mainnet config)
- ✅ 24/7 monitoring active
- ✅ First user cohort trading live

---

## Appendix A: Quick Command Reference

```bash
# Phase 1: Contracts
cd contracts && forge test && forge script script/Deploy.s.sol --broadcast --verify

# Phase 2: Backend
cd backend/keeper && npm run dev &  # Terminal 1
cd backend/indexer && npm run dev &  # Terminal 2
cd backend/ai-agent && python main.py &  # Terminal 3
cd backend/gateway && npm run dev  # Terminal 4

# Phase 3: Frontend
cd frontend && npm run dev  # http://localhost:3000

# Phase 4: Integration
npm run test:smoke  # All 10 smoke tests

# Phase 5: Launch
vercel deploy --prod
forge script script/Deploy.s.sol --rpc-url https://api.infra.mainnet.somnia.network --broadcast
```

---

## Appendix B: Key Somnia Integration Points

| Component | Integration | Reference Link |
|---|---|---|
| Chain Config | Wagmi + Privy | [lib/wagmi-config.ts](#) |
| RPC Endpoints | Ethers.js JsonRpcProvider | https://api.infra.mainnet.somnia.network |
| DIA Oracle | Oracle Adapter | [src/interfaces/IOracle.sol](#) |
| Protofire Fallback | Oracle Fallback Logic | [src/SettlementEngine.sol](#) |
| Account Abstraction | ERC-4337 EntryPoint | 0x0000000071727De22E5E9d8BAf0edAc6f37da032 |
| Event Streaming | Ethers.js Listeners | [backend/indexer/src/index.ts](#) |
| Somnia Reactivity | WebSocket Push (Future) | https://reactivity.somnia.network |

---

**Document Version**: 1.0  
**Last Updated**: 2026-04-03  
**Status**: Ready for Implementation  
**Next Step**: Begin Phase 1 — Smart Contract Development
