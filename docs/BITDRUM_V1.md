# BitDrum v1 — BitDrum-native market (roadmap)

Everything below is BitDrum's original protocol: its own Bitcoin direction market on Somnia with a protocol-owned liquidity vault, keeper-fed price adapter, indexer, gateway, and AI agent. It remains deployed on Shannon and is the roadmap for a BitDrum-native venue; the hackathon submission above runs entirely on DreamDEX and does not need any of these services.

> **Real-time, reactive Bitcoin direction markets on Somnia EVM.** Built natively on Somnia's Multistream Consensus infrastructure — not ported from another chain.

**BitDrum v1** lets users stake native STT on whether BTC/USD will finish higher or lower after **60 or 300 seconds**. A protocol-owned liquidity vault guarantees every trade has a counterparty — 24/7, regardless of peer participation. Strike and settlement prices are sourced from an on-chain keeper-fed adapter. Payout rates are computed deterministically from vault liquidity and locked at open time. Settlement is permissionless.

---

## Live Deployment — Somnia Shannon Testnet

All V2 contracts are deployed and operational. Verify any address on the [Shannon Explorer](https://shannon-explorer.somnia.network).

| Contract | Address | Explorer |
|---|---|---|
| `BitdrumPriceAdapter` | `0xDeED8D1c527F673507F445fB6cb635C48DE0acB1` | [View ↗](https://shannon-explorer.somnia.network/address/0xDeED8D1c527F673507F445fB6cb635C48DE0acB1) |
| `PredictionMarketV2` | `0x87F8014110e5D6c69bb1A3e64f25dc595b4a861C` | [View ↗](https://shannon-explorer.somnia.network/address/0x87F8014110e5D6c69bb1A3e64f25dc595b4a861C) |
| `SettlementEngineV2` | `0x46c938d2D527A3Ca4a48ee8D8c4e72417618e67B` | [View ↗](https://shannon-explorer.somnia.network/address/0x46c938d2D527A3Ca4a48ee8D8c4e72417618e67B) |
| `LiquidityVaultV2` | `0xB16927B62fccF99668B98544AFaF03c5C64d38ED` | [View ↗](https://shannon-explorer.somnia.network/address/0xB16927B62fccF99668B98544AFaF03c5C64d38ED) |
| `TreasuryV2` | `0x13B4A6C86EFa533e9bF3E035228021ca7Fa52ad7` | [View ↗](https://shannon-explorer.somnia.network/address/0x13B4A6C86EFa533e9bF3E035228021ca7Fa52ad7) |
| `LeaderboardRegistry` | `0x5BaC7081963c67518519bD70057dbA8E0e46ab45` | [View ↗](https://shannon-explorer.somnia.network/address/0x5BaC7081963c67518519bD70057dbA8E0e46ab45) |

> Start block: `352,594,919` · Chain ID: `50312` · Native token: `STT`

---

## How It Works

A full market cycle completes in under 5 minutes:

```
T+0s    openMarket()  → Strike price locked from adapter. Vault commits 1:1 matching STT.
T+20s   lockMarket()  → Join window closes. Permissionless — anyone can call this.
T+60s   Keeper posts fresh adapter round with post-expiry BTC/USD price.
T+64s   settle()      → Engine reads adapter, computes UP/DOWN/DRAW. Permissionless.
T+64s+  claimPayout() → Winners receive principal + profit at locked payout rate.
```

**Payout curve** — determined on-chain from vault liquidity at open time:

| Vault depth | Profit rate |
|---|---|
| ≤ 5 STT | 30% (3000 bps) |
| 5 – 100 STT | Linear interpolation |
| ≥ 100 STT | 80% (8000 bps) |

No keeper can override this. No AI sets this. It is a deterministic on-chain formula.

---

## Architecture

BitDrum is a six-service protocol stack. All services are deployed and wired to the live Shannon contract addresses.

```
Frontend (Next.js 16)
  ├─ direct viem contract reads/writes
  └─ gateway REST + WebSocket

Gateway (Express + WebSocket)          AI Agent (FastAPI)
  ├─ reads PostgreSQL                    ├─ directional confidence
  ├─ calls AI Agent                      ├─ top-trader alignment
  ├─ Somnia Reactivity integration       ├─ rolling accuracy tracking
  └─ Somnia Streams publishing           └─ optional OpenAI rationale

Indexer (Node.js + viem)              Keeper (Node.js)
  ├─ 500-block batch sync                ├─ 20s price publisher → BitdrumPriceAdapter
  ├─ PostgreSQL market/stake/trader      ├─ 3s lifecycle poller (lock → settle)
  └─ NOTIFY bitdrum_update              └─ Oracle: Binance → DIA → static fallback

Contracts (Somnia EVM)
  BitdrumPriceAdapter · PredictionMarketV2 · SettlementEngineV2
  LiquidityVaultV2 · TreasuryV2 · LeaderboardRegistry
```

### Somnia-Native Integrations

BitDrum uses three pieces of Somnia's infrastructure stack — not just cheap gas:

- **Native STT staking** — No ERC-20 approvals. One payable call to open or join a market.
- **Somnia Reactivity** (`@somnia-chain/reactivity`) — Gateway subscribes to V2 market events for push-event WebSocket delivery and real-time AI signal precomputation on `MarketOpened` and `MarketLocked`.
- **Somnia Streams** — Best-effort append-log publishing for AI signal data from the gateway.

---

## Smart Contracts

The repo contains both V1 (legacy) and V2 (active) contracts. **V2 is the active path** used by all services. V1 contracts remain for historical reference only.

### V2 Contract Roles

| Contract | Role |
|---|---|
| `BitdrumPriceAdapter` | Keeper-fed BTC/USD on-chain snapshot. Used for both strike (at open) and settlement (post-expiry). |
| `PredictionMarketV2` | Core lifecycle: open, join, lock, finalise. Reads adapter. Locks payout rate from vault balance. |
| `SettlementEngineV2` | Reads adapter directly. Enforces post-expiry + freshness. Updates LeaderboardRegistry. |
| `LiquidityVaultV2` | Holds native STT. Matches every user stake 1:1. Pays winners. Owner-only rescue path. |
| `TreasuryV2` | Receives 2% fee on settlement. Auto-forwards: 60% → vault, 40% → reserve. |
| `LeaderboardRegistry` | On-chain trader stats: markets, wins, losses, draws, net PnL. |

### Security Properties

- No user-supplied prices — strike and settlement come exclusively from `BitdrumPriceAdapter`
- Post-expiry enforcement — adapter round timestamp must be `>= market.expiryAt`
- Freshness at open — adapter must be younger than 60 seconds
- Freshness at settle — settlement round must be within 90 seconds
- Permissionless lifecycle — `lockMarket()` and `settle()` callable by anyone once eligible
- Vault isolation — only `PredictionMarketV2` can call `fundMarket()` or `payWinner()`
- Checks-effects-interactions on claim — state updates before vault payout

---

## Local Development

### Prerequisites

- [Foundry](https://getfoundry.sh) — `curl -L https://foundry.paradigm.xyz | bash && foundryup`
- Node.js v20+ and Python 3.11+
- PostgreSQL v16+
- Deployer wallet funded with testnet STT

### 1. Deploy V2 Contracts

```bash
cd contracts

# Copy and configure environment
cp .env.example .env
# Set PRIVATE_KEY in .env

# Deploy the full V2 suite
forge script script/DeployV2.s.sol \
  --rpc-url https://dream-rpc.somnia.network \
  --broadcast

# Record the deployed addresses for your backend .env files
```

> **Note:** The active deployment script is `DeployV2.s.sol`. It deploys all six V2 contracts, wires their relationships, and seeds the vault with initial STT. Do not use the legacy `Deploy.s.sol`.

### 2. Configure Backend Services

Each service needs its own `.env` file. Copy from the respective `.env.example` and set:

```
PREDICTION_MARKET_ADDRESS=0x87F8014110e5D6c69bb1A3e64f25dc595b4a861C
SETTLEMENT_ENGINE_ADDRESS=0x46c938d2D527A3Ca4a48ee8D8c4e72417618e67B
LIQUIDITY_VAULT_ADDRESS=0xB16927B62fccF99668B98544AFaF03c5C64d38ED
PRICE_ADAPTER_ADDRESS=0xDeED8D1c527F673507F445fB6cb635C48DE0acB1
TREASURY_ADDRESS=0x13B4A6C86EFa533e9bF3E035228021ca7Fa52ad7
LEADERBOARD_REGISTRY_ADDRESS=0x5BaC7081963c67518519bD70057dbA8E0e46ab45
RPC_URL=https://dream-rpc.somnia.network
START_BLOCK=352594919
```

### 3. Database Setup

```bash
cd backend/indexer
npm install
npm run db:migrate
```

### 4. Start Services (in this order)

Services have startup dependencies. Follow this order exactly:

```bash
# 1. PostgreSQL must be running first

# 2. Indexer
cd backend/indexer && npm install && npm run dev

# 3. Gateway
cd backend/gateway && npm install && npm run dev

# 4. AI Agent
cd backend/ai-agent
pip install -r requirements.txt
uvicorn main:app --port 8000

# 5. Keeper
cd backend/keeper && npm install && npm run dev

# 6. Frontend
cd frontend && npm install && npm run dev
```

> Starting the gateway before the indexer will cause DB connection errors. Starting the keeper before the gateway will miss signal precomputation on market events.

---

## Production Deployment

| Service | Platform | Type |
|---|---|---|
| Frontend | Vercel / Render | Web Service |
| Gateway | Render | Web Service (HTTP + WS) |
| Indexer | Render | **Background Worker** |
| Keeper | Render | **Background Worker** |
| AI Agent | Render | Web Service |

> The indexer and keeper are continuous loops that do not bind to HTTP ports. Deploying them as Web Services causes health-check timeouts. Always deploy as Background Workers.

---

## Network Reference

| Parameter | Shannon Testnet | Mainnet |
|---|---|---|
| Chain ID | `50312` | `5031` |
| RPC URL | `https://dream-rpc.somnia.network` | `https://api.infra.mainnet.somnia.network` |
| Explorer | `https://shannon-explorer.somnia.network` | `https://explorer.somnia.network` |
| Currency | `STT` (18 decimals) | `SOMI` (18 decimals) |
| DIA Oracle | `0x9206296Ea3aEE3E6bdC07F7AaeF14DfCf33d865D` | `0xbA0E0750A56e995506CA458b2BdD752754CF39C4` |
| Multicall3 | `0x841b8199E6d3Db3C6f264f6C2bd8848b3cA64223` | `0x5e44F178E8cF9B2F5409B6f18ce936aB817C5a11` |

---

## Trader Reputation System

BitDrum tracks and ranks traders on-chain and off-chain:

**Composite score:** `Win Rate × 0.4 + Normalised PnL × 0.4 + Consistency × 0.2`

| Tier | Requirement |
|---|---|
| `ORACLE` | Top 1% · minimum 3 markets entered |
| `PROPHET` | Top 5% · minimum 2 markets entered |
| `TRADER` | Top 20% · minimum 1 market entered |
| `SCOUT` | All other active participants |

Tiers are recomputed by the indexer after every committed event batch.

---

## Economic Model

- **Settlement fee:** 2% on every non-draw market, auto-split on receipt — 60% to vault, 40% to reserve
- **Vault spread:** Payout rates are capped below 100%, giving the vault structural positive expectancy
- **Subscriptions:** PRO (10 STT) and ELITE (25 STT) 30-day tiers via `SubscriptionsContract` (deployed, gating activates at mainnet)

The compounding flywheel: fees → vault → better payout rates → more volume → more fees.

---

## Running Tests

```bash
cd contracts

# Run the full V2 test suite
forge test --match-path "test/BitDrumV2.t.sol" -v

# Run with gas reporting
forge test --gas-report
```

> The V2 test suite passes. The legacy V1 suite (`BitDrumProtocol.t.sol`) contains known failures as V1 is not the active path.

---

## Built By

**[CrackedStudios.xyz](https://crackedstudios.xyz)** — a Web3 product studio focused on shipping production-grade decentralised applications.

- **Abdulsamad Sadiq** — Founder · Product Engineering & Marketing · 6× Hackathon Winner
- **Samuel Onanike** — Co-Founder · Smart Contract Security & Backend Infrastructure · [Noah Protocol](https://noahprotocol.xyz)

---

## License

BitDrum Protocol is open-sourced under the [MIT License](./LICENSE).
