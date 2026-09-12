# BitDrum API Gateway

The API Gateway is the primary entry point for the frontend, providing a unified REST and WebSocket interface for all protocol data and services.

## Role in the System
- **Unified API**: Aggregates data from the Social Indexer, AI Agent, and Starknet.
- **Subscription Gating**: Verifies a user's subscription tier on-chain before serving premium signal content.
- **Proactive Alerts**: Distributes push notifications for followed traders and high-confidence signals.

## Stack
- Node.js / Express
- PostgreSQL
- Starknet.js (Read-only state checks)
- WebSocket push loop

## Environment

Create `backend/gateway/.env`:

```env
PORT=3001
AI_AGENT_URL=http://localhost:8000
POSTGRES_CONNECTION_STRING=postgresql://0t41k1@localhost:5432/bitdrum
STARKNET_RPC_URL=https://starknet-sepolia.public.blastapi.io
SUBSCRIPTION_CONTRACT_ADDRESS=0x...
WS_REFRESH_MS=3000
```

Notes:

- `POSTGRES_CONNECTION_STRING` must match the indexer's database.
- `SUBSCRIPTION_CONTRACT_ADDRESS` is required for gated signal endpoints.
- The gateway now serves only the REST and WebSocket APIs consumed by the Cartridge-based frontend.

## Run

```bash
npm install
npm run build
npm start
```

Health check:

- [http://localhost:3001/health](http://localhost:3001/health)

## Frontend Contract

The frontend expects:

- REST APIs under `/api`
- WebSocket feed under `/ws`

Default frontend target:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api
NEXT_PUBLIC_WS_URL=ws://localhost:3001/ws
```
