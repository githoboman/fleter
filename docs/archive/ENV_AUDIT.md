# Environment Variables Audit - April 6, 2026

## Summary

- ✅ **Indexer** — Correct format
- ⚠️ **Gateway** — Missing SOMNIA_RPC_URL, placeholders for keeper wallet
- ⚠️ **Keeper** — Correct format but has placeholder KEEPER_PRIVATE_KEY
- ❌ **AI Agent** — Using old Starknet config, needs cleanup
- ✅ **Frontend** — Correct format

---

## 🔴 Issues Found & Fixes Required

### 1. **backend/ai-agent/.env** — NEEDS COMPLETE REWRITE ❌

**Current (WRONG - still has Starknet config):**

```env
OPENAI_API_KEY=<insert-your-openai-api-key-here>
STARKNET_RPC_URL=https://starknet-sepolia.g.alchemy.com/v2/EXU6tBQoqumAZD4zPXjD-SWOurlSWxR_
MARKET_CONTRACT_ADDRESS=0xe34d84cf5b661f0206d369d9d919b13a13b08ff0eb54e1e3056dd592db4303
```

**Should be:**

```env
OPENAI_API_KEY=REDACTED_SECRET
GATEWAY_URL=http://localhost:3001/api
```

---

### 2. **backend/gateway/.env** — MISSING SOMNIA_RPC_URL ⚠️

**Issue:** Code uses `SOMNIA_RPC_URL` in `streams.ts` but it's not in `.env`

**Add this line:**

```env
SOMNIA_RPC_URL=https://dream-rpc.somnia.network
```

**Full corrected version:**

```env
PORT=3001
POSTGRES_CONNECTION_STRING=postgresql://0t41k1@localhost:5432/bitdrum
SOMNIA_RPC_URL=https://dream-rpc.somnia.network
SOMNIA_CHAIN_ID=50312
PREDICTION_MARKET_ADDRESS=0x90C70e356540C8b53Bb5cd0BA35B8f2779c9a10c
AI_AGENT_URL=http://localhost:8000
PRIVY_APP_ID=cmn0pfvsw01in0cl20m2bupqo
PRIVY_APP_SECRET=privy_app_secret_4FuDL43c6v1L8MK3x4VBojqjje14Gg9ZjJXfnR5p5F47J7V5JfRuM5c8yMRyLmv7R88vDp8gh2r9kJvwzLxpxhWf
SOMNIA_REACTIVITY_ENABLED=true
SOMNIA_REACTIVITY_WS_URL=wss://api.infra.testnet.somnia.network/ws
SOMNIA_REACTIVITY_HTTP_URL=https://dream-rpc.somnia.network
SOMNIA_STREAMS_ENABLED=true
STREAMS_PUBLISHER_PRIVATE_KEY=<keeper wallet private key>
STREAMS_PUBLISHER_ADDRESS=<keeper wallet address>
```

---

### 3. **backend/keeper/.env** — PLACEHOLDER NEEDS ACTUAL VALUE ⚠️

**Issue:** `KEEPER_PRIVATE_KEY` still shows placeholder text

**Current:**

```env
KEEPER_PRIVATE_KEY=<keeper wallet private key>
```

**Should be:**

```env
KEEPER_PRIVATE_KEY=0x... (your actual keeper wallet private key)
```

---

### 4. **frontend/.env.local** — ✅ CORRECT

No changes needed. All vars properly formatted with `NEXT_PUBLIC_` prefix.

---

## Environment Variables Mapping (What Code Expects)

### Indexer (`backend/indexer/src/index.ts`)

| Env Var                    | Format             | Status |
| -------------------------- | ------------------ | ------ |
| POSTGRES_CONNECTION_STRING | string             | ✅     |
| SOMNIA_RPC_URL             | URL                | ✅     |
| SOMNIA_RPC_FALLBACK_URL    | URL                | ✅     |
| SOMNIA_CHAIN_ID            | number (50312)     | ✅     |
| PREDICTION_MARKET_ADDRESS  | hex address        | ✅     |
| START_BLOCK                | number (350054041) | ✅     |
| POLL_INTERVAL_MS           | number (3000)      | ✅     |
| BLOCK_BATCH_SIZE           | number (500)       | ✅     |

### Gateway (`backend/gateway/src/`)

