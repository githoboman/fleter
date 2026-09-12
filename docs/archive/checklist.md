# BitDrum Testnet Checklist

## 📊 Project Status Overview

**Last Updated**: 2026-04-06

### Implementation Completion

| Layer                         | Status     | Details                                              |
| ----------------------------- | ---------- | ---------------------------------------------------- |
| **Smart Contracts**           | ✅ 100%    | 6 contracts, 46/46 tests passing                     |
| **Database**                  | ✅ 100%    | Drizzle ORM schema + 2 migrations ready              |
| **Backend Services**          | ✅ 100%    | Indexer, Gateway, Keeper, AI Agent all implemented   |
| **Frontend Data Layer**       | ✅ 100%    | All 7 hooks (WebSocket, Feed, Leaderboard, etc.)     |
| **Environment Configuration** | 📝 Pending | `.env` files need to be created after Phase 1 deploy |
| **Integration Testing**       | ⏳ Ready   | All pieces built; awaiting Phase 1 deployment        |

### Next Immediate Steps

1. ✅ **Phase 1**: Contracts deployed to Somnia Shannon (block 350382874)
2. ✅ **Phase 3**: `.env` files updated with deployment addresses
3. **Phase 3 TODO**: Set up keeper wallet (private key) → then ready for Phase 5
4. **Phase 5**: Start all 5 backend services
5. **Phase 6**: Run smoke tests end-to-end

### Critical Path Blockers

- ✅ Contract deployment — **DONE**
- ✅ PostgreSQL instance with `bitdrum` database — **Created** (verify with `createdb bitdrum`)
- ⏳ Keeper wallet private key — **TODO**: Generate keeper wallet, fund with STT, add KEEPER_PRIVATE_KEY to .env files

---

## 📋 Detailed Phases

- [ ] Fund a deployer wallet with STT on Somnia Shannon testnet (faucet at `faucet.somnia.network`)
- [ ] Have an OpenAI API key ready
- [ ] Have a Privy app configured for Somnia (existing app ID is fine for testnet)
- [ ] PostgreSQL instance running (`createdb bitdrum` if local)
- [ ] Node.js v18+ installed
- [ ] Python 3.9+ installed
- [ ] Foundry (forge) installed

---

## Phase 1 — Deploy Contracts ✅ COMPLETE

**Status**: All contracts implemented & tested. Ready for testnet deployment.

### Contracts Implemented

- [x] LiquidityVault.sol — counterparty funding + payout logic
- [x] Treasury.sol — 40/35/25 BPS fee distribution
- [x] PredictionMarket.sol — market lifecycle (open/join/lock/settle/claim)
- [x] SettlementEngine.sol — oracle settlement + leaderboard recording
- [x] LeaderboardRegistry.sol — trader stats tracking
- [x] SubscriptionsContract.sol — tier-gated signal access
- [x] Types.sol — shared data structures
- [x] All interfaces + mocks

### Contract Tests

- [x] 46/46 tests passing (100%)
    - Market lifecycle tests ✓
    - Authorization tests ✓
    - Oracle validation tests ✓
    - Settlement logic tests ✓
    - Leaderboard accumulation tests ✓
    - Treasury distribution tests ✓

### Deployment Script

- [x] Deploy.s.sol ready with automatic wiring + 10 STT vault seed

### Next: Deploy to Somnia Shannon

```bash
cd contracts
export PRIVATE_KEY=0x<deployer_private_key>
forge script script/Deploy.s.sol \
  --rpc-url https://dream-rpc.somnia.network \
  --broadcast --verify
# Note: The script automatically sends 10 STT to seed the vault (no --value flag needed)
```

- [x] Run the deploy script — it will print all 6 addresses
- [x] Record the addresses:
    ```
    PREDICTION_MARKET_ADDRESS=0x73c1c308Ac8166a2fc6685A5BbC79cda128864BA
    SETTLEMENT_ENGINE_ADDRESS=0xC74711A55E19c4a2F5e675830FCF6F9485Ac6AD2
    SUBSCRIPTIONS_CONTRACT_ADDRESS=0xf2Ddd1c079cb8dCdaD8F399Aa65364235eef1c5e
    LEADERBOARD_REGISTRY_ADDRESS=0x60600DC92Dd71B45f2C1b375278310EAc1C8469e
    LIQUIDITY_VAULT_ADDRESS=0x3ddc3eA375559D56E5Dc5f0dF392929d5a49243f
    TREASURY_ADDRESS=0x3c18DB14705C27cB87a52B2F1a64032D11FE1061
    DEPLOYMENT_BLOCK=352343263
```
- [x] Contracts re-deployed and re-wired on Somnia Shannon (Verified 2026-04-09)
- [x] Confirm the vault is seeded: Verified 1 STT balance in LiquidityVault (2026-04-09)

