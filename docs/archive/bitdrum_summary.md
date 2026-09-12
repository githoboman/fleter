# BitDrum — Product Summary

**Version**: V2 (Vault-Backed Binary Market)  
**Network**: Somnia Shannon Testnet (Chain ID 50312)  
**Status**: Live on-chain, keeper automated, investor demo-ready  
**Last Updated**: 2026-04-09

---

## What BitDrum Is

BitDrum is a decentralized Bitcoin price direction prediction market built on Somnia EVM. Users stake native STT tokens on whether BTC/USD will be higher (UP) or lower (DOWN) after a set duration — either 1 minute or 5 minutes. A protocol-owned liquidity vault automatically takes the opposite side of every trade, guaranteeing a counterparty exists for every market at any time of day without any bootstrapping problem. An on-chain price adapter, fed by a keeper bot, records strike and settlement prices trustlessly. Winners claim their stake plus a profit bonus that scales with vault health.

The one-line pitch: **directional calls on Bitcoin, vault-guaranteed fills, 1-minute resolution, live on Somnia.**

---

## The User Journey

### 1. Connect a Wallet
The frontend connects to any EVM-compatible wallet (MetaMask, injected wallet) on Somnia Shannon. STT is the native gas token and the staking currency — no ERC-20 approvals or token wrapping required.

### 2. Choose a Direction and Duration
In the Command Module (Trade Panel), the user selects:
- **Direction**: UP or DOWN
- **Duration**: 1 minute (60s) or 5 minutes (300s)
- **Stake**: any amount of STT

The panel shows the **current payout rate** (30%–80% of stake, read directly from the contract), the expected reward if correct, and the full stake at risk.

### 3. Open a Market
A single `openMarket{value: stake}(direction, duration)` transaction opens the market. The contract records:
- The BTC/USD strike price from the on-chain adapter at that exact moment
- The payout rate based on current vault liquidity
- A join window (20s for 1m markets, 60s for 5m markets) during which others can join

The vault immediately commits matching STT on the opposite side.

### 4. Others Can Join
During the join window, any wallet can call `joinMarket(marketId, direction)` to join either side. The vault matches each joiner's stake on the opposite side.

### 5. Keeper Locks the Market
When the join window closes, the keeper bot calls `lockMarket(marketId)`. From this point the pool is frozen and no new participants can enter. The market runs until `expiryAt`.

