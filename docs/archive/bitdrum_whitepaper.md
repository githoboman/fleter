# BitDrum: AI-Augmented Decentralized Prediction Markets on Somnia

**Version 1.0 — Somnia Shannon Testnet**

---

## Abstract

BitDrum is a decentralized protocol for short-duration Bitcoin price direction prediction markets, deployed on the Somnia EVM blockchain. Users stake native STT tokens on whether BTC/USD will be higher or lower at market expiry. A protocol-owned liquidity vault automatically matches every user stake on the opposite side, guaranteeing a counterparty for every trade. An AI signal agent analyzes on-chain trader behavior and surfaces directional trade signals with confidence scores before each market locks. Winners receive their stake back plus a dynamic profit bonus — the Probable Outcome Multiplier (POM) — ranging from 5% to 70%. An on-chain leaderboard ranks traders by accuracy, P&L, and consistency. The protocol requires no token wrapping, no pre-approval, and no intermediary: a single payable transaction opens or joins a market.

---

## 1. Introduction

### 1.1 The Problem

Prediction markets have historically suffered from three structural problems:

**Counterparty availability.** For a prediction market to function, there must be participants willing to take the opposite side. Thin markets fail to fill, and users arrive to find no matching trade. This creates a chicken-and-egg bootstrapping problem for any new market.

**Latency and settlement trust.** Off-chain prediction platforms settle manually or with delayed finality. Users must trust the operator to report outcomes honestly and pay winnings. On-chain markets exist but are typically slow, gas-heavy, or limited to long-duration events.

**Accessibility.** Existing on-chain prediction protocols require users to understand token approval flows, manage ERC-20 allowances, and navigate complex UI flows before placing a single trade. This friction eliminates casual participants.

### 1.2 The BitDrum Approach

BitDrum addresses these problems directly:

- **Liquidity vault eliminates counterparty risk.** A protocol-owned vault automatically provides the opposite-side liquidity for every trade, guaranteeing fills at any time with no bootstrapping requirement.
- **On-chain settlement via a trusted oracle.** The DIA on-chain oracle provides BTC/USD prices directly from the Somnia blockchain. The SettlementEngine contract verifies price freshness and determines the outcome trustlessly.
- **One transaction to trade.** Opening or joining a market is a single `payable` function call. Users send native STT as `msg.value`. No approvals, no wrapping, no pre-funding.
- **AI signals level the playing field.** An AI agent monitors on-chain performance patterns and generates directional trade signals with confidence scores and rationales, surfacing actionable intelligence inside the trade panel.

### 1.3 Why Somnia

Somnia is a high-throughput EVM blockchain designed for real-time applications, offering sub-second finality and throughput exceeding 1 million TPS at maturity. For a prediction market with 30-second timeframes, these properties are essential:

- Market open, join, lock, settle, and claim can all happen within a single block if needed
- The Somnia Reactivity SDK provides validator-level push notifications, so the frontend receives market state changes without polling
- The Somnia Streams SDK provides an append-log for off-chain signals (AI predictions, leaderboard snapshots) with on-chain verifiability
- The DIA oracle contract is natively deployed on Somnia testnet and mainnet, providing price feeds without external infrastructure

---

## 2. Protocol Architecture

### 2.1 System Overview

```
┌─────────────────────────────────────────────────────────┐
│                     Somnia EVM                          │
│  PredictionMarket ─── SettlementEngine                  │
│  LiquidityVault   ─── LeaderboardRegistry               │
│  Treasury         ─── SubscriptionsContract             │
│  DIA Oracle (BTC/USD on-chain)                          │
└────────────────┬────────────────────────────────────────┘
                 │ events (Reactivity push)
     ┌───────────┼───────────────────────┐
     │           │                       │
  Indexer     Keeper                  Gateway
  (viem poll   (viem + ethers         (Express +
  → Postgres)  → settle tx)           WebSocket)
     │                                   │
     └──────────────┬────────────────────┘
                    │ Postgres + Streams
                    │
                AI Agent (FastAPI)
                    │
              Frontend (Next.js)
```

