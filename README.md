<p align="center">
  <img src="frontend/public/logo.png" alt="BitDrum" width="96" />
</p>

<h1 align="center">BitDrum × DreamDEX</h1>

<p align="center"><strong>The signal layer and one-tap front end for DreamDEX Event Contracts on Somnia.</strong><br/>
BitDrum prices every live BTC/ETH Up/Down window itself, shows you where the DreamDEX order book disagrees, and turns a stake into a book-sized order — payout and max loss on screen before you sign.</p>

<p align="center">
  <a href="https://shannon-explorer.somnia.network"><img src="https://img.shields.io/badge/network-Somnia%20Shannon%20(50312)-f5b942?style=flat-square" alt="Somnia Shannon" /></a>
  <a href="https://dreamdex.somnia.network"><img src="https://img.shields.io/badge/venue-DreamDEX%20Event%20Contracts-22d3ee?style=flat-square" alt="DreamDEX" /></a>
  <a href="https://www.npmjs.com/package/@somnia-chain/markets-sdk"><img src="https://img.shields.io/badge/%40somnia--chain%2Fmarkets--sdk-0.30.0-3b82f6?style=flat-square" alt="SDK" /></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-16a34a?style=flat-square" alt="MIT" /></a>
</p>

<p align="center">
  <a href="#"><strong>▶ Live app</strong></a> · <a href="#"><strong>🎬 Demo video (2 min)</strong></a> · <a href="#run-it-locally">Run locally</a>
  <br/><sub>(links filled in at submission)</sub>
</p>

---

## The problem

DreamDEX already runs rolling **1-minute and 5-minute Up/Down markets** on BTC and ETH with a real order book and oracle settlement. What it doesn't tell you is whether the price it's quoting is *fair*. A YES share at 0.73¢ means "the book thinks there's a 73 % chance BTC closes above the open" — but is that right with 2 minutes left and the price 0.04 % above the open? Retail traders can't answer that in the seconds a window lasts, and the raw order-book UI doesn't try.

## What BitDrum does

BitDrum is a purpose-built front end for those markets with one thing the venue doesn't have: **its own opinion of the price.**

| | |
|---|---|
| **BitDrum Edge** | For the live window, BitDrum computes its own P(UP) from how far price has moved from the open, the time left, and realized volatility — then compares it to the book's implied P(UP). A call fires only when the gap clears the spread plus a margin. Every call comes with a plain-English rationale. |
| **One-tap trading** | UP / DOWN quotes your stake against the live DreamDEX book (walking the levels), shows **payout-if-win**, **max loss**, and the worst fill price, then routes a market (IOC) order signed by your own wallet. |
| **Live window view** | Somnia price-index chart with the window's opening price drawn in, a countdown, and the current top-of-book for both sides. Rolls to the next window automatically. |
| **Portfolio** | Positions read straight from DreamDEX, marked to the book, with one-tap **redeem** once a window resolves. |

No backend. No BitDrum contracts. The frontend talks to the DreamDEX indexer, the Somnia price feed, and Somnia Shannon directly through `@somnia-chain/markets-sdk`.

## It runs against live DreamDEX data

Everything below was verified on Somnia Shannon during the build, not mocked:

| Check | Result |
|---|---|
| Live BTC 5m window found and rolled over on expiry | ✅ `reference`-mode market, both BTC and ETH |
| Opening price scale | ✅ oracle raw `7921119` → **$79,211.19** vs live index $79,363 (2 dp confirmed) |
| Order book populated, quote sized off it | ✅ YES 0.731 / NO 0.296, spread 2.7¢ → 5 USDC buys 6.64 shares (+33 %) |
| Edge signal fired unprompted | ✅ *"UP 15 % — model 38.5 % vs market 31.9 %: UP underpriced by 6.6 %"* |
| Positions / claimables for a real trader | ✅ statuses map to LIVE · SETTLING · WIN · LOSS · VOID |
| Injected-wallet writes | ✅ after stripping the SDK's hardcoded gas/fees, which MetaMask rejects |

> The 1-minute series exists but has no market-maker liquidity on testnet today; the UI says so and still prices it. Demo on 5m.

## The model — BitDrum Edge

Over a few minutes, BTC log-returns are close to driftless Brownian motion, so the probability the window closes at or above its open is

```
P(UP) = Φ( ln(S / K) / (σ · √τ) )
```

| Symbol | Source |
|---|---|
| `S` | live Somnia index price |
| `K` | the window's opening price — the oracle answer for `reference` markets, the strike for `fixed` markets |
| `σ` | realized per-minute volatility from the last 60 one-minute index candles |
| `τ` | minutes to expiry |

**Edge** = model P(UP) − market P(UP), where market P(UP) is the YES mid on the DreamDEX book.
A call fires only when `|edge| > spread / 2 + 3 %`, so it never recommends paying through a wide book. Confidence is damped in the first 20 % of a window (the open has barely been tested) and in the last 5 seconds (fill risk).