---

## Phase 2 — Database ✅ COMPLETE

**Status**: Schema migrations ready. Deployment block number: **350054041**

```bash
cd backend/indexer
npm install
npm run db:migrate   # runs 0000_fresh_wallow.sql + 0001_add_duration_seconds.sql
```

### Migrations Implemented

- [x] 0000_fresh_wallow.sql — markets + stakes + participants tables
- [x] 0001_add_duration_seconds.sql — duration_seconds column (for market lifecycle tracking)

### Verification

- [ ] Migration runs without error
- [ ] Verify `duration_seconds` column exists in `markets` table
    ```sql
    \d markets  -- in psql
    ```

---

## Phase 3 — Environment Files ✅ COMPLETE

**Status**: All `.env` files created with Somnia deployment addresses. Just need keeper wallet setup.

### Created Files Summary

✅ **All `.env` files created and pre-filled with Somnia deployment addresses:**

| File                    | Status            | Contract Addresses                        | Notes                             |
| ----------------------- | ----------------- | ----------------------------------------- | --------------------------------- |
| `backend/indexer/.env`  | ✅ Created        | PREDICTION_MARKET_ADDRESS filled          | START_BLOCK=350054041             |
| `backend/gateway/.env`  | ✅ Created        | PREDICTION_MARKET_ADDRESS filled          | Privy credentials already set     |
| `backend/keeper/.env`   | ✅ Created        | Both addresses filled                     | KEEPER_PRIVATE_KEY = TODO         |
| `backend/ai-agent/.env` | ✅ Already exists | —                                         | OPENAI_API_KEY needs verification |
| `frontend/.env.local`   | ✅ Created        | NEXT_PUBLIC_PREDICTION_MARKET_ADDR filled | All vars populated                |

### Remaining TODO (Before Phase 5):

- [ ] **Generate keeper wallet** (different from deployer):
    - Create a new wallet with some STT balance
    - [ ] Set `KEEPER_PRIVATE_KEY` in:
        - `backend/keeper/.env`
        - `backend/gateway/.env` (as `STREAMS_PUBLISHER_PRIVATE_KEY`)
    - [ ] Set `STREAMS_PUBLISHER_ADDRESS` in `backend/gateway/.env`
- [ ] **Verify AI Agent config**:
    - [ ] Check `backend/ai-agent/.env` has valid `OPENAI_API_KEY`
- [ ] **Verify database connection**:
    - [ ] All `.env` files use `postgresql://0t41k1@localhost:5432/bitdrum` (adjust username if needed)

---

## Phase 4 — Frontend Verification ✅ HOOKS READY

**Status**: All data hooks implemented. Wallet integration (Privy/Wagmi) ready for final testing.

### Hooks Implemented & Verified

- [x] `useWebSocket(url)` — WS frame → parsed JSON
- [x] `usePositions(address)` — WS-primary + REST fallback
- [x] `useFeed(type, address)` — WS-primary + REST fallback
- [x] `useLeaderboard()` — WS-primary + REST fallback
- [x] `useMarketDetail(marketId, address?)` — viem multicall → gateway fallback
- [x] `useSignal(marketId?, direction?, stake?)` — Gateway REST
- [x] `usePom(marketId?, direction?, stake?)` — Gateway REST

### Verification Checklist

- [ ] Run `cd frontend && npm install`
- [ ] Start the frontend (`npm run dev`) and confirm no TypeScript errors in the hooks
- [ ] Open browser devtools → Network tab: confirm no raw `fetch` calls from components (all through hooks)
- [ ] Open devtools → WS tab: verify a WebSocket connection opens for each active channel
    - [ ] `ws://localhost:3001/ws?channel=positions`
    - [ ] `ws://localhost:3001/ws?channel=feed`
    - [ ] `ws://localhost:3001/ws?channel=leaderboard`
- [ ] Stub gateway offline → feed/leaderboard/positions should show last WS data, not blank
- [ ] Connect wallet via Privy → should show user's positions
- [ ] Create a market → positions feed should update in real-time via WS

---

## Phase 5 — Start Services ✅ ALL READY

**Status**: All 5 services implemented with proper startup scripts. Ready for simultaneous startup (follow order below).

### Service Readiness Check