BitDrum is composed of six smart contracts, four backend services, and a Next.js frontend. All services are independently deployable. The contracts have no external dependencies beyond OpenZeppelin and the DIA oracle interface.

### 2.2 Smart Contracts

#### PredictionMarket.sol

The core market lifecycle contract. Manages market creation, participation, locking, settlement, and payouts. All user-facing functions that transfer value are `payable` — users send native STT as `msg.value`.

**Key state per market:**

| Field | Type | Description |
|-------|------|-------------|
| `opener` | address | Wallet that opened the market |
| `openerDirection` | Direction | UP or DOWN |
| `duration` | uint256 | 30, 60, or 300 seconds |
| `joiningWindowEnd` | uint256 | `openedAt + duration/3` (min 10s) |
| `expiryAt` | uint256 | `openedAt + duration` |
| `strikePrice` | uint128 | BTC/USD at market open (8 decimals) |
| `settlementPrice` | uint128 | BTC/USD at settlement (8 decimals) |
| `upPool` / `downPool` | uint256 | Liquidity on each side |
| `pomProfitBps` | uint256 | Winner profit rate (500–7000 bps) |
| `state` | MarketState | OPEN → LOCKED → CLAIMABLE → CLOSED |
| `outcome` | Outcome | UP / DOWN / DRAW / PENDING |

**Market lifecycle:**

```
openMarket{value: stake}(direction, duration, strikeData)
    → state: OPEN

joinMarket{value: stake}(marketId, direction)
    → state: OPEN  (within joiningWindowEnd)

lockMarket(marketId)                      [keeper only after joiningWindowEnd]
    → state: LOCKED

finalizeSettlement(marketId, outcome, settlementData)   [SettlementEngine only]
    → state: CLAIMABLE

claimPayout(marketId)                     [winner calls directly]
    → state: CLOSED (when all claims done)
```

#### LiquidityVault.sol

Holds the protocol's reserve of native STT. For every user stake of X STT, the vault sends X STT to the `PredictionMarket` on the opposite side via `fundMarket()`. On settlement, the combined pool is swept back to the vault minus the protocol fee. Winners are paid from the vault via `payWinner()`.

```
fundMarket(marketId, direction, amount, recipient)  → sends amount STT to recipient
payWinner(recipient, principal, profit)             → sends principal + profit STT to winner
availableLiquidity()                                → returns address(this).balance
```

The vault is self-sustaining. After each market cycle, it receives back `totalPool × 98%` (2% fee to treasury) and pays out `winnerStake × (1 + POM)` to the winner. With MIN_POM_BPS = 500 (5%), the vault earns a net surplus from every settled market where there is a winning side.

#### SettlementEngine.sol

Called by the keeper bot to settle locked markets. Reads BTC/USD from the DIA oracle (passed as calldata by the keeper), compares to strike price, determines outcome, calls `PredictionMarket.finalizeSettlement`, and updates `LeaderboardRegistry` for every participant.

Price freshness is enforced: oracle data older than 150 seconds is rejected (`ORACLE_MAX_AGE = 150`). The 150-second window accommodates DIA's 120-second update cadence with a 30-second buffer.

#### Treasury.sol

Receives the 2% protocol fee on every settled non-draw market. Holds the accumulated fees and distributes them on-demand via `distribute()`, splitting 40% to the vault, 35% to an AI fund recipient, and 25% to a reserve address.

#### LeaderboardRegistry.sol

Updated by the `SettlementEngine` after every settlement. Tracks per-trader statistics: markets entered, wins, losses, total staked, total claimed, and a composite score. Provides a `getTopTraders(n)` view for leaderboard queries.

#### SubscriptionsContract.sol

Enables tiered access to AI signals. Users subscribe by sending native STT: 10 STT for PRO (30 days), 25 STT for ELITE (30 days). Fees are forwarded directly to the signal revenue pool address.

---

## 3. Economic Model

### 3.1 The Vault Matching Mechanism

Every stake of X STT triggers the vault to provide X STT on the opposing side. This means both pools always carry equal depth regardless of how many participants are on each side:

```
upPool  = Σ all stakes (both sides)
downPool = Σ all stakes (both sides)
```

