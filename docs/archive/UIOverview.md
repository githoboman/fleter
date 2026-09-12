# BitDrum Frontend — UI Overview

## Table of Contents

1. [Pages & Routing](#1-pages--routing)
2. [Provider & Initialization Layer](#2-provider--initialization-layer)
3. [Design System](#3-design-system)
4. [Component Architecture](#4-component-architecture)
5. [Section-by-Section Breakdown](#5-section-by-section-breakdown)
   - 5.1 Navigation Bar
   - 5.2 Pending Trades Banner
   - 5.3 Price Chart
   - 5.4 Active Predictions
   - 5.5 Trade / Execution Panel
   - 5.6 Live Activity (Social Feed)
   - 5.7 Leaderboard
   - 5.8 Account Modal
   - 5.9 Outcome Modal (Win / Loss / Draw)
   - 5.10 Footer
6. [Data Layer — All Requests Made](#6-data-layer--all-requests-made)
   - 6.1 REST Endpoints (via React Query)
   - 6.2 WebSocket Channels
   - 6.3 External Data (Pyth Oracle)
   - 6.4 On-chain Reads (viem)
   - 6.5 On-chain Writes (viem wallet client)
7. [State Management](#7-state-management)
8. [Wallet & Auth Flow](#8-wallet--auth-flow)
9. [Error Handling](#9-error-handling)
10. [Known Gaps & Incomplete Areas](#10-known-gaps--incomplete-areas)

---

## 1. Pages & Routing

The app is a **single-page application** built on Next.js (App Router). There is exactly **one route**:

| Route | File | Description |
|-------|------|-------------|
| `/`   | `src/app/page.tsx` | Mounts `<TradingDashboard />` — the entire UI lives here |

No other routes exist. Navigation between "Trading", "Wallet", and "Leaderboard" tabs in the navbar are **cosmetic only** — they do not navigate or render different views. The Wallet tab opens the Account Modal; Leaderboard is a no-op button.

**Meta:**
- Title: `BitDrum | Intelligent Prediction Protocol`
- Description: `Next-generation decentralized prediction protocol on Starknet.`
- Body base colour: `#0a0a0a`
- Font: `Arial, Helvetica, sans-serif` (system sans-serif, no custom typeface loaded)

---

## 2. Provider & Initialization Layer

The app wraps all children in two providers, nested in this order inside `<Providers>`:

```
<QueryClientProvider>          ← TanStack React Query (single shared QueryClient)
  <BitdrumWalletProvider>      ← Custom wallet context (see §8)
    {children}
  </BitdrumWalletProvider>
</QueryClientProvider>
```

`QueryClient` is instantiated once at module scope (not inside the component), meaning it persists for the lifetime of the browser tab without reset. No devtools panel is configured.

---

## 3. Design System

### Colour Palette

| Role | Value | Used For |
|------|-------|----------|
| Background | `#0a0a0a` | Page, body |
| Glass surface | `rgba(255,255,255,0.03)` | All cards via `.glass-morphism` |
| Glass border | `rgba(255,255,255,0.10)` | Card borders |
| Text primary | `#ededed` | Headings, values |
| Text muted | `text-slate-500` (≈ `#64748b`) | Labels, metadata |
| Accent orange | `#f97316` (Tailwind `orange-500`) | Brand colour, CTAs, live indicators |
| Accent gold | `#fbbf24` (Tailwind `amber-400`) | Gradient end, ORACLE tier badge |
| Success green | `#10b981` (Tailwind `emerald-500`) | WIN outcomes, UP direction, confirmed tx |
| Danger red | `#f43f5e` (Tailwind `rose-500`) | LOSS outcomes, DOWN direction, failed tx |
| Active blue | `blue-500/20` tones | OPEN/PENDING position cards |
| Warning orange | `orange-500/10` tones | Submitted/pending tx banners |

### Gradients

Two utility classes defined in `globals.css`:

- `.bg-gradient` — left-to-right `#f97316 → #fbbf24` (orange → gold). Used on the BD logo mark and the wallet avatar.
- `.text-gradient` — same gradient applied as a text clip effect. Defined but not currently used in rendered components.

### Typography

All text is uppercase-heavy with tight letter-spacing for a "protocol / terminal" aesthetic:

- Section headings: `text-lg font-bold uppercase tracking-tight`
- Sub-labels: `text-[10px] font-black uppercase tracking-[0.28em–0.32em] text-slate-500`
- Numeric values: `font-mono` class — browser monospace stack
- Button labels: `font-black uppercase italic tracking-tight` (main CTA) or `font-black uppercase tracking-[0.2em–0.28em]` (secondary)

### Glassmorphism Cards

Every major content block uses the `.glass-morphism` utility class:

```css
background: rgba(255,255,255,0.03)
backdrop-filter: blur(12px)
border: 1px solid rgba(255,255,255,0.10)
box-shadow: 0 8px 32px 0 rgba(0,0,0,0.37)
border-radius: 1rem (rounded-2xl)
padding: 1.5rem (p-6)
transition: all 300ms
```

On hover the border lightens to `rgba(255,255,255,0.20)` and the background steps to `rgba(255,255,255,0.05)`.

### Layout Grid

The main content uses a responsive 12-column grid:

```
lg: grid-cols-12
  Left column:  lg:col-span-8  → Price chart + Active positions
  Right column: lg:col-span-4  → Trade panel + Social feed + Leaderboard
```

On mobile (`< lg`) everything stacks to a single column. Gap between columns: `gap-6`.

### Interaction States

- **Disabled buttons**: `disabled:cursor-not-allowed disabled:opacity-50`
- **Hover transitions**: `transition` (150ms default) on most interactive elements
- **Focus**: inputs use `focus:border-orange-500/40`, no outline ring
- **Selection highlight**: `selection:bg-orange-500 selection:text-white` on the root container

---

## 4. Component Architecture

```
src/
├── app/
│   ├── layout.tsx            Root layout — meta, body, Providers wrapper
│   ├── page.tsx              Single route, renders <TradingDashboard />
│   └── globals.css           Tailwind base + custom utilities
│
├── components/
│   ├── Providers.tsx         QueryClientProvider + BitdrumWalletProvider
│   ├── BitdrumWalletProvider.tsx   Wallet context (connect / disconnect / address)
│   ├── TradingDashboard.tsx  Main page layout, nav, modals, positions list
│   ├── TradePanel.tsx        Right-rail trade execution widget
│   ├── PriceChart.tsx        Lightweight-charts BTC/USD area chart
│   └── SocialFeed.tsx        MarketFeed + LeaderboardCard
│
├── hooks/
│   ├── useWebSocket.ts       Generic WS hook (reconnects on url change)
│   ├── usePositions.ts       User positions (REST + WS)
│   ├── useFeed.ts            Social feed (REST + WS)
│   ├── useLeaderboard.ts     Rankings (REST + WS)
│   ├── useSignal.ts          AI signal (REST, polling)
│   ├── usePom.ts             POM multiplier (REST, polling)
│   └── useMarketDetail.ts    Single market state (on-chain first, REST fallback)
│
└── utils/
    ├── somnia.ts             Network config, env vars, addresses
    ├── bitdrum.ts            Contract ABIs, tx helpers, type definitions, formatters
    ├── contracts.ts          viem public client, multicall reads
    └── pyth.ts               (file exists, not imported anywhere — possibly unused)
```

---

## 5. Section-by-Section Breakdown

### 5.1 Navigation Bar

**Location:** Top of `TradingDashboard`, full-width.

**Left side:**
- BD logo mark: 48×48px orange→gold gradient rounded square with bold italic "BD" text.
- App name: "BitDrum" + sub-label "Intelligence Protocol".

**Centre (desktop only, hidden on mobile):**
Three tab buttons styled as underline tabs. Only the first ("Trading") has an active underline (`border-orange-500`). The others ("Wallet", "Leaderboard") are visually inactive:
- "Wallet" opens the Account Modal when `authenticated === true`, does nothing otherwise.
- "Leaderboard" is a no-op button (no handler attached).

**Right side:**
- Bell icon button: renders a small orange dot badge. No functionality — it is purely decorative.
- **Unauthenticated state:** Orange ghost button "Connect Wallet" with Wallet icon. Calls `connect()` on click, then opens Account Modal on success. Shows "Connecting..." with disabled state during the async handshake.
- **Authenticated state:** Pill button showing a gradient avatar circle with first two hex chars of the address, plus the wallet label. Opens Account Modal on click.
- Mobile hamburger menu button (visible `< md`): no functionality wired up.

---

### 5.2 Pending Trades Banner

**Location:** Below nav, above main grid. Conditional — only rendered when `pendingTrades.length > 0`.

Displays up to 3 most-recent trade execution records as horizontal pill banners. Each banner shows:
- UP/DOWN trend icon (emerald `TrendingUp` / rose `TrendingDown`).
- Direction label + stake amount in STT.
- Status badge: "submitted" (orange), "confirmed" (emerald), "failed" (rose).
- "Explorer" link (opens Somnia explorer tx URL in a new tab) — only shown when `explorerUrl` is present.
- ✕ dismiss button to remove from the list.

Border and background colour shifts to match status. Up to 8 records are kept in state; the banner shows only 3 at a time.

---

### 5.3 Price Chart

**Component:** `PriceChart.tsx`  
**Location:** Top-left of main grid (col-span-8).  
**Height:** 450px glass card containing a 380px chart canvas + optional execution mini-cards below.

**Chart library:** `lightweight-charts` v5 (TradingView). Configured as:
- Area series: orange line (`#f97316`), orange-to-transparent fill.
- Transparent background, white/5 grid lines.
- Time scale with minutes visible, seconds hidden.
- Responsive — `ResizeObserver` adjusts width on window resize.

**Data source — historical (on mount):**  
`GET https://benchmarks.pyth.network/v1/shims/tradingview/history?symbol=Crypto.BTC/USD&resolution=1&from=T-4h&to=T`  
Loads the last 4 hours of 1-minute BTC/USD close prices. Fires once at chart initialisation.

**Data source — live streaming:**  
`@pythnetwork/hermes-client` polling `https://hermes.pyth.network` for price ID `0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43` (BTC/USD).  
Interval: **every 2 seconds**. Each update calls `series.update()` to append a new candle, updates the displayed price and `priceChange %`, and pushes the price up to the parent via `onPriceUpdate` callback (stored as `currentBtcPrice` in dashboard state).

**Live indicator:** When at least one Hermes response has been received, a pulsing orange "STREAMING" badge appears next to the "Pyth Core Oracle" label.

**Price display:**
- Large monospace price: `$XX,XXX.XX`
- Percentage change badge: green `▲` or red `▼` with 4dp precision.

**Trade markers:**  
After trades are submitted, `TradingDashboard` computes `TradeMarker[]` from `pendingTrades` + resolved `positions`. These are applied via `createSeriesMarkers()` (lightweight-charts v5 API) as coloured arrow markers on the chart (green arrowUp for UP, red arrowDown for DOWN). Previous marker plugin instance is detached before re-applying.

**Execution mini-cards (below chart):**  
Up to 4 recent `TradeExecutionRecord` entries are shown as compact cards beneath the chart canvas. Each shows: kind (Execution Opened / Joined #id), direction + timeframe, status badge, entry price + stake.

---

### 5.4 Active Predictions

**Component:** Part of `TradingDashboard.tsx`  
**Location:** Below PriceChart, still in left column (col-span-8).

**Header:**
- Title "Active Predictions" + pulsing blue dot indicator when any position has `status === 'OPEN'` or `PENDING`.
- Sub-label "Live Portfolio" + live BTC price appended when available (e.g. `Live Portfolio · BTC $84,231.50`).
- Right-side: Win Rate % badge + PnL badge (from `positionSummary`).

**Loading state:** Shows "Reading positions" placeholder with dashed border.

**Empty state:** Shows "No active stakes yet" (authenticated) or "Connect wallet to load positions" (unauthenticated).

**Position cards:** One `<article>` per `PositionRecord`. Border and background colour depends on status:
- `WIN` → emerald border/tint
- `LOSS` → rose border/tint
- `OPEN` / `PENDING` → blue border/tint
- All others → white/10 neutral

Each card contains:

**Header row:**
- Market ID + direction in uppercase (e.g. `Market #42 · UP`)
- Blue pulsing dot for OPEN/PENDING status
- Status label (e.g. `OPEN`) + duration label (e.g. `5m market`)
- **Countdown timer** (live, ticking every 1s) using `settlement_deadline` unix timestamp:
  - `> 30s remaining` → white/grey monospace countdown (`⏱ 4m 22s`)
  - `≤ 30s remaining` → orange text
  - `≤ 10s remaining` → red + pulsing animation
  - `0s / expired` → orange pulsing "Settling…" badge

**Action buttons (top-right):**
- "Details" button (WIN/LOSS/DRAW) → opens Outcome Modal
- "Claim" button (when `can_claim === true`) → calls `claimPayout()` on-chain; shows "Claiming" with disabled state while in progress; invalidates positions/feed/leaderboard queries on success.

**Stats grid (2×2 on small, 4-col on sm+):**
- Stake (formatted STT)
- Payout (expected payout in STT)
- Entry (oracle price formatted to 2dp, e.g. `$84,231.50` — shown as `--` if unavailable)
- Net PnL (green if positive, red if negative)

**Transaction link:** When `transaction_hash` is available, a "View Transaction" link opens the Somnia explorer.

---

### 5.5 Trade / Execution Panel

**Component:** `TradePanel.tsx`  
**Location:** Top of right column (col-span-4).

Operates in two modes, determined by whether a market has been selected from the feed:

#### Mode A — Open New Market (`mode === 'open'`)

The user is creating a brand new prediction market on-chain.

**Elements:**
1. **Preview direction toggle** — Two buttons ("Preview UP" / "Preview DOWN") that set `previewDirection` state. Drives the `useSignal` and `usePom` query keys.
2. **Duration selector** — Four buttons: `30s`, `1m`, `5m`, `10m`. Default: `5m (300s)`. Sets `durationSeconds` state.
3. **Stake input** — Numeric text input in STT. Default: `"1"`. Shows wallet balance beneath label if known.
4. **Signal Layer card** — Displays AI signal: direction badge, rationale text, confidence %, and POM %. If loading shows placeholder text.
5. **Projected Profit card** — Calculates `stake × (pomBps / 10000)` projected profit and total payout estimate.
6. **UP / DOWN trade buttons** — Full-width green/red buttons. Disabled when: `isPending`, not `authenticated`, or (in join mode) market is not OPEN.

#### Mode B — Join Existing Market (`mode === 'join'`)

Triggered when user clicks "Join" on a feed item. The `selectedMarket` object is passed as a prop.

**Elements:**
1. **Back button** — Calls `onClearSelection()`, returning to Mode A.
2. **Live Pool card** — Shows UP Pool / DOWN Pool in STT, timeframe, direction, and market state badge (e.g. "OPEN").
3. *(Duration selector is hidden in join mode)*
4. Stake, Signal Layer, Projected Profit, trade buttons — same as Mode A.

**On trade execution:**
- Calls `openMarket()` or `joinMarket()` from `utils/bitdrum.ts`.
- Both first check native STT balance via `publicClient.getBalance()`, throwing a descriptive error if insufficient.
- Creates a `TradeExecutionRecord` immediately on submission, calls `onTradeSubmitted` prop to push it into dashboard state.
- `.wait()` is called non-blockingly (`.then()/.catch()`) to track confirmation. On confirmation: queries `feed`, `leaderboard`, `positions`, `market-detail-onchain` are all invalidated.
- **Last record** is shown inline below the form: spinner + "Submitted — awaiting confirmation" → "✓ Transaction confirmed" with a breakdown table (duration, entry price, settlement time, projected profit), or "✗ Transaction failed" with error message.

**Wallet not connected state:** A large "⚠️ Connect Wallet To Trade" orange button replaces the normal interface gate. Trade buttons remain visible but disabled.

---

### 5.6 Live Activity (Social Feed)

**Component:** `MarketFeed` in `SocialFeed.tsx`  
**Location:** Middle of right column, below Trade Panel.

**Header:** "Live Activity" / "Social Flow" with orange `Activity` icon and "WebSocket" badge.

**Feed type tabs:** Three toggle buttons:
- `Following` — Only active when `viewerAddress` is known; disabled (greyed, not-allowed cursor) when disconnected.
- `Oracle` — Default for unauthenticated users.
- `Trending` — No access restriction.

**Follow widget:** Only rendered when `viewerAddress` is set. Contains an address input and "Follow" button that POSTs to `POST /api/follow`. Shows "Following wallet" or error message inline.

**Feed items (`FeedItem`):** Each card shows:
- Tier badge (ORACLE → amber, PROPHET → cyan, TRADER → emerald, default → neutral).
- Shortened wallet address (`0xABCD...WXYZ`).
- Action text: "Opened market #N" or "Joined market #N".
- UP / DOWN direction badge (green/red).
- Stake amount in STT.
- UP Pool / DOWN Pool (labelled "Pool").
- Timeframe (e.g. `5m`).
- Market state (OPEN / LOCKED / etc.).
- AI signal line: `AI: UP (84%)` — only shown when signal data exists on the feed item.
- **Join button** — orange, disabled when `state !== 'OPEN'`. On click: calls `onJoinMarket` prop, passing a `MarketRecord` constructed from feed item fields. This sets `selectedMarket` in the dashboard, switching the Trade Panel to Mode B.

Selected market highlight: if `selectedMarketId` matches a feed item's `market_id`, that card gets an orange border/tint instead of the default white/10.

---

### 5.7 Leaderboard

**Component:** `LeaderboardCard` in `SocialFeed.tsx`  
**Location:** Bottom of right column.

Shows the top 5 ranked traders. Each row:
- Rank number (slate-600, large)
- Shortened address + win rate %
- Tier badge (amber / cyan / emerald / neutral)
- Score value

Loading: "Computing tiers" placeholder.  
Empty: "No ranked traders yet".

---

### 5.8 Account Modal

**Trigger:** Clicking the connected wallet button in the navbar, or the "Wallet" nav tab when authenticated.

**Overlay:** `fixed inset-0 z-50 bg-black/90 backdrop-blur-md`.

**Content:**
- Title "Somnia Wallet Session" + close button (rotated `LogOut` icon).
- Left column: Wallet Label (username or "Injected Wallet"), Execution Wallet (full address or "DISCONNECTED").
- Right column: Session Mode description text + two action buttons:
  - "Open Explorer Profile" → `openProfile()` → `window.open(explorer/address/0x...)`.
  - "Disconnect" → calls `disconnect()`, clears `selectedMarket`, closes modal.

When this modal is open, the entire main grid blurs and fades to `opacity-20` via `blur-xl opacity-20`.

---

### 5.9 Outcome Modal (Win / Loss / Draw)

**Trigger:** Auto-shown when any position in `positions[]` transitions to `WIN`, `LOSS`, or `DRAW` status (tracked via a `seenOutcomes` ref to fire only once per position per session). Also manually triggerable via the "Details" button on any resolved position card.

**Overlay:** `fixed inset-0 z-[60] bg-black/80 backdrop-blur-lg` (z-index above Account Modal).

**Content varies by outcome:**
- **WIN:** Emerald colour scheme, Trophy icon, "You Won!" heading, "Collect Winnings" CTA button.
- **DRAW:** Orange colour scheme, 🤝 emoji, "Draw" heading, "Close" CTA.
- **LOSS:** Rose colour scheme, 💸 emoji, "You Lost" heading, "Trade Again" CTA.

All show:
- Market ID + direction in the sub-label.
- Stake amount (STT).
- Net PnL (STT) with colour coding.
- Entry price + Settlement price (oracle formatted to 2dp) — hidden if both are null.

Close button and CTA button both call `onClose` which sets `outcomeModal` to null.

---

### 5.10 Footer

Sits at the bottom of the dashboard, below the main grid. Normally heavily muted: `opacity-30 grayscale`. On hover: `opacity-100 grayscale-0`. Blurs when Account Modal is open.

Contains:
- "SOMNIA PREDICTION PROTOCOL 2026"
- Three text links: Twitter, Discord, Docs — no `href` attributes, purely decorative.

---

## 6. Data Layer — All Requests Made

### 6.1 REST Endpoints (via React Query)

All REST calls use `fetch()` via React Query's `queryFn`. The base URL is `process.env.NEXT_PUBLIC_API_URL` (defaults to `http://localhost:3001/api`).

| Hook | Endpoint | Method | Trigger | Refetch Interval |
|------|----------|--------|---------|-----------------|
| `usePositions` | `GET /api/positions/:address` | GET | address known | **15 seconds** |
| `useFeed` | `GET /api/feed?type=&address=` | GET | always | 5 minutes |
| `useLeaderboard` | `GET /api/leaderboard` | GET | always | 5 minutes |
| `useSignal` | `GET /api/signal/:marketId` or `GET /api/signal/preview?direction=&stake=` | GET | marketId or preview inputs change | 2 minutes |
| `usePom` | `GET /api/pom/:marketId` or `GET /api/pom/preview?direction=&stake=` | GET | marketId or preview inputs change | 2 minutes |
| `useMarketDetail` | `GET /api/markets/:marketId` | GET | fallback if on-chain read fails | no auto-refetch |
| `MarketFeed` | `POST /api/follow` body `{followerAddress, followingAddress}` | POST | user clicks "Follow" | — (manual) |

**Query invalidation after trades:**
On trade confirmation (`tx.wait()` resolves) the following keys are invalidated:
- `['feed']`
- `['leaderboard']`
- `['positions']`
- `['market-detail-onchain']`

On claim confirmation:
- `['positions', viewerAddress]`
- `['feed']`
- `['leaderboard']`

---

### 6.2 WebSocket Channels

WebSocket base URL: `process.env.NEXT_PUBLIC_WS_URL` (defaults to the REST base with `http` replaced by `ws` and `/api` suffix removed, e.g. `ws://localhost:3001/ws`).

Each WebSocket connection is opened by `useWebSocket<T>(url)`. The hook creates a new `WebSocket` whenever the URL changes and tears it down on unmount. No reconnect logic is implemented — if the socket errors it sets state to `null` and stays closed until the component re-mounts or the url changes.

| Hook | WS URL | Channel | Payload shape |
|------|--------|---------|---------------|
| `usePositions` | `/ws?channel=positions&address=0x…` | `positions` | `{ positions: PositionRecord[], summary: { win_rate, resolved_pnl } }` |
| `useFeed` | `/ws?channel=feed&type=…&address=…` | `feed` | `{ feed: FeedItem[] }` |
| `useLeaderboard` | `/ws?channel=leaderboard` | `leaderboard` | `{ rankings: LeaderboardEntry[] }` |

WS data takes priority over REST data: `livePayload ?? query.data`. If WS data is present, the REST query result is ignored for the current render.

---

### 6.3 External Data (Pyth Oracle)

Handled entirely within `PriceChart.tsx`. No React Query — raw `fetch` + `setInterval`.

| Request | URL | When | Purpose |
|---------|-----|------|---------|
| Historical candles | `https://benchmarks.pyth.network/v1/shims/tradingview/history` | Once on mount | Seed chart with last 4 hours of 1m BTC/USD closes |
| Live price stream | `https://hermes.pyth.network` via `HermesClient.getLatestPriceUpdates()` | Every 2 seconds | Append real-time BTC/USD price to chart, update price display |

Price ID: `0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43` (BTC/USD Pyth price feed).

The live price is lifted out to the dashboard via `onPriceUpdate` callback and stored as `currentBtcPrice` state, which is then:
- Displayed in the Active Predictions header sub-label.
- Passed to `TradePanel` as `currentPrice` prop for strike price computation.

---

### 6.4 On-chain Reads (viem public client)

Handled in `utils/contracts.ts`. A singleton `PublicClient` is created on first call pointing to `ACTIVE_SOMNIA_NETWORK.rpcUrls[0]`.

| Function | Contract call | Used by |
|----------|--------------|---------|
| `readMarketOnchain(marketId)` | `getMarket(uint256)` | `useMarketDetail` (primary path) |
| `readMarketAndBalance(marketId, address)` | `getMarket(uint256)` + `getBalance(address)` in parallel | `useMarketDetail` when wallet is connected |
| `readMarketsOnchain(ids[])` | `multicall3` batch of `getMarket` calls | Defined but not currently called from any hook or component |
| `readSttBalance(address)` | `getBalance(address)` | Defined but not currently called from any hook or component |

**Network config (active at runtime):**
- If `NEXT_PUBLIC_CHAIN_ID === "5031"` → **Somnia Mainnet** (chainId 5031, RPC `https://api.infra.mainnet.somnia.network`, native token SOMI)
- Otherwise → **Somnia Shannon testnet** (chainId 50312, RPC `https://dream-rpc.somnia.network`, native token STT)

---

### 6.5 On-chain Writes (viem wallet client)

Handled in `utils/bitdrum.ts`. Uses the user's injected wallet (`window.ethereum`) via `createWalletClient`.

Before every write, `ensureSomniaChain()` is called to switch or add the Somnia chain. On failure it falls back to `wallet_addEthereumChain`.

| Function | Contract | Method | Value (payable) | Called from |
|----------|----------|--------|----------------|-------------|
| `openMarket()` | `PREDICTION_MARKET_ADDRESS` | `openMarket(direction, duration, strikeData)` | stake in STT (wei) | `TradePanel.handleTrade()` (mode=open) |
| `joinMarket()` | `PREDICTION_MARKET_ADDRESS` | `joinMarket(marketId, direction)` | stake in STT (wei) | `TradePanel.handleTrade()` (mode=join) |
| `claimMarket()` | `PREDICTION_MARKET_ADDRESS` | `claimPayout(marketId)` | none | `TradingDashboard.handleClaim()` |

**`openMarket` strike data:**  
`price = Math.round(currentPrice × 10^8)` (Pyth 8-decimal representation)  
`timestamp = Math.floor(Date.now() / 1000)`

---

## 7. State Management

All state lives in React component state (no external store like Zustand or Redux).

### `TradingDashboard` state

| State variable | Type | Purpose |
|----------------|------|---------|
| `showAccount` | `boolean` | Controls Account Modal visibility |
| `selectedMarket` | `MarketRecord \| null` | Currently selected market — passed to TradePanel to trigger Join mode |
| `claimingMarketId` | `string \| null` | Tracks which market claim is in-flight (disables its button) |
| `currentBtcPrice` | `number \| null` | Live BTC price lifted from PriceChart via callback |
| `pendingTrades` | `TradeExecutionRecord[]` | Recent trade submissions (max 8 kept; shown in banner + chart markers) |
| `outcomeModal` | `{ outcome, position } \| null` | Controls Outcome Modal |
| `seenOutcomes` | `useRef<Set<string>>` | Prevents duplicate outcome modal displays per session |

### `TradePanel` state

| State variable | Type | Purpose |
|----------------|------|---------|
| `stake` | `string` | STT amount input (controlled) |
| `previewDirection` | `'UP' \| 'DOWN'` | Drives signal/POM preview queries |
| `durationSeconds` | `number` | Chosen trade duration (30/60/300/600) |
| `isPending` | `boolean` | True while awaiting wallet signature |
| `lastRecord` | `TradeExecutionRecord \| null` | Inline tx status display |
| `error` | `string \| null` | Inline error message |

### Derived / computed values

- `tradeMarkers` — `useMemo` combining `pendingTrades` + `positions` entries that have an `entry_price`. Used for chart markers.
- `livePnL` — `useMemo` from `positionSummary.resolved_pnl`.
- `projectedProfit` — `useMemo` from stake × pomBps in `TradePanel`.
- `currentPomBps` — `useMemo` merging pom data from `usePom`, `useSignal`, and `activeMarket` with fallback 1000 bps (10%).

---

## 8. Wallet & Auth Flow

```
User clicks "Connect Wallet"
  → connect() in BitdrumWalletProvider
    → connectBitdrumWallet() in utils/bitdrum.ts
      → assertWalletSupport()           (throws if no window.ethereum)
      → createWalletClient(custom(window.ethereum))
      → ensureSomniaChain()             (switchChain or addEthereumChain)
      → walletClient.requestAddresses() (triggers MetaMask/wallet popup)
      → returns BitdrumWallet { address, walletClient, publicClient, label, disconnect(), openProfile() }
  → setWallet(nextWallet)
  → authenticated = true, address = wallet.address, username = wallet.label
```

The wallet context (`BitdrumWalletContext`) exposes:
- `wallet` — full `BitdrumWallet` object (null when disconnected)
- `address` — `0x${string} | null`
- `username` — wallet label string (always "Injected EVM Wallet" currently)
- `authenticated` — boolean
- `connecting` — boolean (true during the async handshake)
- `error` — last connection error string

There is no session persistence. Refreshing the page disconnects the wallet — the user must reconnect.

---

## 9. Error Handling

| Location | What is caught | How it surfaces |
|----------|---------------|----------------|
| `BitdrumWalletProvider.connect()` | Any thrown error from `connectBitdrumWallet` | Sets `error` in context, displayed as a red banner below the nav |
| `TradePanel.handleTrade()` | Insufficient balance, missing price, wallet errors, contract reverts | Sets `error` state, shown as a rose inline box. Also sets `lastRecord.status = 'failed'` after `.wait()` rejects |
| `TradePanel.handleConnect()` | Wallet connection error | Sets `error` state (same rose box) |
| `TradingDashboard.handleClaim()` | Unhandled (no try/catch around claim flow) | Silent failure |
| `useWebSocket` | `socket.onerror` | Sets data to null — components fall back to REST query data silently |
| `useMarketDetail` | Contract read failure | Catches and falls back to `GET /api/markets/:id` |
| React Query | Network errors on any REST call | Data stays as previous value or empty default; no error UI is shown to the user |
| `PriceChart` | Pyth history fetch failure | `console.error` only — chart stays empty |
| `PriceChart` | Hermes streaming error | `console.error`, sets `isLive = false` — "STREAMING" badge disappears |

---

## 10. Known Gaps & Incomplete Areas

| Area | Issue |
|------|-------|
| No routing | All navigation tabs are cosmetic. Leaderboard tab does nothing. |
| No reconnect logic in WebSocket | `useWebSocket` closes permanently on error. Long-running sessions will lose live updates silently. |
| `src/utils/pyth.ts` | File exists but is not imported anywhere — appears to be dead code. |
| `readMarketsOnchain` / `readSttBalance` | Defined in `contracts.ts` but never called from any hook or component. |
| Mobile hamburger menu | Button renders but has no handler — menu does not open. |
| Bell notification button | Renders with a static orange dot — no notifications implemented. |
| Twitter / Discord / Docs links in footer | No `href` — purely decorative. |
| `claimMarket` error handling | `handleClaim()` in TradingDashboard has no try/catch — a failed claim is a silent no-op. |
| Feed `refetchInterval` | `useFeed` and `useLeaderboard` are still at 5 minutes (300,000ms) — they rely on WebSocket for live updates but no reconnect is in place. |
| No loading skeleton / shimmer | Components switch between a plain text placeholder and real data — no skeleton UI. |
| `username` always "Injected EVM Wallet" | `connectBitdrumWallet` hardcodes `label: 'Injected EVM Wallet'` — ENS or on-chain name resolution is not attempted. |
| Session persistence | Wallet state is entirely in-memory. Page refresh forces reconnection. |