It ignores drift and fees on purpose. It is a **signal, not a guarantee** — the job is to make a mispriced book legible in the seconds you have. The whole model is 80 lines of pure functions: [`fairValue.ts`](frontend/src/lib/signal/fairValue.ts).

## How a trade flows

```
tap UP / DOWN   quoteBinaryStakeOverBook()  walk the live book → shares, escrow (max loss), protective limit
sign            trader.placeOrder({ pool, side, price: yesPrice, quantity, orderType: MARKET })
                tagged with NEXT_PUBLIC_BITDRUM_BUILDER when set
window closes   Somnia oracle resolves the market
redeem          trader.redeem({ marketId, amount, outcomeIdx })   → 1 USDC per winning share
```

Edge cases the UI handles: stake below the pool's minimum order → **"Stake too small"**; empty side of the book → **"No liquidity"**; trading disabled in the **last 5 s** of a window; orders expire with their market so nothing lingers; the expiring window stays on screen (marked LOCKING) during the series handoff instead of flashing.

## Business model

DreamDEX lets a front end tag orders with a `builder` address and earn a routing fee on them. Set `NEXT_PUBLIC_BITDRUM_BUILDER` and every order BitDrum originates is attributed to it. BitDrum earns on flow it creates — **without running a market, a vault, or a keeper.** The signal is the product; the venue is DreamDEX.

## Why Somnia

- **Sub-second blocks** make 1- and 5-minute binary windows viable at all — a quote, a signed order, and a fill fit inside a window with room to spare.
- **DreamDEX Event Contracts** give a real CLOB with oracle settlement, so BitDrum can be a front end and a signal instead of a liquidity provider.
- The **markets SDK** exposes the same book the venue trades on (`quoteBinaryStakeOverBook`, `getOpenPositionsWithPnL`, `getClaimable`), which is what lets a front end promise "payout and max loss before you sign".

## Run it locally

```bash
cd frontend
npm install
cp .env.example .env.local        # optional: NEXT_PUBLIC_BITDRUM_BUILDER
npm run dev                       # http://localhost:3000/arena
```

Connect an injected EVM wallet on **Somnia Shannon (50312)**. Press **Faucet** in the Command Module to mint TestUSDC, pick **5m**, tap **UP** or **DOWN**. Expect two wallet prompts the first time (collateral approval, then the order).

Deploy: static Next.js, no backend — `vercel --cwd frontend --prod`, or import the repo in Vercel with `frontend` as the root directory.

### Code map

| File | Role |
|---|---|
| [`lib/dreamdex/client.ts`](frontend/src/lib/dreamdex/client.ts) | SDK singleton, `attachWallet()`, injected-wallet fix, testnet config |
| [`lib/dreamdex/markets.ts`](frontend/src/lib/dreamdex/markets.ts) | find the live Up/Down window; snapshot book + open + live price |
| [`lib/dreamdex/trade.ts`](frontend/src/lib/dreamdex/trade.ts) | `quoteStake` / `placeStake` / redeem / faucet / collateral balance |
| [`lib/dreamdex/positions.ts`](frontend/src/lib/dreamdex/positions.ts) | open positions marked to book + claimable winners |
| [`lib/signal/fairValue.ts`](frontend/src/lib/signal/fairValue.ts) | **BitDrum Edge** — pure math, unit-testable |
| [`hooks/useUpDownMarket.ts`](frontend/src/hooks/useUpDownMarket.ts) | 2 s refresh; rolls to the next window on expiry |
| [`components/TradePanel.tsx`](frontend/src/components/TradePanel.tsx) | the Command Module |

## Roadmap

- **Builder-fee revenue live** on mainnet DreamDEX.
- **Edge v2** — drift term from the EMA the price feed already publishes, and a fee-aware hurdle.
- **Auto-pilot** — let Edge place the order when confidence clears a user-set threshold.
- **BitDrum-native venue** — v1 shipped a full Bitcoin direction market on Somnia (six contracts, protocol-owned liquidity vault, keeper, indexer, AI agent). It's deployed on Shannon and documented in [`docs/BITDRUM_V1.md`](docs/BITDRUM_V1.md); it's the path to owning the venue once the signal has proven itself on DreamDEX.

## Built by

**[CrackedStudios.xyz](https://crackedstudios.xyz)** — a Web3 product studio focused on shipping production-grade decentralised applications.

- **Abdulsamad Sadiq** — Founder · Product Engineering & Marketing · 6× Hackathon Winner
- **Samuel Onanike** — Co-Founder · Smart Contract Security & Backend Infrastructure · [Noah Protocol](https://noahprotocol.xyz)

## License

MIT — see [`LICENSE`](./LICENSE).