This is not a two-sided orderbook. It is a liquidity-backed binary outcome market. The vault is always the counterparty — there is no dependency on finding a human counterparty.

### 3.2 Outcome Accounting

**Non-draw settlement:**

```
totalPool     = upPool + downPool = 2 × Σ userStakes
protocolFee   = totalPool × 2%   → Treasury
sweptToVault  = totalPool × 98%  → LiquidityVault
```

**Winner payout (from vault):**

```
profit = stake × pomProfitBps / 10,000
payout = stake + profit
```

**Vault net per settled market (example: 2 participants, 1 STT each, POM = 10%):**

| Flow | Amount |
|------|--------|
| Vault funds 2 stakes on opposing side | −2 STT |
| Pool swept back to vault (2×2 STT × 98%) | +3.92 STT |
| Winner paid (1 STT + 10%) | −1.10 STT |
| **Vault net** | **+0.82 STT** |

The vault grows with every market cycle, increasing available liquidity for larger stakes and higher POM rates over time.

**Draw settlement:**

All user stakes are refunded individually via `claimPayout()`. The vault's committed liquidity (`vaultCommitted`) is returned to the vault in full during `finalizeSettlement`. The vault is neutral on draws.

### 3.3 POM (Probable Outcome Multiplier)

The POM is the profit rate applied to winning stakes, set in basis points (1 bps = 0.01%). Bounds:

- Minimum: 500 bps (5%)
- Maximum: 7000 bps (70%)

The keeper sets the POM on each market via `setPomProfitBps()` before locking. The current implementation uses a configurable static value (`KEEPER_POM_BPS` env var). The AI agent's confidence score feeds into POM selection — higher-confidence signals may warrant a higher POM to attract participation on the predicted side.

### 3.4 Protocol Fee

2% of `totalPool` on every non-draw settlement goes to the `Treasury` contract. The treasury then distributes to:

| Recipient | Share | Purpose |
|-----------|-------|---------|
| LiquidityVault | 40% | Replenish vault reserves |
| AI Fund | 35% | Fund AI agent compute costs |
| Reserve | 25% | Protocol reserve / team |

---

## 4. Oracle Design

### 4.1 Price Feed

BitDrum uses the **DIA on-chain oracle** deployed natively on Somnia for settlement prices. No external API calls, no HTTP endpoints, no API keys required.

| Network | Oracle Contract | BTC/USD Adapter |
|---------|----------------|-----------------|
| Testnet (50312) | `0x9206296Ea3aEE3E6bdC07F7AaeF14DfCf33d865D` | `0x4803db1ca3A1DA49c3DB991e1c390321c20e1f21` |
| Mainnet (5031) | `0xbA0E0750A56e995506CA458b2BdD752754CF39C4` | `0xb12e1d47b0022fA577c455E7df2Ca9943D0152bE` |

**DIA interface:**

```solidity
interface IDIAOracleV2 {
    function getValue(string memory key)
        external view returns (uint128 price, uint128 timestamp);
}
```

Prices are returned as 8-decimal unsigned integers (e.g., `10500000000000` = $105,000.00).

**Update cadence:**
- Every 120 seconds, or on 0.5% price deviation — whichever comes first
- 24-hour forced heartbeat

### 4.2 Keeper Oracle Flow

The keeper reads the DIA oracle on every settlement attempt:

```typescript
const [price, timestamp] = await publicClient.readContract({
  address: DIA_ORACLE_ADDRESS,
  abi: DIA_ABI,
  functionName: 'getValue',
  args: ['BTC/USD'],
});
// Validates freshness (< 150s), then passes to SettlementEngine.settle()
```

The keeper uses a viem `fallback` transport with primary and secondary RPC endpoints. If the DIA oracle read fails (network issue), `ORACLE_STATIC_PRICE` can be set as a fallback — a hardcoded price expressed as an 8-decimal integer.

### 4.3 Price Chart

The frontend price chart uses **Pyth Network Hermes** for real-time BTC/USD streaming (2-second intervals). This is display-only and separate from settlement. Pyth provides sub-second latency which DIA's 120s cadence cannot match for a live chart experience.

---

## 5. AI Signal Agent

