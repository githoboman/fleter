# Social Indexer Implementation Details

## Objectives

Build a fast, reliable source of truth for all social and historical data that is too expensive to compute on-chain.

## Implementation Steps

### 1. Event Listener
- Set up a robust Starknet event listener using `starknet.js`.
- Index events: `MarketOpened`, `StakePlaced`, `MarketSettled`, `SubscriptionPaid`.

### 2. Database Schema
- `traders`: Wallet, Tier, Win Rate, Net P&L.
- `markets`: ID, Outcome, Pool Size, POM.
- `social_follows`: Follower, Following.

### 3. Scoring Engine
- Compute `Composite Score`: (40% Win Rate + 40% Net P&L + 20% Consistency).
- Recalculate rankings every 10 minutes.

## Required Criteria

- [ ] Database updates must be idempotent (re-indexing a block shouldn't double stats).
- [ ] API response time for leaderboard must be < 150ms.
- [ ] Support for WebSocket streams of new market activity.
- [ ] Indexing lag from block confirmation must be < 5 seconds.