| Env Var                       | Used By                   | Format        | Status                           |
| ----------------------------- | ------------------------- | ------------- | -------------------------------- |
| PORT                          | index.ts                  | number (3001) | ✅                               |
| WS_REFRESH_MS                 | index.ts                  | number        | ✅ (optional, defaults to 60000) |
| WS_USE_POLLING_FALLBACK       | index.ts                  | boolean       | ✅ (optional, defaults to true)  |
| POSTGRES_CONNECTION_STRING    | index.ts                  | string        | ✅                               |
| PREDICTION_MARKET_ADDRESS     | reactivity.ts             | hex address   | ✅                               |
| SOMNIA_CHAIN_ID               | reactivity.ts, streams.ts | number        | ✅                               |
| SOMNIA_REACTIVITY_ENABLED     | reactivity.ts             | boolean       | ✅                               |
| SOMNIA_REACTIVITY_WS_URL      | reactivity.ts             | URL           | ✅                               |
| SOMNIA_REACTIVITY_HTTP_URL    | reactivity.ts             | URL           | ✅                               |
| SOMNIA_RPC_URL                | streams.ts                | URL           | ❌ **MISSING**                   |
| SOMNIA_STREAMS_ENABLED        | streams.ts                | boolean       | ✅                               |
| STREAMS_PUBLISHER_PRIVATE_KEY | streams.ts                | hex string    | ⚠️ placeholder                   |
| STREAMS_PUBLISHER_ADDRESS     | streams.ts                | hex address   | ⚠️ placeholder                   |
| AI_AGENT_URL                  | (routes)                  | URL           | ✅                               |
| PRIVY_APP_ID                  | (Privy auth)              | string        | ✅                               |
| PRIVY_APP_SECRET              | (Privy auth)              | string        | ✅                               |

### Keeper (`backend/keeper/src/`)

| Env Var                   | Used By                  | Format                | Status         |
| ------------------------- | ------------------------ | --------------------- | -------------- |
| SOMNIA_RPC_URL            | oracle.ts, settlement.ts | URL                   | ✅             |
| SOMNIA_RPC_FALLBACK_URL   | oracle.ts                | URL                   | ✅             |
| SOMNIA_CHAIN_ID           | oracle.ts, settlement.ts | number                | ✅             |
| PREDICTION_MARKET_ADDRESS | settlement.ts            | hex address           | ✅             |
| SETTLEMENT_ENGINE_ADDRESS | settlement.ts            | hex address           | ✅             |
| KEEPER_PRIVATE_KEY        | settlement.ts            | hex string            | ⚠️ placeholder |
| KEEPER_POM_BPS            | settlement.ts            | number (1000 = 10%)   | ✅             |
| POLLING_INTERVAL          | index.ts                 | number (3000)         | ✅             |
| ORACLE_MAX_AGE_SECONDS    | settlement.ts, oracle.ts | number (150)          | ✅             |
| ORACLE_STATIC_PRICE       | oracle.ts                | hex string (optional) | ✅             |

### AI Agent (`backend/ai-agent/`)

| Env Var        | Used By  | Format | Status         |
| -------------- | -------- | ------ | -------------- |
| OPENAI_API_KEY | agent.py | string | ✅             |
| GATEWAY_URL    | main.py  | URL    | ❌ **MISSING** |

### Frontend (`frontend/.env.local`)

| Env Var                            | Used In                             | Format         | Status |
| ---------------------------------- | ----------------------------------- | -------------- | ------ |
| NEXT_PUBLIC_API_URL                | utils/somnia.ts                     | URL            | ✅     |
| NEXT_PUBLIC_WS_URL                 | utils/somnia.ts                     | WS URL         | ✅     |
| NEXT_PUBLIC_CHAIN_ID               | utils/somnia.ts                     | number (50312) | ✅     |
| NEXT_PUBLIC_PREDICTION_MARKET_ADDR | utils/somnia.ts, utils/contracts.ts | hex address    | ✅     |
| NEXT_PUBLIC_PRIVY_APP_ID           | (Privy auth)                        | string         | ✅     |

---

## ✅ Action Items (In Order)

1. **AI Agent** — Replace old Starknet config with new Somnia config
2. **Gateway** — Add missing `SOMNIA_RPC_URL` var
3. **Keeper** — Provide actual `KEEPER_PRIVATE_KEY` (generate keeper wallet)
4. **Gateway** — Provide actual `STREAMS_PUBLISHER_PRIVATE_KEY` and `STREAMS_PUBLISHER_ADDRESS` (same keeper wallet)
5. **Frontend** — No changes needed ✅

---

## Reference: Env Format Rules

- **Database strings**: `postgresql://<user>@<host>:<port>/<db>`
- **RPC URLs**: Full HTTP/HTTPS URLs (e.g., `https://dream-rpc.somnia.network`)
- **WS URLs**: Full WebSocket URLs (e.g., `wss://api.infra.testnet.somnia.network/ws`)
- **Hex addresses**: 42 characters starting with `0x` (e.g., `0x90C70e356540C8b53Bb5cd0BA35B8f2779c9a10c`)
- **Hex keys**: 66 characters starting with `0x` (e.g., `0x...64 more hex chars`)
- **Numbers**: No quotes (e.g., `3001`, `50312`, `350054041`)
- **Booleans**: `true` or `false` (lowercase, no quotes)
- **Placeholders**: Still use `<description>` format (will fail at runtime if not filled)