### 5.1 Overview

The AI Signal Agent is a Python/FastAPI service that produces directional trade signals for each market. Signals are generated at two points in the market lifecycle:

1. **MarketOpened** — when a new market is created, before the join window closes
2. **MarketLocked** — immediately before settlement, to give a final read

Signals are stored in PostgreSQL and published to the Somnia Streams append-log. The frontend reads them via the gateway REST API, displaying direction, confidence, and rationale inside the trade panel.

### 5.2 Signal Structure

```json
{
  "market_id": "42",
  "direction": "UP",
  "confidence": 73,
  "rationale": "Momentum from top-performing traders leans bullish; 68% win-rate on UP calls in last 20 markets",
  "generated_at": "2025-01-15T14:23:07Z"
}
```

### 5.3 Signal Generation Flow

```
Reactivity event: MarketOpened / MarketLocked
    → gateway/services/reactivity.ts fires precomputeSignalForMarket(marketId)
    → gateway calls AI Agent: POST /signal { marketId, direction, stake, context }
    → AI Agent queries gateway for recent market outcomes and top trader stats
    → AI Agent calls OpenAI with enriched context
    → response { direction, confidence, rationale } returned
    → gateway INSERT INTO ai_signals; publishAiSignalToStreams(signal)
    → frontend useSignal(marketId) reads via GET /api/signal/:marketId
```

### 5.4 Somnia Streams Integration

Every generated signal is published to Somnia Streams using the `@somnia-chain/streams` SDK. This creates an on-chain append-log that external consumers can read without querying the gateway:

```
Schema: bitdrum-ai-signal-v1
Fields: marketId (string), direction (string), confidence (uint32),
        rationale (string), generatedAt (string)
```

Signals are keyed by `keccak256("ai-signal:{marketId}")`, allowing deterministic lookup by market ID.

---

## 6. Real-Time Infrastructure

### 6.1 Somnia Reactivity

The gateway subscribes to all five `PredictionMarket` events via the `@somnia-chain/reactivity` SDK:

- `MarketOpened`
- `MarketJoined`
- `MarketLocked`
- `MarketSettled`
- `MarketClaimed`

Each subscription includes an `ethCall` to `getMarket(marketId)`, which the Somnia validator executes atomically at the same block as the triggering event. This is the **atomic delivery** guarantee — event data and contract state are always consistent, read from the same block.

On receiving an event, the gateway:
1. Decodes the event and extracts `marketId`
2. Publishes an internal invalidation signal
3. Pushes fresh data to all connected WebSocket clients on the relevant channel
4. Triggers AI signal precomputation for `MarketOpened` and `MarketLocked` events

**Fallback:** If the Reactivity SDK is unavailable (it is currently testnet-only), the gateway falls back to a 60-second polling refresh and continues serving all WebSocket channels without interruption.

### 6.2 Frontend WebSocket Architecture

The frontend uses a hook-based data layer. All real-time data flows through seven hooks — components never call `fetch()` or create WebSocket connections directly:

| Hook | Transport | Fallback |
|------|-----------|---------|
| `useWebSocket(url)` | Native WS | — |
| `usePositions(address)` | WS channel | REST `GET /api/positions/:address` |
| `useFeed(type, address)` | WS channel | REST `GET /api/feed` |
| `useLeaderboard()` | WS channel | REST `GET /api/leaderboard` |
| `useMarketDetail(marketId, address?)` | viem multicall (direct RPC) | Gateway `GET /api/markets/:id` |
| `useSignal(marketId, direction?, stake?)` | REST (precomputed, 120s refetch) | — |
| `usePom(marketId, direction?, stake?)` | REST (120s refetch) | — |

`useMarketDetail` reads the contract state directly via a viem multicall (pool sizes, state, balance) without going through the gateway at all. This is the hot path — it eliminates a full gateway round-trip for the most latency-sensitive data.

### 6.3 Indexer

The indexer is a Node.js service that polls `eth_getLogs` in configurable block batches (default 500 blocks). It handles six event types, writing to five PostgreSQL tables:

