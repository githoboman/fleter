# BitDrum
### The Intelligent Decentralized Prediction Protocol
### Built on Somnia · Powered by Ethers.js · Augmented by AI

---

> **BitDrum is a trustless Bitcoin price prediction protocol that merges on-chain transparency with AI-driven trading intelligence, a capped dynamic payout engine, and a social reputation layer — giving every user the edge of a seasoned trader without requiring them to be one.**
>
> *This document is the complete system architecture for BitDrum, fully ported to Somnia. No part of this stack references Cairo, Starkzap, Pragma Oracle, Argent, Braavos, AVNU, or any Starknet primitive.*

---

## Table of Contents

1. [Migration Overview](#1-migration-overview)
2. [Core Protocol](#2-core-protocol)
3. [Extended Feature Pillars](#3-extended-feature-pillars)
4. [System Architecture](#4-system-architecture)
5. [Smart Contract Layer](#5-smart-contract-layer)
6. [AI Agent System](#6-ai-agent-system)
7. [Dynamic Payout Engine](#7-dynamic-payout-engine)
8. [Social Layer & Reputation System](#8-social-layer--reputation-system)
9. [Somnia Integration](#9-somnia-integration)
10. [User Flows](#10-user-flows)
11. [Data Architecture](#11-data-architecture)
12. [Economic Model](#12-economic-model)
13. [Security Model](#13-security-model)
14. [Frontend Architecture](#14-frontend-architecture)
15. [Backend & Keeper Infrastructure](#15-backend--keeper-infrastructure)
16. [Deployment & Environment Strategy](#16-deployment--environment-strategy)
17. [Glossary](#17-glossary)

---

## 1. Migration Overview

Every Starknet and Starkzap dependency has been replaced with a native Somnia equivalent. Protocol logic, payout mechanics, AI agent, and social layer are **100% unchanged** — only the execution environment is new.

| What Changed | Old (Starknet) | New (Somnia) |
|---|---|---|
| Blockchain | Starknet (Cairo VM) | Somnia EVM — Chain ID: 5031 |
| Smart Contract Language | Cairo | Solidity ^0.8.20 |
| Development Framework | Starknet Foundry | Foundry (`forge`, `cast`, `anvil`) or Hardhat |
| Client SDK | Starkzap TypeScript SDK | Ethers.js v6 + Viem + Wagmi |
| Wallet Auth (new users) | Privy + Starkzap | Privy (direct EVM config for Somnia chain) |
| Wallet Auth (crypto users) | Argent / Braavos | MetaMask / RainbowKit / ConnectKit |
| Account Abstraction | Starknet native AA | ERC-4337 via Somnia EntryPoint v0.7 |
| Gasless Transactions | AVNU Paymaster | ERC-4337 Paymaster (Pimlico or custom treasury paymaster) |
| Price Oracle | Pragma Oracle (BTC/USD) | DIA Price Feeds (primary) + Protofire Price Feeds (fallback) |
| Staking Token | sBTC (Starknet Wrapped BTC) | WBTC (ERC-20 on Somnia) |
| Event Streaming | Starknet.js event stream | ethers.js listeners + Somnia Reactivity (WebSocket push) |
| Block Explorer | Starkscan | explorer.somnia.network |
| Testnet | Starknet Sepolia | Somnia Shannon Testnet — Chain ID: 50312 |
| Gas Token | STRK | SOMI |
| Multisig Deployment | Starknet multisig | Gnosis Safe (EVM-compatible) |

---

## 2. Core Protocol

> The following is the immutable foundation BitDrum is built upon. It is not modified by the extended features — it is augmented. The migration to Somnia does not change any rule, lifecycle state, or settlement logic.

### 2.1 The Prediction Market

BitDrum operates around one question:

> **Will Bitcoin's price be higher or lower than it is right now, after a set amount of time?**

Users stake on:
- **UP** — BTC price will be higher at expiry
- **DOWN** — BTC price will be lower at expiry

Durations: **30 seconds**, **1 minute**, **5 minutes**

### 2.2 Market Lifecycle

```
OPEN
 │  Strike price recorded on-chain
 │  Liquidity Vault fills opposite side
 │  AI Agent signal is surfaced to users
 │  Dynamic multiplier estimate displayed
 │
 ▼
LOCKED
 │  Joining window closed
 │  Pool is fixed
 │  Expiry countdown runs
 │
 ▼
SETTLED
 │  Keeper triggers settlement via Somnia RPC (ethers.js)
 │  DIA / Protofire oracle price fetched and verified
 │  AI Agent outcome logged (for accuracy tracking)
 │  Dynamic multiplier finalised
 │
 ▼
CLAIMABLE
 │  Winners claim proportional payout
 │  Social layer records trade result per user
 │
 ▼
CLOSED
     All claims processed
     Trader stats updated on leaderboard
```

### 2.3 The Payout Structure

BitDrum uses a **fixed-outcome binary model**, not a parimutuel pool:

```
WIN  → Stake returned + AI-determined profit (between +5% and +70% of stake)
LOSE → 100% of stake lost
DRAW → Full stake refunded
```

The exact profit percentage is determined by the **Probable Outcome Multiplier (POM)** — fixed once the joining window closes and stored on-chain. No surprises at settlement.

### 2.4 The Liquidity Vault

On every new market, the Liquidity Vault automatically stakes on the opposite side of the opener. This guarantees:
- Every market always has a counterparty
- No voids, no refunds due to lack of participation
- A working UX from day one, before the user base grows

The vault is replenished by protocol fees and operates as a market-making function, not a house edge.

### 2.5 Settlement

Settlement is triggered by a **keeper bot** that polls Somnia every **3 seconds** via ethers.js. The keeper fetches a signed price attestation from DIA or Protofire Oracle, submits it on-chain, and the Solidity contract executes settlement deterministically — applying the POM profit percentage stored at market open.

---

## 3. Extended Feature Pillars

### Pillar 1 — AI Signal Agent

The AI Signal Agent observes the trading behaviour of the protocol's top-performing traders and distils their collective positioning into a single structured signal displayed before and during the joining window of every market.

**What it produces:**
- A directional bias: `BULLISH`, `BEARISH`, or `NEUTRAL`
- A confidence score: `0–100`
- A rationale: short natural-language explanation citing key inputs
- Historical accuracy of the signal type on similar conditions

**What it does not do:**
- It does not place trades on behalf of users
- It does not guarantee an outcome
- It does not alter the smart contract logic in any way

The signal is surfaced as informational UI. The user retains full autonomy over their decision.

#### AI Signal Agent — Profit Model

| Tier | Access | Cost | Included |
|---|---|---|---|
| **Free** | Basic signal direction only | $0 | BULLISH / BEARISH / NEUTRAL label |
| **Signal Pro** | Full signal: confidence + rationale + accuracy history | $9.99/month in WBTC | All signal fields per market |
| **Signal Elite** | Signal Pro + real-time ORACLE-trader position alerts + POM priority feed | $24.99/month in WBTC | Signal Pro + trader copy-alerts + early POM access |

**Revenue flow:**
```
Subscription payments (WBTC) → Signal Revenue Pool
  50% → Protocol Treasury (infrastructure and vault)
  30% → AI model improvement fund (compute, retraining)
  20% → ORACLE-tier trader reward pool
```

---

### Pillar 2 — Dynamic Payout Engine

- **WIN** — original stake + up to **+70% profit** (POM-determined)
- **LOSE** — **100% of staked amount lost** — no partial recovery

**Inputs to the POM model:** pool ratio, BTC volatility (1m/5m/15m), time-of-day patterns, top-trader positioning, signal confidence.

The POM is set once at market open. The profit percentage users see when joining is the profit percentage they receive if they win.

---

### Pillar 3 — Social Reputation Layer

Every wallet that trades on-chain automatically builds a public trading profile from verifiable, on-chain data.

**Leaderboard tiers:**
- `ORACLE` — Top 1% by win rate + volume (minimum 50 markets)
- `PROPHET` — Top 5%
- `TRADER` — Top 20%
- `SCOUT` — All other active participants

Top traders in `ORACLE` and `PROPHET` tiers have their positioning patterns fed into the AI Signal Agent model, closing the loop between social performance and AI intelligence.

---

## 4. System Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                              USER LAYER                                  │
│           Web · Mobile (React Native / Expo) · Progressive Web App       │
└───────────────────────────────┬──────────────────────────────────────────┘
                                │
┌───────────────────────────────▼──────────────────────────────────────────┐
│                           FRONTEND LAYER                                 │
│                                                                          │
│  ┌────────────────┐  ┌─────────────────┐  ┌───────────────────────────┐ │
│  │  Trading UI    │  │  AI Signal UI   │  │  Social / Leaderboard UI  │ │
│  │  ──────────    │  │  ────────────   │  │  ────────────────────────  │ │
│  │  Market feed   │  │  Signal cards   │  │  Trader profiles           │ │
│  │  BTC chart     │  │  Confidence     │  │  Rankings & tiers          │ │
│  │  Open/Join     │  │  Rationale      │  │  P&L history               │ │
│  │  Claim         │  │  History        │  │  Social follows            │ │
│  └────────────────┘  └─────────────────┘  └───────────────────────────┘ │
│                                                                          │
│         Ethers.js v6 / Viem + Wagmi · Privy (EVM) · RainbowKit          │
│                    Wallet Auth · Token Ops · Tx Builder                  │
└───────────────────────────────┬──────────────────────────────────────────┘
                                │
         ┌──────────────────────┼──────────────────────┐
         │                      │                      │
┌────────▼───────┐   ┌──────────▼──────────┐  ┌───────▼────────────────┐
│  SMART CONTRACT│   │   AI AGENT LAYER     │  │  SOCIAL INDEXER LAYER  │
│  LAYER         │   │                      │  │                        │
│  (Somnia EVM)  │   │  Signal Engine       │  │  On-chain event        │
│                │   │  POM Engine          │  │  listener (ethers.js)  │
│  Prediction    │   │  Top-trader          │  │                        │
│  Market        │   │  aggregator          │  │  Trader stat           │
│                │   │                      │  │  computation           │
│  Settlement    │   │  LLM inference       │  │                        │
│  Engine        │   │  layer               │  │  Leaderboard DB        │
│                │   │                      │  │                        │
│  Liquidity     │   │  REST/WebSocket      │  │  Profile API           │
│  Vault         │   │  API                 │  │                        │
│                │   │                      │  │  Feed API              │
│  Treasury      │   └──────────────────────┘  └────────────────────────┘
│                │
│  Leaderboard   │
│  Registry      │
│                │
│  Subscriptions │
└────────┬───────┘
         │
┌────────▼───────────────────────────────────────────────────────────────┐
│                        AUTOMATION LAYER                                 │
│                                                                         │
│   Keeper Bot (TypeScript / Node.js)                                     │
│   ─────────────────────────────────                                     │
│   Polls Somnia RPC every 3s via ethers.js                               │
│   Fetches oracle price — DIA (primary) / Protofire (fallback)           │
│   Triggers settlement transaction on Somnia                             │
│   Emits settlement events → Social Indexer                              │
│   Emits settlement events → AI Agent (accuracy feedback loop)           │
└────────┬───────────────────────────────────────────────────────────────┘
         │
┌────────▼───────────────────────────────────────────────────────────────┐
│                          ORACLE LAYER                                   │
│    DIA Price Feeds (primary) · Protofire Price Feeds (fallback)         │
│    BTC/USD · Signed attestations · Staleness-protected (30s)            │
│    Both natively supported on Somnia                                    │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Smart Contract Layer

All contracts are written in **Solidity (^0.8.20)** and deployed on the **Somnia EVM**. Once deployed, contracts are immutable.

> **Mainnet:** Chain ID `5031` | RPC: `https://api.infra.mainnet.somnia.network` | Explorer: `https://explorer.somnia.network`
>
> **Testnet:** Chain ID `50312` | RPC: `https://dream-rpc.somnia.network` | Explorer: `https://shannon-explorer.somnia.network`

### 5.1 Prediction Market Contract

**Responsibilities:**
- Accept new market openings with strike price and duration
- Record opener's direction, stake, and block timestamp
- Accept participant stakes during the joining window
- Track `upPool` and `downPool` balances per market
- Hold all staked funds in escrow (WBTC ERC-20)
- Enforce market state transitions: `OPEN → LOCKED → SETTLED → CLAIMABLE → CLOSED`
- Enforce staleness protection on oracle prices (30-second window)

**Key storage:**
```solidity
mapping(uint256 => MarketState) public markets;
mapping(uint256 => mapping(address => StakeRecord)) public stakes;
mapping(uint256 => PoolSnapshot) public pools;
```

**Key entry points:**
```solidity
function openMarket(Direction direction, uint256 duration, uint256 stakeAmount, OracleData calldata strikeData) external;
function joinMarket(uint256 marketId, Direction direction, uint256 stakeAmount) external;
function claimPayout(uint256 marketId) external;
```

---

### 5.2 Settlement Engine Contract

**Responsibilities:**
- Receive settlement trigger from keeper with oracle price data (DIA or Protofire)
- Verify oracle price freshness (staleness check ≤ 30s)
- Compare final price to stored strike price
- Determine winning direction (UP / DOWN / DRAW)
- Calculate each winner's proportional payout from pool data
- Route 2% protocol fee to Treasury
- Unlock CLAIMABLE state so winners can withdraw

**Settlement logic (Solidity):**
```solidity
function settle(uint256 marketId, OracleData calldata priceData) external {
    MarketState storage market = markets[marketId];
    require(market.state == State.LOCKED && block.timestamp >= market.expiry, "Not ready");

    (uint128 finalPrice, uint128 priceTimestamp) = diaOracle.getValue("BTC/USD");
    require(block.timestamp - priceTimestamp <= 30, "Oracle price stale");

    Direction outcome = finalPrice > market.strikePrice ? Direction.UP :
                        finalPrice < market.strikePrice ? Direction.DOWN : Direction.DRAW;

    uint256 totalPool = market.upPool + market.downPool;
    uint256 fee = totalPool * 200 / 10000; // 2% in BPS
    treasury.deposit(fee);

    market.outcome = outcome;
    market.state = State.CLAIMABLE;

    emit MarketSettled(marketId, outcome, totalPool - fee, finalPrice);
}
```

---

### 5.3 Liquidity Vault Contract

Unchanged in function. The vault automatically takes the opposite side of each market opener, absorbs loser stakes, and funds winner profits. Implemented as an ERC-20 vault contract in Solidity, operating on WBTC.

**Net vault flow per market:**
```
Vault income = sum(all losing stakes in WBTC)
Vault outgo  = sum(winner_stake × profit_pct) for all winners
Net          = Vault income − Vault outgo
```

The vault is structurally profitable at all POM levels below 100%, which the 70% cap guarantees.

---

### 5.4 Treasury Contract

Accumulates the 2% protocol fee from every settled market. Allocates funds as:
```
40% → Liquidity Vault replenishment
35% → AI & infrastructure fund
25% → Protocol development reserve
```

---

### 5.5 Leaderboard Registry Contract

Append-only on-chain store for per-wallet win/loss/P&L data. Written to exclusively by the Settlement Engine at settlement time. Read by the Social Indexer, AI Agent, and frontend.

```solidity
// Only Settlement Engine can write
function recordTradeOutcome(address trader, bool won, uint256 stakeAmount, uint256 profitAmount) external onlySettlementEngine;
```

---

### 5.6 Subscriptions Contract

Manages Signal Pro and Signal Elite subscription state. Payments are made in **WBTC (ERC-20)**. Records subscription tier and expiry block per wallet. The API Gateway reads this contract via ethers.js to gate signal field access.

```solidity
mapping(address => Subscription) public subscriptions;

function subscribe(Tier tier) external {
    uint256 fee = tier == Tier.PRO ? PRO_FEE_WBTC : ELITE_FEE_WBTC;
    wbtc.transferFrom(msg.sender, address(signalRevenuePool), fee);
    subscriptions[msg.sender] = Subscription({ tier: tier, expiresAt: block.timestamp + 30 days });
    emit Subscribed(msg.sender, tier, block.timestamp + 30 days);
}
```

---

### 5.7 Development & Deployment Toolchain

| Tool | Somnia Equivalent | Purpose |
|---|---|---|
| Starknet Foundry | Foundry (`forge`, `cast`, `anvil`) or Hardhat | Solidity compile, test, deploy |
| Cairo compiler | `solc` (Solidity compiler) | Contract compilation |
| Starkscan | `explorer.somnia.network` | Block explorer & contract verification |
| Starknet Sepolia | Somnia Shannon Testnet (Chain ID 50312) | Staging & QA environment |
| Starknet Mainnet | Somnia Mainnet (Chain ID 5031) | Production environment |
| Starknet multisig | Gnosis Safe (EVM-compatible) | Secure mainnet deployment |

---

## 6. AI Agent System

The AI Agent Service is **fully preserved and unchanged**. It is blockchain-agnostic — it reads public on-chain data from the Social Indexer database and serves signal/POM outputs to the frontend and keeper. No changes are required.

### 6.1 What Stays the Same

| Component | Status |
|---|---|
| Signal Engine (ONNX + Python FastAPI) | Unchanged — reads trader data from Social Indexer DB |
| POM Engine | Unchanged — POM value written to Somnia contract via keeper |
| LLM rationale layer (OpenAI / self-hosted) | Unchanged |
| Signal Accuracy Log | Unchanged — logs every signal outcome to PostgreSQL |
| Top-trader aggregator | Unchanged — reads Somnia event data via Social Indexer |
| Subscription gating (API Gateway) | Updated to read Subscriptions contract via ethers.js |

### 6.2 Signal Generation

The signal engine pulls top-trader positioning from the Social Indexer and computes a directional bias using a time-series classifier.

```python
# Trader Influence Score (TIS) — unchanged
tis_i = (win_rate_i × 0.50) + (consistency_score_i × 0.30) + (volume_rank_i × 0.20)

# Direction bias — unchanged
direction_bias = Σ (tis_i × direction_vote_i) / Σ tis_i
confidence = clamp(abs(direction_bias) × 100, 0, 100)
```

A `confidence` of 70+ is **high signal strength**. Below 40 is **NEUTRAL**.

### 6.3 Signal Output Schema

```json
{
  "market_id": "0xabc123...",
  "signal": {
    "direction": "UP",
    "confidence": 74,
    "rationale": "7 of 9 qualifying Oracle-tier traders are positioned UP on this market. BTC is in a 5-minute upward momentum channel with low volatility.",
    "top_trader_alignment": 0.78,
    "price_momentum_1m": "+0.12%",
    "price_momentum_5m": "+0.31%",
    "signal_accuracy_last_30d": "64.2%",
    "generated_at": "2025-01-15T14:23:07Z"
  }
}
```

### 6.4 Accuracy Feedback Loop

Every settled Somnia market triggers an event consumed by the AI Agent service:
1. Look up the signal generated for that market
2. Compare signal direction to actual outcome
3. Record result in the **Signal Accuracy Log**
4. Use rolling accuracy to recalibrate feature weights weekly

---

## 7. Dynamic Payout Engine

### 7.1 The Payout Model — Fixed Outcome, Capped Profit

| Outcome | Result |
|---|---|
| **Correct direction** | Original stake + AI-determined profit (**0% to 70% of stake**) |
| **Wrong direction** | **100% of stake lost** — no partial recovery |
| **DRAW** | **Full stake refund** — no profit, no loss |

### 7.2 The Probable Outcome Multiplier (POM)

The POM is set once at market open and does not change after the joining window closes.

| Input | Weight | Description |
|---|---|---|
| Pool imbalance ratio | 30% | Ratio of UP vs DOWN liquidity at join time |
| BTC price volatility | 25% | ATR over 1m, 5m, 15m windows |
| Top-trader alignment strength | 25% | Concentration of ORACLE/PROPHET positioning |
| Time-of-day session patterns | 10% | Historical outcome rates at this hour/day |
| Signal confidence score | 10% | AI Signal confidence on direction |

**POM Calculation:**
```
raw_pom = weighted_sum(inputs) → normalized to [0, 1]
profit_pct = 0.05 + (raw_pom × 0.65)
profit_pct = clamp(profit_pct, 0.05, 0.70)
payout = stake + (stake × profit_pct)   // WIN
payout = 0                               // LOSS
```

**Example:**
```
User stakes 0.001 WBTC
POM determines: +58% profit

  WIN  → receives 0.001 + (0.001 × 0.58) = 0.00158 WBTC
  LOSS → receives 0.00000 WBTC
  DRAW → receives 0.00100 WBTC (full refund)
```

### 7.3 How the Protocol Funds Winners

```
Total loser stakes     → flow to Liquidity Vault (WBTC)
Winner profit payouts  → funded from Liquidity Vault
Winner stake returns   → funded from winner's own escrowed stake

Net vault gain at 50/50 split, avg POM 40%:
  Pool = 1 WBTC (0.5 each side)
  Vault receives: 0.5 WBTC from losers
  Vault pays out: 0.5 × 0.40 = 0.2 WBTC to winners
  Vault net gain: +0.3 WBTC
```

### 7.4 POM Display in UI

```
╔═══════════════════════════════════════════════╗
║          PROFIT IF YOUR CALL IS RIGHT         ║
║                                               ║
║    UP  ▲          +58% profit on stake        ║
║    DOWN ▼         +41% profit on stake        ║
║                                               ║
║    If wrong: 100% of stake lost               ║
║                                               ║
║    AI Signal: ↑ UP (74% confidence)           ║
║    Pool: 0.031 WBTC UP | 0.014 WBTC DOWN      ║
║                                               ║
║    ⚡ Profit rate locked at market open       ║
╚═══════════════════════════════════════════════╝
```

---

## 8. Social Layer & Reputation System

The Social Layer is **fully preserved**. All trader profiles, leaderboard tiers, social feeds, and reputation scoring are identical to the original design. The only infrastructure change is the event source: Starknet.js → ethers.js on Somnia.

### 8.1 Trader Profile

| Field | Source | Description |
|---|---|---|
| `wallet` | On-chain | Truncated address (e.g. `0x1a2b...3c4d`) |
| `display_name` | Optional user-set | ENS name or custom handle |
| `tier` | Computed | ORACLE / PROPHET / TRADER / SCOUT |
| `markets_entered` | Leaderboard Registry | Total settled markets |
| `win_rate` | Leaderboard Registry | Wins / (Wins + Losses) |
| `net_pnl_wbtc` | Leaderboard Registry | Total claimed − total staked |
| `avg_stake` | Leaderboard Registry | Mean stake size across markets |
| `signal_alignment_rate` | Social Indexer | % of trades where user followed AI signal |
| `streak` | Social Indexer | Current consecutive win streak |
| `rank_global` | Social Indexer | Rank among all-time traders |
| `rank_weekly` | Social Indexer | Rank in current 7-day window |
| `joined` | On-chain event | First market timestamp |
| `last_active` | On-chain event | Most recent settled market |

> **Display name change:** Starknet ID is no longer available. Display names are now ENS names (if the user has one) or a custom handle stored off-chain in the Social Indexer database.

### 8.2 Leaderboard Tiers

Tiers are computed weekly from the preceding 90 days of activity.

| Tier | Requirements | Benefits |
|---|---|---|
| **ORACLE** | Top 1% · ≥50 markets | Fed into AI Signal Model · Badge · Featured on front page · Signal Elite free |
| **PROPHET** | Top 5% · ≥30 markets | Fed into AI Signal Model · Profile badge |
| **TRADER** | Top 20% · ≥10 markets | Public ranking displayed |
| **SCOUT** | All active wallets | Basic profile visible |

**Composite score formula:**
```
composite_score = (win_rate × 0.40) + (net_pnl_normalized × 0.40) + (consistency_score × 0.20)
consistency_score = 1 − std_dev(rolling_7d_win_rate)
```

### 8.3 The Social Feed

Three feed modes — unchanged:
- **Following feed** — activity from wallets the user follows
- **ORACLE feed** — all markets opened or joined by ORACLE-tier traders
- **Trending** — markets with rapidly growing pool sizes in the last 60 seconds

### 8.4 Anti-Gaming Protections

- Minimum market threshold — no tier assigned below minimums
- Stake floor — markets below 0.001 WBTC minimum excluded from stat tracking
- Consistency penalty — win rates from fewer than 10 markets display a `low sample` warning
- Self-referral detection — wallets that consistently open and immediately counter their own markets are flagged
- Vault exclusion — the Liquidity Vault address is excluded from all trader profiles and rankings

---

## 9. Somnia Integration

BitDrum is built on **Somnia** and uses **Ethers.js v6 + Viem + Wagmi** for all client-side blockchain interactions. Starkzap is removed entirely.

### 9.1 Why Somnia

| Property | Benefit for BitDrum |
|---|---|
| **1M+ TPS with sub-second finality** | 30-second markets are viable — settlement completes well within the window |
| **EVM compatibility** | All Solidity tooling, libraries, and auditing firms work out of the box |
| **Low fees** | Prediction markets with small WBTC stakes (< 0.001 BTC) are economically viable |
| **DIA + Protofire Oracles** | Native BTC/USD oracle support on Somnia |
| **Somnia Reactivity** | Native push-event system — zero-latency market feed updates without polling |
| **ERC-4337 AA support** | EntryPoint v0.7 deployed — enables gasless transactions and session keys |

### 9.2 Ethers.js Usage (replacing Starkzap)

**Authentication (via Privy — now direct EVM):**
```typescript
import { PrivyProvider } from '@privy-io/react-auth';

const somniaMainnet = {
  id: 5031,
  name: 'Somnia',
  network: 'somnia',
  nativeCurrency: { name: 'SOMI', symbol: 'SOMI', decimals: 18 },
  rpcUrls: { default: { http: ['https://api.infra.mainnet.somnia.network'] } },
  blockExplorers: { default: { name: 'Somnia Explorer', url: 'https://explorer.somnia.network' } },
};

// Wrap app — no Starkzap needed
<PrivyProvider appId={process.env.PRIVY_APP_ID} config={{ defaultChain: somniaMainnet, supportedChains: [somniaMainnet] }}>
```

**Opening a market (Starkzap → Ethers.js):**
```typescript
// OLD (Starkzap):
// const tx = await zap.contracts.predictionMarket.openMarket({ direction: 'UP', duration: 60, stakeAmount: '500000000000000', strikePriceAttestation });

// NEW (ethers.js on Somnia):
import { ethers } from 'ethers';

const provider = new ethers.JsonRpcProvider('https://api.infra.mainnet.somnia.network');
const signer = await provider.getSigner();
const contract = new ethers.Contract(PREDICTION_MARKET_ADDR, ABI, signer);

// Approve WBTC spend first
const wbtc = new ethers.Contract(WBTC_ADDRESS, ERC20_ABI, signer);
await wbtc.approve(PREDICTION_MARKET_ADDR, ethers.parseUnits('0.001', 8));

// Open market
const tx = await contract.openMarket(
  Direction.UP,
  60,                             // 1 minute in seconds
  ethers.parseUnits('0.0005', 8), // 0.0005 WBTC
  oracleData,                     // from DIA or Protofire
);
await tx.wait(); // Confirms in < 1 second on Somnia
```

**Joining a market:**
```typescript
await wbtc.approve(PREDICTION_MARKET_ADDR, stakeAmount);
const tx = await contract.joinMarket(marketId, Direction.UP, stakeAmount);
await tx.wait();
```

**Claiming a payout:**
```typescript
const tx = await contract.claimPayout(marketId);
await tx.wait();
```

**Checking WBTC balance:**
```typescript
const wbtc = new ethers.Contract(WBTC_ADDRESS, ERC20_ABI, provider);
const balance = await wbtc.balanceOf(userAddress);
```

### 9.3 Wallet Options

| Wallet Type | Auth Method | Best For |
|---|---|---|
| **Privy Embedded (EVM)** | Email, Google, Twitter | New users — no crypto experience required |
| **MetaMask** | Seed phrase / hardware key | Existing EVM users |
| **RainbowKit** | Multiple wallets via Wagmi | Multi-wallet connection UI |
| **ConnectKit** | Multiple wallets via Wagmi | Flexible, customizable wallet integration |

**RainbowKit / ConnectKit setup for Somnia:**
```typescript
import { createConfig, http } from 'wagmi';
import { defineChain } from 'viem';

export const somnia = defineChain({
  id: 5031,
  name: 'Somnia',
  nativeCurrency: { name: 'SOMI', symbol: 'SOMI', decimals: 18 },
  rpcUrls: { default: { http: ['https://api.infra.mainnet.somnia.network'] } },
});

export const wagmiConfig = createConfig({
  chains: [somnia],
  transports: { [somnia.id]: http() },
});
```

### 9.4 Gasless Transactions (ERC-4337 Paymaster)

AVNU Paymaster is replaced by an **ERC-4337-compatible Paymaster** deployed on Somnia. Options:
- **Pimlico** — third-party Paymaster supporting custom EVM chains
- **Custom Treasury Paymaster** — protocol-funded, accepts WBTC as gas token for ORACLE/PROPHET subsidization

```typescript
// ERC-4337 with Paymaster via viem
import { createSmartAccountClient } from 'permissionless';

const smartAccount = await createSmartAccountClient({
  chain: somnia,
  bundlerTransport: http(BUNDLER_RPC),
  middleware: {
    sponsorUserOperation: paymasterClient.sponsorUserOperation, // treasury-funded for ORACLE tier
  },
});
```

Somnia EntryPoint v0.7: `0x0000000071727De22E5E9d8BAf0edAc6f37da032`
Somnia Factory Address: `0x4be0ddfebca9a5a4a617dee4dece99e7c862dceb`

---

## 10. User Flows

### 10.1 New User (First-Time, No Crypto Experience)

```
1. Opens BitDrum web or mobile app

2. Clicks "Get Started"
   → Privy modal appears (EVM-configured for Somnia)
   → Signs in with Google (no wallet setup, no seed phrase)
   → Embedded EVM wallet created automatically

3. Sees tutorial overlay:
   → "Deposit WBTC to start trading"
   → Bridge WBTC from Ethereum via Somnia bridge
   → Or purchase SOMI for gas + WBTC from a listed DEX

4. Lands on Live Market Feed:
   → Active markets with countdown timers
   → Pool sizes and profit rates per side
   → AI Signal cards (direction label — free tier)

5. Picks a market:
   → Sees free-tier AI Signal: "↑ BULLISH"
   → Sees Profit Display: "UP wins → +52% | DOWN wins → +38%"
   → Sees risk notice: "Wrong direction = 100% stake lost"
   → Decides to stake 0.001 WBTC on UP

6. Stakes:
   → Enters amount
   → App shows: "If UP wins you receive 0.00152 WBTC · If DOWN wins you receive 0.00000 WBTC"
   → Approves WBTC spend
   → Clicks "Stake UP"
   → ethers.js builds and signs transaction
   → Confirms in < 1 second on Somnia

7. Waits for expiry:
   → Countdown timer visible
   → Live BTC price chart with strike price line
   → Profit rate locked — no changes during wait

8. Market settles:
   → WIN: Claim button appears — "Claim 0.00152 WBTC (+52%)"
   → LOSS: Market closes — "Result: DOWN won · 0.00000 WBTC"

9. Claims winnings:
   → One-tap claim
   → WBTC lands in wallet immediately

10. Profile updated:
    → First win recorded on Leaderboard Registry (Somnia)
    → SCOUT tier badge assigned
    → AI Agent starts tracking this wallet
```

---

### 10.2 Experienced Trader — Signal-Led Workflow

```
1. Opens Signal Elite subscription dashboard
   → Sees real-time ORACLE-trader alert: "3 ORACLE wallets opened UP in last 90s"

2. Checks full AI Signal for the most active market:
   → "↑ UP · 82% confidence · 8 of 10 Oracle traders aligned"

3. Reviews profit display:
   → "UP wins → +34% | DOWN wins → +67%" — contrarian opportunity flag

4. Takes the contrarian DOWN position for higher profit
   → Stakes 0.01 WBTC on DOWN

5. BTC drops 0.08% in the 1-minute window — DOWN wins

6. Claims payout:
   → 0.01 WBTC + (0.01 × 0.67) = 0.0167 WBTC
   → Net profit: +0.0067 WBTC (+67% on stake)
```

---

### 10.3 Signal Subscription Purchase Flow

```
1. User selects Signal Pro from upgrade modal
   → App calculates WBTC equivalent at current BTC/USD rate

2. Subscription transaction:
   await wbtc.approve(SUBSCRIPTIONS_CONTRACT, proBtcFee);
   await subscriptions.subscribe(Tier.PRO);
   // Confirms in < 1 second on Somnia

3. Access granted immediately:
   → Signal cards show: confidence score, rationale, 30d accuracy

4. Renewal at 30 days:
   → User must re-sign the renewal transaction (no silent auto-charge)
   → If not renewed: access reverts to Free tier

5. ORACLE Tier reward (if applicable):
   → Subscription Distributor triggers distributeOracleRewards()
   → ORACLE-tier wallets receive proportional WBTC share based on TIS weight
```

---

## 11. Data Architecture

### 11.1 On-Chain Data (Source of Truth — Somnia EVM)

| Contract | Data Stored | Read By |
|---|---|---|
| Prediction Market | Market states, stakes, pools, strike prices | Frontend, Keeper, Social Indexer |
| Settlement Engine | Settlement outcomes, payout records | Frontend, Social Indexer |
| Liquidity Vault | Vault positions, replenishment history | Frontend |
| Treasury | Fee accumulation, allocation history | Frontend, Analytics |
| Leaderboard Registry | Per-wallet win/loss/P&L stats | Social Indexer, AI Agent, Frontend |
| Subscriptions | Tier and expiry per wallet | API Gateway |

### 11.2 Off-Chain Data (Derived & Indexed)

The **Social Indexer** listens to Somnia events via ethers.js and maintains a queryable database of derived metrics.

| Table | Contents | TTL |
|---|---|---|
| `trader_profiles` | Enriched profiles with computed scores | Updated on each settled market |
| `leaderboard_snapshots` | Weekly and all-time ranking snapshots | Refreshed every 10 minutes |
| `signal_log` | All AI signals generated, with outcomes | Permanent |
| `signal_accuracy` | Rolling accuracy metrics per signal type | Recomputed daily |
| `social_follows` | Off-chain follow graph | Persistent, user-deletable |
| `market_history` | Enriched market metadata | Permanent |

### 11.3 AI Agent Data Stores

| Store | Contents | Purpose |
|---|---|---|
| `feature_cache` | Computed feature vectors per market | Fast inference without recomputing |
| `model_weights` | Signal inference model weights | Loaded on service start, updated weekly |
| `top_trader_positions` | Current open positions of qualifying traders | Core input to signal engine |
| `pom_cache` | Latest POM estimate per active market | Served to frontend via WebSocket |

---

## 12. Economic Model

### 12.1 Revenue Streams

| Source | Rate | Flows To |
|---|---|---|
| Protocol fee | 2% of every settled pool (in WBTC) | Treasury |
| Signal Pro subscriptions | $9.99/month per subscriber (in WBTC) | Signal Revenue Pool |
| Signal Elite subscriptions | $24.99/month per subscriber (in WBTC) | Signal Revenue Pool |
| Vault margin | Spread between 100% loser absorption and ≤70% winner payout | Liquidity Vault |

### 12.2 Vault Economics

```
At 50/50 pool split, avg POM = 45%:

  Total pool:           1.00 WBTC
  Losing side:          0.50 WBTC → absorbed by vault
  Winner profit payout: 0.50 × 0.45 = 0.225 WBTC → paid by vault
  Winner stake returns: 0.50 WBTC → returned from escrow (not vault)

  Vault net gain:       0.50 − 0.225 = +0.275 WBTC per 1 WBTC of volume
  After 2% fee:         +0.255 WBTC
```

The vault is structurally profitable at any POM cap below 100%, which the 70% ceiling guarantees.

### 12.3 Treasury Allocation

```
2% protocol fee from every settled market:
  40% → Liquidity Vault replenishment
  35% → AI & infrastructure fund
  25% → Protocol development reserve

Signal Revenue Pool (subscription income):
  50% → Protocol Treasury
  30% → AI model improvement fund
  20% → ORACLE-tier trader reward pool
```

### 12.4 Fee Sustainability Model

At steady-state volume of **1,000 markets/day**, average pool **0.02 WBTC**, avg POM **40%**, 50/50 split:

```
Daily pool volume:          20 WBTC
Protocol fee (2%):           0.40 WBTC/day
Vault gross margin:          5.84 WBTC/day (net of fee contribution)

Monthly treasury from fees:  12 WBTC
  → Vault funding (40%):      4.8 WBTC
  → AI infra (35%):           4.2 WBTC
  → Dev reserve (25%):        3.0 WBTC

Signal subscriptions (est. 500 Pro + 100 Elite):
  Monthly: (500 × 9.99) + (100 × 24.99) = $7,494 in WBTC
  Treasury share (50%): ~$3,747 equivalent
```

---

## 13. Security Model

### 13.1 Non-Custodial Architecture

No BitDrum contract, administrator, AI agent, or keeper ever has unilateral access to user funds. Stakes are locked in the Prediction Market contract and can only exit through:
1. A settlement payout (winning claim)
2. A DRAW refund

No emergency withdrawal, admin override, or AI-triggered fund movement exists by design.

### 13.2 AI Agent Isolation

The AI Agent System is **fully isolated from the smart contract layer**. It:
- Has no private keys with on-chain permissions
- Cannot submit transactions to any protocol contract
- Cannot alter oracle prices, settlement logic, or payout calculations
- Can only read public on-chain data and serve API responses

If the AI Agent service goes offline, the protocol continues to function normally. Markets open, settle, and pay out without any AI dependency.

### 13.3 Social Layer Isolation

The Leaderboard Registry contract is **append-only** from the Settlement Engine's perspective. The Social Indexer reads from it — it cannot write to it. All writes come only from the Settlement Engine at settlement time.

### 13.4 Oracle Security

- **DIA primary / Protofire fallback**: Keeper tries DIA first; if stale or unavailable, falls back to Protofire
- **Staleness protection**: Price data older than 30 seconds is rejected on-chain — keeper must retry
- **Strike price immutability**: Strike price recorded on-chain at market open, stored in contract storage, cannot be altered post-confirmation
- **No admin oracle override**: No admin function can substitute a price or skip oracle verification

```solidity
// Staleness check in Settlement Engine
require(block.timestamp - priceTimestamp <= 30, "Oracle price stale — retry with fresh data");
```

### 13.5 Keeper Trust Model

The keeper is a convenience bot — not a trust dependency. Settlement logic is entirely in the Solidity contract. If the keeper:
- Goes offline → anyone can call `settle()` directly on the contract
- Submits a stale price → the contract rejects the transaction
- Submits the wrong market ID → the contract validates against stored market state

Anyone in the world can trigger settlement on any expired market. The keeper simply does it automatically.

### 13.6 ERC-4337 Account Abstraction Security

Somnia supports ERC-4337 for account abstraction:
- **UserOperation validation**: EntryPoint enforces pre/post-condition checks before executing any account operation
- **Session keys**: Scoped session keys (via AA wallet) cannot access funds beyond what the user approved
- **Privy key management**: Privy stores embedded wallet keys with HSM protection — users authenticate via OAuth, Privy signs transactions

### 13.7 Contract Immutability & Upgrade Policy

Smart contracts are **not upgradeable by default**. If a critical bug requires a fix:
1. New contract version is deployed
2. Existing markets settle on the old contract
3. Users are migrated to the new contract UI
4. Old contract remains live for historical claim resolution

No admin function can pause settlement, freeze funds, or alter payout math in any deployed contract version.

---

## 14. Frontend Architecture

### 14.1 Tech Stack

| Layer | Technology | Change |
|---|---|---|
| Framework | Next.js 14 (App Router) | Unchanged |
| Styling | Tailwind CSS + shadcn/ui | Unchanged |
| Blockchain | Ethers.js v6 + Viem + Wagmi | Replaces Starkzap SDK |
| Wallet Auth | Privy (direct EVM) + RainbowKit / ConnectKit | Replaces Starkzap wallet layer |
| State management | Zustand + React Query | Unchanged |
| Real-time data | WebSocket (ethers.js event listeners + Somnia Reactivity) | Replaces StarkZap WebSocket |
| Charts | TradingView Lightweight Charts | Unchanged |
| Mobile | React Native (Expo) + Wagmi / ethers.js | Replaces Starkzap SDK |

### 14.2 Page Structure

```
/                       → Home / Live Market Feed
/market/:id             → Single market detail + AI signal + POM + profit display
/leaderboard            → Global rankings + tier overview
/profile/:address       → Trader profile page
/signals                → AI Signal history and accuracy stats
/portfolio              → User's own trade history and P&L
/deposit                → WBTC deposit via Somnia bridge or DEX
/subscribe              → Signal Pro / Signal Elite subscription management
```

### 14.3 Real-Time Data Flow

```
Somnia Events (ethers.js listeners + Somnia Reactivity WebSocket)
    │
    ├── New market opened → Update market feed
    ├── Stake added → Update pool sizes + POM
    ├── Market locked → Update state display
    └── Market settled → Update outcomes + social stats

AI Agent WebSocket (/stream/signals, /stream/pom)
    │
    ├── New signal generated → Update signal card
    └── POM updated → Update multiplier display (5s refresh)

Social Indexer WebSocket (/stream/feed)
    └── New market activity from followed wallets → Update feed
```

**ethers.js event listener pattern:**
```typescript
const contract = new ethers.Contract(PREDICTION_MARKET_ADDR, ABI, provider);

contract.on('MarketOpened', (marketId, direction, stakeAmount, event) => {
  queryClient.invalidateQueries(['marketFeed']);
  marketStore.addMarket({ marketId, direction, stakeAmount });
});

contract.on('MarketSettled', (marketId, outcome, finalPrice, event) => {
  queryClient.invalidateQueries(['market', marketId]);
  socialStore.recordOutcome(marketId, outcome);
});
```

**Somnia Reactivity (testnet — upgrade when mainnet-ready):**
```typescript
// Push-based: events + state delivered atomically, no polling
import { SomniaReactivity } from '@somnia/reactivity';

const reactivity = new SomniaReactivity({ rpc: 'wss://reactivity.somnia.network' });
reactivity.subscribe(PREDICTION_MARKET_ADDR, 'MarketSettled', (event) => {
  // event includes both the log AND the post-tx contract state in one atomic push
  updateUI(event);
});
```

### 14.4 Wallet Connection UX

For new users, BitDrum defaults to **Privy-powered social login** (configured directly for Somnia EVM — no Starkzap layer). Experienced users connect via **RainbowKit** or **ConnectKit**, which surface MetaMask and other EVM wallets.

```typescript
// Privy EVM connect (replaces zap.wallet.connect())
const { login, authenticated, user } = usePrivy();
const { wallets } = useWallets();

await login(); // triggers Google/email OAuth modal
const wallet = wallets[0]; // EVM wallet on Somnia
const provider = await wallet.getEthersProvider();
const signer = provider.getSigner();
```

---

## 15. Backend & Keeper Infrastructure

### 15.1 Services Overview

| Service | Language | Change from Original |
|---|---|---|
| **Keeper Bot** | TypeScript / Node.js | Starkzap server SDK → ethers.js v6; Pragma → DIA/Protofire oracle |
| **AI Agent Service** | Python (FastAPI) | No change — reads public data only |
| **Social Indexer** | TypeScript / Node.js | Starknet.js event stream → ethers.js on Somnia |
| **API Gateway** | Node.js / Express | Reads Subscriptions contract via ethers.js |
| **Subscription Distributor** | TypeScript / Node.js | Starkzap → ethers.js for WBTC reward distribution |

### 15.2 Keeper Bot

```
Loop (every 3 seconds):
  1. Query Somnia via ethers.js:
       const expired = await predictionMarket.queryFilter(
         predictionMarket.filters.MarketLocked(),
         fromBlock
       ).filter(m => m.expiry <= currentBlock);

  2. For each expired market:
     a. Fetch BTC/USD from DIA oracle:
          const [price, timestamp] = await diaOracle.getValue("BTC/USD");
     b. Verify: Date.now()/1000 - timestamp <= 30 (staleness check)
        If stale: fall back to Protofire oracle
     c. Submit settlement:
          await settlementEngine.settle(marketId, { price, timestamp });
     d. Log settlement event

  3. Check vault exposure — replenish if below threshold

  4. Emit settled market IDs → Social Indexer and AI Agent via internal event bus
```

### 15.3 AI Agent Service

- **Language**: Python with FastAPI — **unchanged**
- **Inference**: ONNX runtime for time-series classifier; OpenAI API (or self-hosted LLM) for rationale generation
- **Signal scheduling**: Generated at market open, refreshed every 30 seconds during joining window
- **POM scheduling**: Computed once when joining window closes — written to the smart contract as part of the lock transaction
- **Subscription gating**: API Gateway reads Subscriptions contract state via ethers.js to determine whether to serve full or free-tier signal

### 15.4 Social Indexer

- **Language**: TypeScript / Node.js — **unchanged**
- **Event source**: Somnia event stream via ethers.js (replaces Starknet.js)
- **Database**: PostgreSQL (trader stats, leaderboard snapshots, signal log, social graph) — unchanged
- **Cache**: Redis (live leaderboard rankings, active feed events) — unchanged
- **Indexing latency**: < 5 seconds from on-chain Somnia event to database update

```typescript
// Event source replacement
// OLD: provider.on events via Starknet.js
// NEW:
const provider = new ethers.JsonRpcProvider(process.env.SOMNIA_RPC_URL);
const leaderboard = new ethers.Contract(LEADERBOARD_REGISTRY_ADDR, ABI, provider);

leaderboard.on('TradeOutcomeRecorded', async (trader, won, stakeAmount, profitAmount) => {
  await db.upsertTraderStats(trader, { won, stakeAmount, profitAmount });
  await redis.del(`leaderboard:cache`); // invalidate leaderboard cache
  indexingLatencyMetric.record(Date.now() - eventTimestamp);
});
```

---

## 16. Deployment & Environment Strategy

### 16.1 Environments

| Environment | Network | Purpose |
|---|---|---|
| **Development** | Somnia Shannon Testnet (Chain ID 50312) | Local development and feature testing |
| **Staging** | Somnia Shannon Testnet (Chain ID 50312) | QA, integration testing, partner review |
| **Production** | Somnia Mainnet (Chain ID 5031) | Live user traffic |

### 16.2 Infrastructure

All backend services deployed on cloud infrastructure with:
- **Containerization**: Docker + Docker Compose per service
- **Orchestration**: Kubernetes (production) for auto-scaling and health management
- **Monitoring**: Datadog for latency, error rates, and keeper uptime
- **Alerting**: PagerDuty for keeper downtime > 15 seconds or oracle attestation failures

**RPC Providers (Somnia Mainnet):**

| Provider | URL |
|---|---|
| Ankr | `https://www.ankr.com/rpc/somnia` |
| PublicNode | `https://somnia.publicnode.com` |
| Stakely | `https://somnia-json-rpc.stakely.io` |
| Validation Cloud | `https://www.validationcloud.io/somnia` |
| Official | `https://api.infra.mainnet.somnia.network` |

### 16.3 Smart Contract Deployment

1. Contracts written and tested in Solidity using Foundry (`forge test`)
2. Deployed to Somnia Shannon Testnet for staging validation
3. Security audit before mainnet deployment
4. Mainnet deployment via **Gnosis Safe multisig** — no single developer can deploy unilaterally
5. Contracts verified on Somnia Explorer (`explorer.somnia.network`)
6. Contract addresses published in open-source repository

### 16.4 Upgradability Policy

Smart contracts are **not upgradeable by default**. If a critical bug requires a contract fix:
1. New contract version is deployed
2. Existing markets settle on the old contract
3. Users are migrated to the new contract UI
4. Old contract remains live for historical claim resolution

No admin function can pause settlement, freeze funds, or alter payout math in any deployed contract version.

---

## 17. Glossary

| Term | Definition |
|---|---|
| **WBTC** | Wrapped Bitcoin on Somnia (ERC-20) — the primary staking token in BitDrum |
| **SOMI** | Native gas token of the Somnia network — used to pay transaction fees |
| **STT** | Somnia Test Token — native token on Shannon testnet, used for development |
| **Strike Price** | The BTC/USD price recorded on-chain at the moment a market opens |
| **Fixed-Outcome Model** | BitDrum's payout structure: correct call earns stake + up to 70% profit; wrong call loses 100% |
| **POM** | Probable Outcome Multiplier — the AI-determined profit percentage (5%–70%) a winner receives |
| **POM Cap** | Hard ceiling of +70% profit on a winning stake — cannot be exceeded |
| **Keeper** | Automated bot that polls Somnia every 3s via ethers.js and triggers settlement on expired markets |
| **Pull Oracle** | A price oracle model where price is fetched and submitted on-demand |
| **DIA Oracle** | Primary decentralized BTC/USD price oracle on Somnia — replaces Pragma |
| **Protofire Feeds** | Secondary price oracle on Somnia — used as fallback to DIA |
| **Liquidity Vault** | Protocol-owned WBTC reserve that funds winner payouts and absorbs loser stakes |
| **Vault Margin** | Spread between 100% loser absorption and ≤70% winner profit payout — the protocol's structural edge |
| **TIS** | Trader Influence Score — weights top traders' positioning in the AI signal |
| **AI Signal Agent** | AI system aggregating top-trader behaviour into directional trading signals |
| **Signal Pro** | Paid subscription tier ($9.99/month in WBTC) — full AI signal |
| **Signal Elite** | Premium subscription tier ($24.99/month in WBTC) — Signal Pro + ORACLE trader alerts |
| **Signal Revenue Pool** | Revenue from Signal subscriptions split between Treasury, AI fund, and ORACLE-tier traders |
| **ORACLE Tier Reward Pool** | 20% of Signal Elite revenue distributed monthly to ORACLE-tier traders |
| **Composite Score** | Ranking metric: 40% win rate + 40% net P&L + 20% consistency |
| **ORACLE Tier** | Top 1% of traders by composite score with ≥50 markets |
| **ERC-4337** | Account Abstraction standard on Somnia — replaces Starknet native AA |
| **EntryPoint v0.7** | ERC-4337 EntryPoint on Somnia at `0x0000000071727De22E5E9d8BAf0edAc6f37da032` |
| **Somnia Reactivity** | Native push-event system on Somnia — delivers events + state atomically via WebSocket (testnet) |
| **Social Indexer** | Off-chain service listening to Somnia events via ethers.js — builds trader profiles and leaderboard data |
| **Leaderboard Registry** | On-chain Solidity contract storing verifiable win/loss/P&L data per wallet |
| **Signal Accuracy Log** | Database record of every AI signal and its eventual accuracy — used to retrain the model |
| **DRAW** | Settlement outcome where final BTC price equals strike price — full refund to all participants |
| **Joining Window** | The period after market open during which users can stake (≈ 1/3 of total duration) |
| **Gnosis Safe** | EVM-compatible multisig wallet used for secure contract deployment — replaces Starknet multisig |
| **Somnia Explorer** | Block explorer at `explorer.somnia.network` — replaces Starkscan |
| **Shannon Testnet** | Somnia testnet (Chain ID 50312) — replaces Starknet Sepolia |

---

> **BitDrum — trustless prediction markets, intelligent signals, and a community of on-chain traders.**
>
> *Built on Somnia. Powered by Ethers.js. Guided by AI. Ranked by the market. Capped at 70. All or nothing.*