### 6. Keeper Settles the Market
After `expiryAt`, the keeper:
1. Publishes a fresh BTC/USD price snapshot to the `BitdrumPriceAdapter` (so the adapter's round timestamp is after the market expiry)
2. Calls `SettlementEngineV2.settle(marketId)`, which reads the adapter's latest round and compares its price to the strike price to determine UP / DOWN / DRAW

### 7. Claim Payout
The market state transitions to `CLAIMABLE`. Winners call `claimPayout(marketId)`. The vault pays out:
- **Win**: stake returned + profit (stake × payoutBps / 10,000)
- **Draw**: stake refunded in full
- **Loss**: nothing returned

---

## V2 Contract Architecture

V2 is a complete redeployment from V1. The V2 design removes all user-supplied price data, replaces the AI-controlled POM with a deterministic vault-health formula, and introduces the `BitdrumPriceAdapter` as the sole on-chain price source.

### Live V2 Contract Addresses (Somnia Shannon)

| Contract | Address |
|---|---|
| `BitdrumPriceAdapter` | `0xDeED8D1c527F673507F445fB6cb635C48DE0acB1` |
| `PredictionMarketV2` | `0x87F8014110e5D6c69bb1A3e64f25dc595b4a861C` |
| `SettlementEngineV2` | `0x46c938d2D527A3Ca4a48ee8D8c4e72417618e67B` |
| `LiquidityVaultV2` | `0xB16927B62fccF99668B98544AFaF03c5C64d38ED` |
| `TreasuryV2` | `0x13B4A6C86EFa533e9bF3E035228021ca7Fa52ad7` |
| `LeaderboardRegistry` | `0x5BaC7081963c67518519bD70057dbA8E0e46ab45` |

Explorer: `https://shannon-explorer.somnia.network`

---

### BitdrumPriceAdapter

The keeper-fed on-chain BTC/USD oracle. Every ~20 seconds the keeper posts a new `{price, timestamp}` round. The timestamp stored in each round is the keeper's wall-clock time at the moment of posting — not the upstream exchange's timestamp.

```solidity
function postPrice(uint128 price, uint128 timestamp) external onlyKeeper returns (uint256 roundId)
function getLatestRound() external view returns (uint256 roundId, uint128 price, uint128 timestamp)
```

**Why this exists:** The DIA on-chain oracle on Shannon testnet updates every 2–30 minutes, far too slow for 1-minute markets. The adapter gives the contracts a fresh, trustworthy price source updated on demand by the keeper.

**Freshness enforcement:** `PredictionMarketV2` requires the adapter's latest round to be less than 60 seconds old when a market is opened (`ADAPTER_MAX_AGE = 60`). If the adapter is stale, `openMarket` reverts with `AdapterPriceStale`.

---

### PredictionMarketV2

The core market contract. Manages the full lifecycle from open through claim. Key design decisions:

**No user-supplied price.** Strike price is read directly from the adapter at open time — users cannot manipulate it.

**Vault-matched liquidity.** For every stake of X STT, the vault provides X STT on the opposite side. This means:
- `upPool` = sum of all UP stakes (user + vault)
- `downPool` = sum of all DOWN stakes (user + vault)

**Fixed payout rates.** `payoutBps` is locked at open time by the `_computePayoutBps()` function:

| Vault balance | Payout rate |
|---|---|
| ≥ 100 STT (`HIGH_WATER`) | 80% (8000 bps) |
| ≤ 5 STT (`LOW_WATER`) | 30% (3000 bps) |
| Between 5–100 STT | Linear interpolation |

This rate is visible in the frontend before the user confirms the transaction.

**Supported durations:**

| Duration | Join window | Total lifecycle |
|---|---|---|
| 60 seconds | 20 seconds | ~80 seconds end-to-end |
| 300 seconds | 60 seconds | ~360 seconds end-to-end |

**Protocol fee:** 2% of the total pool is routed to `TreasuryV2` on every non-draw settlement.

**State machine:**
```
OPEN → LOCKED → CLAIMABLE → CLOSED
```

---

### LiquidityVaultV2

Holds the protocol's reserve of STT. Every time a user opens or joins a market, `fundMarket()` is called to provide the vault's matching stake. On settlement, the entire pool (user + vault funds) sweeps back to the vault. Winners then claim from the vault via `payWinner()`.

The vault can only be accessed by the registered `PredictionMarketV2` contract — no direct admin withdrawal path exists by design. The vault grows over each market cycle:

```
Vault net per settled market (example: 1 STT stake, 50% payout rate):
  Vault commits 1 STT → total pool = 2 STT
  2 STT × 98% = 1.96 STT sweeps back to vault
  If vault loses: pays out 1 STT + 0.50 STT = 1.50 STT
  Vault net: +0.46 STT per cycle where vault loses
  If vault wins: pays out 0 STT
  Vault net: +1.96 STT per cycle where vault wins
```

The vault is structurally profitable at any payout rate below 100%.

**Current vault balance:** Seeded with 50 STT at V2 deployment (2026-04-09).

---

### SettlementEngineV2

The sole entity authorised to call `PredictionMarketV2.finalizeSettlement()`. The keeper calls `settle(marketId)` after expiry. The engine:

1. Verifies `market.state == LOCKED`
2. Verifies `block.timestamp >= market.expiryAt`
3. Reads `priceAdapter.getLatestRound()` — **no price data is passed by the keeper**
4. Verifies `round.timestamp >= market.expiryAt` (price must have been posted after the market expired)
5. Verifies `block.timestamp - round.timestamp <= 90` (price must still be fresh, within 90 seconds)
6. Computes outcome: `finalPrice > strikePrice → UP`, `finalPrice < strikePrice → DOWN`, `equal → DRAW`
7. Calls `predictionMarket.finalizeSettlement(marketId, outcome, price, timestamp)`
8. Calls `leaderboardRegistry` to record results for each participant

**Critical constraint:** The adapter's latest round timestamp must be **≥ market.expiryAt**. This is why the keeper force-publishes a fresh price round immediately before calling `settle()`.

---

### TreasuryV2

Receives 2% of the total pool from every non-draw settlement. Configured to distribute to vault replenishment, AI infrastructure, and a reserve.

---

### LeaderboardRegistry

Updated by `SettlementEngineV2` after every settlement. Tracks per-wallet: wins, losses, draws, total staked, total claimed, profit amounts. Read by the indexer (which also computes composite scores and tier rankings in Postgres).

---

## Oracle and Settlement — How Prices Work

### Price Source Hierarchy

The keeper's oracle module fetches BTC/USD using a three-level fallback:

1. **Binance REST API** (`api.binance.com/api/v3/ticker/price?symbol=BTCUSDT`) — Primary. Returns live USD prices updated every second. 5-second timeout.
2. **DIA on-chain oracle** (`0x9206296Ea3aEE3E6bdC07F7AaeF14DfCf33d865D`) — Secondary fallback. Updates every 2–30 minutes on testnet; accepted if less than 300 seconds old.
3. **`ORACLE_STATIC_PRICE` env var** — Tertiary fallback. Includes ±0.5% random jitter so draws don't accumulate when all live sources fail.

### Price Format

All prices are stored as 8-decimal unsigned integers:
- `$71,375.82 → 7137582000000`
- This format is consistent across the adapter, contracts, and keeper state.

### Adapter Timestamp Design

**The adapter stores the keeper's wall-clock time, not the exchange's timestamp.** This is critical:
- DIA's feed may report a timestamp 5–30 minutes old
- If the adapter stored DIA's timestamp, the settlement check `round.timestamp >= market.expiryAt` would fail for any market opened after DIA's last update
- By using `Math.floor(Date.now() / 1000)` as the post timestamp, every adapter round correctly reflects when the keeper observed and posted the price

### Settlement Timing

For a 60-second market:
```
T=0       User opens market. Adapter round R1 posted. Strike = price at R1.
T=20      Join window closes. Keeper locks market.
T=60      Market expires (expiryAt).
T=60      Keeper detects expiry on next lifecycle poll.
T=60      Keeper calls publishPriceOnce(force=true) → adapter round R2 posted
          with timestamp=T+60. Price = current Binance BTC/USD.
T=64      (4s wait for R2 tx to land)
T=64      Keeper calls settle(marketId).
          Engine reads R2: timestamp=T+60 ≥ expiryAt=T+60 ✓
          R2.price vs R1.strikePrice → UP / DOWN / DRAW
T=64      Market enters CLAIMABLE state. Users can claim.
```

The force-publish step is the key fix that eliminates draws caused by the adapter having a pre-expiry round when settlement is attempted.

---

## Keeper Architecture

The keeper is a single Node.js process running two independent loops.

### Loop 1 — Price Publisher
**Interval:** 20 seconds (configurable via `PRICE_PUBLISH_INTERVAL_MS`)

Posts a fresh BTC/USD round to `BitdrumPriceAdapter` every 20 seconds. Skips if the latest on-chain round is less than 15 seconds old (prevents double-posting). Uses `force=true` when called by the settlement path (bypasses the freshness guard).

```
fetchOraclePrice() → publishPriceOnce() → adapter.postPrice(price, nowSeconds)
```

### Loop 2 — Market Lifecycle
**Interval:** 3 seconds (configurable via `POLLING_INTERVAL`)

Scans all markets from ID 1 to `nextMarketId`. For each non-terminal market:

```
State = OPEN  and  now >= joiningWindowEnd  →  lockMarket(marketId)
State = LOCKED and  now >= expiryAt         →  publishPriceOnce(force=true)
                                                sleep(4s)
                                                settlement.settle(marketId)
```

**Checkpoint persistence:** The keeper writes market state (join deadline, expiry, last known state, tx hashes, errors) to `backend/keeper/data/keeper-state.json` after every scan. This enables correct restart behaviour without re-scanning all markets from scratch.

**Idempotency:** Terminal states (CLAIMABLE, CLOSED, NONE) are skipped on every poll. If a lock or settle tx reverts, the error is logged in keeper state and the next poll retries — there is no infinite-retry loop with different parameters.

---

## Indexer

A Node.js/viem service that polls `eth_getLogs` in 500-block batches from the V2 deploy block (`352594919`). Handles five event types:

| Event | Action |
|---|---|
| `MarketOpened` | Insert/upsert market row; insert stake record for opener |
| `MarketJoined` | Upsert market row; insert stake record for participant |
| `MarketLocked` | Upsert market row (state → LOCKED) |
| `MarketSettled` | Upsert market row (state → CLAIMABLE, settlement price, outcome) |
| `MarketClaimed` | Mark stake as claimed; store payout amount |

After processing each batch, the indexer calls `recomputeTraderProfiles()` — a full recompute of every trader's win rate, net P&L, consistency score, and tier, written back to the `traders` table.

**Trader tiers (recomputed after every batch):**

| Tier | Requirement |
|---|---|
| ORACLE | Top 1% by composite score, ≥ 3 settled markets |
| PROPHET | Top 5% by composite score, ≥ 2 settled markets |
| TRADER | Top 20% by composite score, ≥ 1 settled market |
| SCOUT | All others |

**Composite score formula:**
```
compositeScore = winRate × 0.4 + normalizedNetPnl × 0.4 + consistencyScore × 0.2
```

`consistencyScore` is 1 minus the standard deviation of rolling 7-trade win rates — it rewards traders who perform well consistently, not just occasionally.

**State persistence:** `lastProcessedBlock` is written to `backend/indexer/data/indexer-state.json` after every batch. Restarts resume from the last confirmed block.

**DB notification:** After each committed batch, the indexer fires `NOTIFY bitdrum_update` — the gateway listens on this channel and pushes WebSocket invalidations to all connected clients without polling.

---

## Gateway

An Express + WebSocket server (port 3001) that serves all API data and manages real-time client connections.

### REST Endpoints

| Endpoint | Description |
|---|---|
| `GET /health` | DB connectivity + keeper heartbeat check |
| `GET /api/markets` | All markets, ordered by open time, with signal data |
| `GET /api/markets/:id` | Single market detail + top trader alignment |
| `GET /api/positions/:address` | All positions for a wallet, with status and claim eligibility |
| `GET /api/leaderboard` | Top 50 traders by composite score |
| `GET /api/feed` | Oracle-tier or following-feed of recent stakes |
| `GET /api/signal/:marketId` | Latest AI signal for a market (advisory only) |
| `GET /api/signal/preview` | Signal preview for an un-opened market position |
| `POST /api/follow` / `DELETE /api/follow` | Social follow graph management |

### WebSocket Channels

Clients connect to `ws://localhost:3001/ws?channel=<channel>`. On connection, the gateway immediately pushes a fresh payload. On any invalidation (from Reactivity or DB notify), all subscribers on the relevant channel receive updated data.

| Channel | Data |
|---|---|
| `markets` | Full market list |
| `positions&address=<addr>` | Wallet positions |
| `leaderboard` | Leaderboard rankings |
| `feed` | Activity feed |

**Polling fallback:** If Somnia Reactivity is unavailable, the gateway self-triggers a polling invalidation every 60 seconds (`WS_REFRESH_MS`). Clients never know the difference.

**Channel deduplication cache:** The gateway caches each channel's last payload for 2 seconds. Rapid-fire invalidations (e.g., multiple events in the same block) don't cause N DB round-trips for N WebSocket clients — only one re-fetch per channel per 2-second window.

### Somnia Reactivity Bridge

The gateway subscribes to all five market events via `@somnia-chain/reactivity`. Reactivity delivers event + contract state atomically from the validator — the gateway receives consistent data at the same block as the event, with no polling lag.

When a `MarketOpened` or `MarketLocked` event arrives, the gateway also triggers AI signal precomputation (`precompute.ts`) as an optional side effect.

---

## Frontend

A Next.js 16 application with the following pages:

| Route | Content |
|---|---|
| `/` | Landing page |
| `/arena` | Full trading dashboard (chart + trade panel + positions + feed) |
| `/portfolio` | Wallet positions and P&L history |
| `/leaderboard` | Trader rankings |
| `/signals` | AI signal history |

### Trading Dashboard (`/arena`)

The main trading surface. Composed of:

- **BTC/USD Chart (Pyth Network):** Live area/candlestick chart powered by `@pythnetwork/hermes-client` and Pyth Benchmarks. Streams prices every 2 seconds. Overlays trade entry markers (arrow up/down) and the strike price line (cyan dashed) from active positions. Display-only — entirely separate from the settlement oracle.

- **Command Module (Trade Panel):** Opens or joins a market. Shows the vault payout rate read directly from `PredictionMarketV2.currentPayoutBps()` (refreshed every 30s). Duration restricted to 1m / 5m. Shows expected reward and actual risk (full stake). On submission, produces a live `ExecutionCard` with countdown timer, direction badge, entry price, and a progress bar that fills over the market duration.

- **ExecutionCards:** Displayed below the chart for each recent trade. Shows direction, stake, entry price, time remaining, and status (pending / active / settling / failed). The countdown starts at submission — not at confirmation — so users see live progress even while waiting for the tx to land.

- **"The Core" AI Section:** An advisory AI signal (direction + confidence + rationale) powered by the AI agent. Displayed in the trade panel for context. Does not control any contract logic, payout rates, or settlement. If the AI agent is offline, the section degrades gracefully to a neutral fallback message.

- **Market Feed / Positions tabs:** Switchable below the chart. Markets tab shows all open/locked markets with join capability. Positions tab shows the connected wallet's positions, status (WIN / LOSS / DRAW / CLAIMABLE / OPEN), and a Claim / Refund button for settled markets.

- **Outcome Modal:** When a position transitions to WIN, LOSS, or DRAW, a modal fires automatically showing the result, entry/settlement prices, and final P&L.

- **Zen Focus Mode:** A fullscreen overlay that embeds the chart and trade panel together for an immersive trading experience, with a live P&L ticker in the header.

### Wallet Integration

Direct EVM wallet integration (MetaMask / injected). No third-party wallet SDK. All contract calls use viem directly via `createWalletClient`. The wallet provider (`BitdrumWalletProvider`) exposes `connect()`, `disconnect()`, `wallet`, `address`, and `authenticated` state.

### Contract Interaction

| Call | Method | Transport |
|---|---|---|
| Open market | `openMarket(direction, duration)` payable | viem WalletClient |
| Join market | `joinMarket(marketId, direction)` payable | viem WalletClient |
| Claim payout | `claimPayout(marketId)` | viem WalletClient |
| Read payout rate | `currentPayoutBps()` | viem PublicClient (direct RPC) |
| Read balance | `eth_getBalance` | viem PublicClient |
| Market list / positions | Gateway REST + WebSocket | fetch / native WebSocket |

All contract ABI calls use viem `readContract` / `writeContract`. No ethers in the frontend.

---

## Economic Model

### Per-Market Accounting (Non-Draw)

Assume 1 user stakes 1 STT in direction UP with payout rate 50% (5000 bps):

```
User stake:          1 STT (UP)
Vault commitment:    1 STT (DOWN, matching)
─────────────────────────────────────────
Total pool:          2 STT

Protocol fee (2%):   0.04 STT → TreasuryV2
Swept to vault:      1.96 STT → LiquidityVaultV2
─────────────────────────────────────────
If UP wins (vault loses):
  Vault pays out:    1 STT (stake) + 0.50 STT (profit) = 1.50 STT
  Vault already received 1.96 STT from sweep
  Vault net this market: +0.46 STT

If DOWN wins (vault wins):
  Vault pays out:    0 STT
  Vault received:    1.96 STT from sweep
  Vault net this market: +1.96 STT

Expected vault net (50/50 outcome distribution): +1.21 STT per cycle
```

The vault grows with every cycle regardless of direction, because the 2% protocol fee and the winner-pays-loser dynamic always leave the vault ahead on average.

### On Draw

All user stakes are swept back to the vault (`totalPool` is transferred to vault during `finalizeSettlement`). Users then claim their original stake from the vault. No fee is charged. Vault is neutral on draws.

### Payout Rate Dynamics

The payout rate scales with vault health. A healthy vault (>100 STT) offers 80% profit — more attractive to users, higher activity, more fees. A stressed vault (<5 STT) drops to 30% — still positive, but conservative. This self-regulates vault depletion risk.

---

## Security Properties

| Property | Mechanism |
|---|---|
| No user-supplied prices | Strike and settlement prices come exclusively from the keeper-fed adapter |
| Keeper can choose *when* to settle, not *what outcome* | Outcome is computed deterministically from adapter data by the contract |
| Vault isolation | Only `PredictionMarketV2` can call `fundMarket` / `payWinner` |
| Settlement freshness | Adapter round must be ≤ 90 seconds old at settlement time |
| Settlement post-expiry | Adapter round timestamp must be ≥ market `expiryAt` |
| Checks-effects-interactions | `stake.claimed = true` is set before vault transfer in `claimPayout` |
| No admin fund extraction | Vault and market have no admin withdrawal path |
| Keeper idempotency | Terminal market states are skipped; each market processed at most once per lifecycle step |

**Note:** The keeper is currently a single operator. This is a centralisation point for *when* settlement happens, but not *what the outcome is*. A permissionless settle path (callable by anyone after a grace period) is recommended before mainnet.

---

## AI Signal Agent — "The Core"

The AI agent is an optional, advisory-only service. It does not:
- Set payout rates (those come from vault health)
- Control settlement (that is the keeper's and contract's job)
- Gate any product functionality

It does:
- Generate a directional signal (UP / DOWN / NEUTRAL) + confidence score + rationale for each market
- Store signals in the `ai_signals` PostgreSQL table
- Serve signals via `GET /api/signal/:marketId` (no subscription gating in V2)
- Surface signals in the frontend's "The Core" section as informational context

If the AI agent is offline, the trade panel degrades to a neutral fallback message. No contract behavior changes.

---

## Service Startup Order

```
1. PostgreSQL        — database must be running
2. Indexer           — begins scanning from START_BLOCK
3. Gateway           — connects to DB; starts WebSocket server
4. Keeper            — begins price publishing + lifecycle polling
5. Frontend          — starts Next.js dev server or serve build
```

**Health check:** `curl http://localhost:3001/health`

Expected response:
```json
{
  "status": "healthy",
  "service": "BitDrum Gateway V2",
  "checks": { "db": "ok", "keeper": "ok" }
}
```

The keeper heartbeat is validated by checking when `backend/keeper/data/keeper-state.json` was last written. If it's more than 30 seconds old, the gateway reports `"keeper": "stale"`.

---

## What V2 Changed From V1

| Aspect | V1 | V2 |
|---|---|---|
| Strike price source | User-supplied (passed at open time) | `BitdrumPriceAdapter` (read at open) |
| Settlement price source | Keeper-fetched, passed as calldata | `BitdrumPriceAdapter` (read at settle) |
| Payout rate | AI-controlled POM (variable) | Vault-health formula (deterministic) |
| Durations | 30s / 60s / 300s | 60s / 300s only |
| Oracle | DIA on-chain (single source) | Binance REST → DIA → static fallback |
| Adapter timestamp | DIA's own timestamp (stale on testnet) | Keeper wall-clock at post time |
| Settlement pre-step | None | Force-publish fresh round before `settle()` |
| Streams write-on-read | On every GET endpoint | Removed from read path |
| Signal gating | Subscription middleware on all routes | Open (no gating in V2) |
| Keeper structure | Single loop (settle + POM) | Two loops: publisher + lifecycle |
| Deployment | V1 contracts with drift | Fresh V2 contracts, fresh DB |
| Leaderboard tiers | 50 / 30 / 10 trade minimums | 3 / 2 / 1 trade minimums (demo-appropriate) |

---

## Known Limitations

- **Single keeper operator.** If the keeper goes offline, markets remain LOCKED and unclaimed until it restarts. A permissionless fallback settle path is the recommended next step.
- **Testnet only.** The contracts are unaudited. All funds are testnet STT with no real value.
- **Vault is non-custodial but not admin-rescuable.** If the vault is seeded beyond what markets need and those markets are never settled, the excess remains inaccessible except through normal market cycles.
- **Binance REST dependency.** If Binance is unreachable (geo-block, downtime), the keeper falls back to DIA, which on testnet may be stale. DIA failure falls to static-with-jitter. In production, additional REST sources (Coinbase, CoinGecko) should be added.
- **No formal audit.** Not production-ready.

---

## Roadmap

### Immediate (Demo-Ready)
- ✅ V2 contracts live on Shannon
- ✅ Keeper automated (publisher + lifecycle)
- ✅ Binance-primary oracle with three-tier fallback
- ✅ Force-publish before settlement eliminates DRAW accumulation
- ✅ Frontend restricted to 1m / 5m durations
- ✅ Live payout rate from contract

### Near-Term
- [ ] Permissionless settlement path after keeper grace period
- [ ] Additional Binance/CoinGecko fallback sources in oracle
- [ ] Multi-keeper support (eliminate single point of failure)
- [ ] Formal Forge test suite (unit + integration for V2 contracts)
- [ ] Docker-compose for one-command local stack

### Mainnet Preparation
- [ ] External security audit
- [ ] Multisig ownership transfer for all admin functions
- [ ] Hosted keeper + indexer + gateway infrastructure
- [ ] Frontend deployed on Vercel / Cloudflare Pages

---

## Glossary

| Term | Definition |
|---|---|
| **BitdrumPriceAdapter** | Keeper-fed on-chain contract storing BTC/USD price snapshots. The sole price source for all V2 contracts. |
| **STT** | Native gas token of Somnia Shannon testnet. Used directly as the staking currency in BitDrum — no wrapping or approvals. |
| **Vault** | `LiquidityVaultV2`. Holds protocol STT and auto-matches every user stake 1:1 on the opposing side. |
| **Keeper** | An automated Node.js process. Runs two loops: price publisher (posts to adapter every 20s) and market lifecycle (polls every 3s to lock and settle). |
| **Strike Price** | BTC/USD recorded from the adapter when a market is opened. The baseline for UP/DOWN determination. |
| **Settlement Price** | BTC/USD read from the adapter's latest round at settlement time. Compared to strike to determine outcome. |
| **Joining Window** | Time after market open during which other wallets can join. 20s for 1m markets, 60s for 5m markets. |
| **payoutBps** | Winner profit rate in basis points (1 bps = 0.01%). Set at open based on vault liquidity. 3000–8000 bps (30%–80%). |
| **DRAW** | Outcome when settlement price equals strike price. All stakes refunded, no fee charged. |
| **Reactivity** | Somnia's validator-level push notification system. Delivers contract events + atomic state without polling. |
| **Composite Score** | Per-trader score: `winRate × 0.4 + normalizedPnL × 0.4 + consistency × 0.2`. Drives leaderboard ranking and tier assignment. |
| **The Core** | The AI signal section in the trade panel. Advisory direction + confidence + rationale. Has no contract authority. |
| **Force-publish** | Calling `publishPriceOnce(force=true)` — bypasses the 15s freshness guard and always posts a new adapter round. Used by the settlement path to guarantee a post-expiry round exists. |