| Table | Contents |
|-------|---------|
| `traders` | Unique trader addresses |
| `markets` | Full market lifecycle state |
| `stakes` | Per-market per-trader position records |
| `ai_signals` | AI signal history per market |
| `follows` | Social follow graph |

The indexer persists its `lastProcessedBlock` to a local state file, enabling restarts from the correct position without re-scanning from genesis. It uses a viem `fallback` transport across two RPC endpoints for resilience.

---

## 7. Security Model

### 7.1 Trust Assumptions

| Component | Trust Level | Notes |
|-----------|-------------|-------|
| PredictionMarket.sol | Trustless | Fully on-chain, deterministic |
| SettlementEngine.sol | Keeper-trusted | Keeper passes oracle price; contract validates freshness |
| LiquidityVault.sol | Protocol-owned | Only PredictionMarket can call fundMarket/payWinner |
| DIA Oracle | Oracle trust | On-chain, operated by DIA; deviation threshold prevents manipulation |
| Keeper bot | Semi-trusted | Can choose *when* to settle but not *what outcome* |
| AI Agent | Display-only | Signals are informational; no contract authority |

### 7.2 Key Security Properties

**No fund loss on keeper failure.** If the keeper fails to settle a market, user funds remain in the `PredictionMarket` contract. Users can wait for the keeper to resume. In a future upgrade, a permissionless `settle()` path could allow anyone to trigger settlement after expiry.

**Oracle freshness enforcement.** Both `PredictionMarket` and `SettlementEngine` reject oracle data older than 150 seconds (`ORACLE_MAX_AGE = 150`). A stale price cannot be used to manipulate the strike or settlement outcome.

**No admin key on core flows.** `openMarket`, `joinMarket`, `claimPayout`, and `distribute()` are callable by anyone. Admin functions (`setSettlementEngine`, `setPredictionMarket`, `setRecipients`) are owner-only and affect configuration, not funds.

**Vault isolation.** The vault only accepts calls from the registered `PredictionMarket` address (`onlyPredictionMarket` modifier). It cannot be drained by any other contract or EOA.

**Re-entrancy.** All external calls in `claimPayout` and vault payouts use Solidity's native `call{value:}`. State is updated before the external call in `claimPayout` (`stake.claimed = true` before transfer), following the checks-effects-interactions pattern.

### 7.3 Known Limitations (Testnet)

- No formal audit has been conducted. Not production-ready without one.
- The keeper is a single point of settlement. A multi-keeper design or a permissionless settlement path is recommended before mainnet.
- POM is set statically by the keeper. A fully on-chain POM oracle (reading vault depth and signal confidence) is a future improvement.
- The AI agent uses OpenAI — a centralized dependency. A local model or on-chain verifiable inference is a longer-term goal.

---

## 8. Deployment

### 8.1 Contracts

Six contracts are deployed in a single Foundry script. The deployer sends 10 STT with the transaction to seed the vault:

```
LiquidityVault          ← receives 10 STT seed
Treasury
LeaderboardRegistry
PredictionMarket        ← wired to vault + settlement engine
SettlementEngine        ← wired to market + leaderboard
SubscriptionsContract
```

All contracts use `Ownable` from OpenZeppelin. Ownership transfers to a multisig before mainnet.

### 8.2 Network Configuration

| Parameter | Testnet (Shannon) | Mainnet |
|-----------|------------------|---------|
| Chain ID | 50312 | 5031 |
| Native token | STT | SOMI |
| RPC | `https://dream-rpc.somnia.network` | `https://api.infra.mainnet.somnia.network` |
| Explorer | `https://shannon-explorer.somnia.network` | `https://explorer.somnia.network` |
| Multicall3 | `0x841b8199E6d3Db3C6f264f6C2bd8848b3cA64223` | `0x5e44F178E8cF9B2F5409B6f18ce936aB817C5a11` |
| DIA Oracle | `0x9206296Ea3aEE3E6bdC07F7AaeF14DfCf33d865D` | `0xbA0E0750A56e995506CA458b2BdD752754CF39C4` |

### 8.3 Backend Services

