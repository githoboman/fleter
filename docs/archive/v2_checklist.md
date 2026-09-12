# BitDrum V2 Live Testnet Checklist

This checklist tracks the final steps required to launch the BitDrum v2 "Investor Demo" version on Somnia Shannon. This version uses the **Vault-Backed Binary Market** model with **Reactivity-only invalidation** and **Onchain Price Adapters**.

---

## 🏗️ Phase 1: Contract Deployment (Workstream A)

The goal is a fresh, clean deployment of the entire V2 stack.

- [x] **Deploy V2 Stack**
  - [x] Run `forge script script/DeployV2.s.sol` (Manual bypass due to Somnia gas pricing).
  - [x] Recording these environment variables for Phase 2:
    - `PRIVATE_KEY`: `0x702d8bed...`
    - `KEEPER_ADDRESS`: `0x29284e93b68C84A40c89873e567B9e14B95247b7`
    - `RESERVE_ADDRESS`: `0x29284e93b68C84A40c89873e567B9e14B95247b7`
    - `VAULT_SEED_STT`: 50 STT
- [x] **Verify Addresses** in `V2_DEPLOYMENT_ADDRESSES.md` (Update the "Live" section):
  - [x] `BitdrumPriceAdapter`
  - [x] `LiquidityVaultV2`
  - [x] `TreasuryV2`
  - [x] `LeaderboardRegistry`
  - [x] `PredictionMarketV2`
  - [x] `SettlementEngineV2`
- [x] **Seeding Success**
  - [x] Confirm `LiquidityVaultV2` has >= 50 STT balance.

---

## 🤖 Phase 2: Keeper & Oracle Setup (Workstream B)

The keeper must now handle price publishing to the onchain adapter.

- [x] **Keeper Configuration**
  - [x] Update `backend/keeper/.env` with V2 addresses.
  - [x] Set `PRICE_ADAPTER_ADDRESS`.
  - [x] Set `KEEPER_PRIVATE_KEY`.
- [x] **Start Price Publisher**
  - [x] Verify `pricePublisher.ts` is posting BTC/USD snapshots.
  - [x] Check logs: Round 1+ posted.
- [x] **Start Market Lifecycle & Settlement**
  - [x] Verify `marketLifecycle.ts` locks markets.
  - [x] Verify `settlement.ts` settles markets using adapter.

---

## 🔌 Phase 3: Backend Services Re-wiring (Workstream C)

The indexer and gateway need a fresh start for V2.

- [x] **Reset Database & Indexer State**
  - [x] `dropdb bitdrum && createdb bitdrum`.
  - [x] Delete `backend/indexer/data/indexer-state.json`.
- [x] **Update Indexer .env**
  - [x] Set `PREDICTION_MARKET_ADDRESS` to V2.
  - [x] Set `START_BLOCK` to `352594919`.
- [x] **Update Gateway .env**
  - [x] Update `PREDICTION_MARKET_ADDRESS` and other V2 addresses.
- [x] **Service Health Check**
  - [x] `curl http://localhost:3001/health` → Status: `healthy`.

---

## 🎨 Phase 4: Frontend Verification (Workstream D)

The UI must reflect the V2 mechanics.

- [x] **Update Frontend .env.local**
  - [x] Set `NEXT_PUBLIC_PREDICTION_MARKET_ADDR` to V2.
- [x] **Trade Panel Verification**
  - [x] Confirm backend API serves V2 pool data correctly.

---

## 🧪 Phase 5: End-to-End Smoke Test

The final verification before the demo.

- [x] **1-Minute Market Lifecycle**
  1. Open market (Manual `cast send`). -> Success (Market 1)
  2. Join market (N/A for solo test).
  3. Wait 20s → Keeper locks market. -> Success (Block 352604620+)
  4. Wait ~40s more → Keeper settles market. -> Success (Outcome: DRAW)
  5. API reflects state -> Success (CLAIMABLE)

---

**Current Progress Status: ✅ Phase 1 Deployment COMPLETE**
Protocol is live and automated on Somnia Shannon.

Last reconciled with `mininmal_v2_action_plan.md` on 2026-04-09.