| Service  | Status         | Entry Point                    | Health Check                           |
| -------- | -------------- | ------------------------------ | -------------------------------------- |
| AI Agent | ✅ Implemented | `backend/ai-agent/main.py`     | `GET /health`                          |
| Indexer  | ✅ Implemented | `backend/indexer/src/index.ts` | Logs: `[Indexer] Starting...`          |
| Gateway  | ✅ Implemented | `backend/gateway/src/index.ts` | `GET /health`                          |
| Keeper   | ✅ Implemented | `backend/keeper/src/index.ts`  | Logs: `BitDrum Keeper Service Started` |
| Frontend | ✅ Implemented | `frontend/src/app/page.tsx`    | `npm run dev`                          |

### Startup Sequence (in order, with required env vars from Phase 3)

```bash
# Terminal 1: AI Agent (port 8000)
cd backend/ai-agent
pip install -r requirements.txt
uvicorn main:app --port 8000

# Terminal 2: Indexer (syncs from START_BLOCK)
cd backend/indexer
npm install && npm run build
npm start

# Terminal 3: Gateway (port 3001)
cd backend/gateway
npm install && npm run build
npm start

# Terminal 4: Keeper (auto-locks + settles markets)
cd backend/keeper
npm install && npm run build
npm start

# Terminal 5: Frontend (port 3000)
cd frontend
npm install
npm run dev
```

### Startup Verification Checklist

- [ ] AI Agent: `curl http://localhost:8000/health` returns `{"status": "ok"}`
- [ ] Indexer logs show: `[Indexer] Starting Somnia projector from block <deployment_block>`
- [ ] Gateway logs show: `BitDrum Gateway running on http://localhost:3001`
- [ ] Keeper logs show: `🚀 BitDrum Keeper Service Started` + `Interval: 3000ms`
- [ ] Frontend: Open http://localhost:3000 — no build errors, wallet connect visible
- [ ] Gateway health: `curl http://localhost:3001/health` returns `{"status": "healthy", "service": "BitDrum Gateway"}`

---

## Phase 6 — Smoke Test 🧪 END-TO-END

**After Phase 5 services all start successfully.**

### Market Lifecycle E2E Test

- [ ] Open frontend (http://localhost:3000), connect wallet (MetaMask on Somnia Shannon, chain ID 50312)
- [ ] Open a market — pick UP or DOWN, 30s timeframe, send 1 STT (single transaction, no approval needed)
- [ ] Second wallet joins the same market on the opposite side
- [ ] Wait ~52 seconds total:
    - [ ] After ~10 seconds: Keeper auto-locks market (logs show `[Keeper] Locking market...` + transaction)
    - [ ] After ~30 seconds from open: Keeper auto-settles with DIA BTC/USD price (logs show `[Keeper] Settling market...`)
- [ ] Winning wallet sees "Claim" button, claims payout (principal + POM profit)

### Real-Time Updates

- [ ] Leaderboard updates automatically after settlement (no manual refresh)
- [ ] Positions feed shows both traders ranked
- [ ] WS push updates market state changes (open → locked → claimable)

### AI Signal Test

- [ ] AI signal appears on trade panel before settlement (if available)
- [ ] Signal reflects market sentiment

### Data Integrity

- [ ] Indexer has synced all market events to PostgreSQL
- [ ] Leaderboard shows cumulative stats across multiple markets
- [ ] Treasury can distribute fees: `GET /api/treasury/status`

---

## Known Gaps (not blocking, track for later)

| Gap                                   | Impact                                                         | Priority      | Fix                                                                                    |
| ------------------------------------- | -------------------------------------------------------------- | ------------- | -------------------------------------------------------------------------------------- |
| No `.env.example` files committed     | Onboarding friction — users must copy templates from checklist | Medium        | Create `.env.example` in each backend service + frontend after first successful deploy |
| Keeper `settlement.ts` uses ethers.js | Inconsistency with rest of stack (viem)                        | Low           | Migrate when touching keeper next                                                      |
| No docker-compose                     | Manual startup order required                                  | Low           | Add when moving to hosted infra                                                        |
| No `.env` files yet                   | Can't deploy Phase 1 contracts or start Phase 5 services       | **HIGH**      | ✅ DONE — Created with Somnia addresses                                                |
| Frontend Privy integration            | Wallet connection layer not yet verified                       | Medium        | Test during Phase 6 smoke test                                                         |
| Keeper's POM calculation              | Uses BPS instead of percentage (KEEPER_POM_BPS=1000 = 10%)     | Documentation | Add clarification to keeper `.env` template                                            |

### Post-Testnet (Before Mainnet)

- [ ] Add contract test suite to CI/CD (prevent regressions)
- [ ] Security audit of all contracts
- [ ] Load test gateway + indexer with 100+ concurrent users
- [ ] Create runbook for emergency keeper pause
- [ ] Document keeper fee distribution mechanics
- [ ] Add monitoring alerts for oracle staleness