| Service | Port | Language | Role |
|---------|------|----------|------|
| AI Agent | 8000 | Python / FastAPI | Signal inference |
| Indexer | — | Node.js / viem | Event → Postgres |
| Gateway | 3001 | Node.js / Express | REST + WebSocket API |
| Keeper | — | Node.js / ethers + viem | Lock + settle automation |

### 8.4 Wallet Integration

The frontend uses **Privy** for wallet connection, supporting both social login (email/Google for new users) and direct MetaMask/injected wallet connection for crypto-native users. No RainbowKit or Wagmi — all contract interactions use viem directly.

---

## 9. Roadmap

### Phase 1 — Testnet (Current)
- ✅ Core contracts: PredictionMarket, LiquidityVault, SettlementEngine, Treasury, LeaderboardRegistry
- ✅ Native STT staking (no token wrapping)
- ✅ Keeper automation: lock + settle with DIA on-chain oracle
- ✅ AI signal agent: OpenAI-powered directional signals
- ✅ Real-time frontend: Reactivity push + WS hooks + viem multicall
- ✅ Somnia Streams: AI signals and leaderboard published on-chain
- ✅ Privy wallet integration

### Phase 2 — Testnet Hardening
- [ ] Formal Forge test suite (unit + integration)
- [ ] Multi-keeper setup (eliminate single point of settlement failure)
- [ ] Permissionless settlement path after grace period
- [ ] On-chain POM calculation (vault depth + signal confidence)
- [ ] Account dashboard: position history, PnL, claimable payouts
- [ ] Docker-compose for one-command local stack

### Phase 3 — Mainnet Preparation
- [ ] External security audit
- [ ] Multisig ownership for all admin functions
- [ ] Mainnet DIA oracle integration (no code change required, only address)
- [ ] Production infra: hosted keeper, indexer, gateway
- [ ] Frontend on Vercel (mainnet configuration)

### Phase 4 — Protocol Expansion
- [ ] Additional assets (ETH/USD, SOL/USD) using DIA adapters
- [ ] Longer timeframes (1h, 4h, 24h)
- [ ] Verifiable AI inference (replace OpenAI with reproducible on-chain signal)
- [ ] DAO governance for POM bounds, fee splits, and supported assets

---

## 10. Glossary

| Term | Definition |
|------|-----------|
| **POM** | Probable Outcome Multiplier. The profit rate (in bps) applied to a winning stake. Set by the keeper, bounded 500–7000 bps. |
| **STT** | The native gas token of Somnia Shannon testnet. Used directly as the staking token in BitDrum. |
| **SOMI** | The native token of Somnia Mainnet. |
| **Vault** | `LiquidityVault.sol`. Holds protocol-owned STT. Matches every user stake 1:1 on the opposing side. |
| **Keeper** | An automated Node.js bot that calls `lockMarket` and `SettlementEngine.settle` at the appropriate times. |
| **Strike Price** | The BTC/USD price recorded when a market is opened. Used as the baseline for determining UP/DOWN outcome. |
| **Settlement Price** | The BTC/USD price submitted by the keeper at settlement. Compared to strike price to determine outcome. |
| **Joining Window** | The time period after market open during which additional participants can join. `duration ÷ 3`, minimum 10 seconds. |
| **DIA Oracle** | Decentralized oracle protocol with BTC/USD price feeds natively deployed on Somnia. Updates every 120s. |
| **Reactivity** | Somnia's validator-level push notification system. Delivers contract events + atomic state to subscribers without polling. |
| **Streams** | Somnia's on-chain append-log. Used by BitDrum to publish AI signals and leaderboard snapshots. |
| **Multicall3** | A deployed contract that batches multiple view calls into one RPC request. Used by the frontend for efficient market + balance reads. |

---

## Appendix: Contract Addresses (Testnet — to be populated after deploy)

```
PREDICTION_MARKET_ADDRESS=
SETTLEMENT_ENGINE_ADDRESS=
LIQUIDITY_VAULT_ADDRESS=
TREASURY_ADDRESS=
LEADERBOARD_REGISTRY_ADDRESS=
SUBSCRIPTIONS_CONTRACT_ADDRESS=
```

---

*BitDrum is deployed on the Somnia Shannon testnet. Contract code is unaudited. Use testnet funds only.*
