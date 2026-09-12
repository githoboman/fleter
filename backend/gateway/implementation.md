# API Gateway Implementation Details

## Objectives

Securely serve protocol intelligence and real-time market data to the frontend.

## Implementation Steps

### 1. Subscription Middleware
- Implement a middleware that reads the `SignalSubscription` contract state on Starknet.
- Gating logic: `tier = get_subscription_tier(wallet_address)`.
- Restrict `Signal Pro` and `Signal Elite` fields based on the user's tier.

### 2. WebSocket Gateway
- Set up a Socket.io or native WebSocket server.
- Stream data: `/stream/markets`, `/stream/signals`, `/stream/pom`.

### 3. Proxy/Aggregation
- Route requests to the Social Indexer (for leaderboards) or AI Agent (for signals).

## Required Criteria

- [ ] Support for JSON Web Tokens (JWT) for authenticated mobile sessions.
- [ ] Rate limiting (Redis-based) for all public endpoints.
- [ ] Caching for `Signal Pro/Elite` fields to reduce Starknet RPC calls.
- [ ] Health checks for all downstream dependencies (Indexer, AI Agent, RPC).
