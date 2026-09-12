# BitDrum Somnia Implementation — Quick Start & Status

## 🚀 Quick Start

### Prerequisites Checklist

**All Team Members**:
- [ ] Git SSH key configured
- [ ] Node.js 20+ installed (`node -v`)
- [ ] Foundry installed (`forge --version`)
- [ ] Python 3.11+ installed (`python3 --version`)
- [ ] PostgreSQL 16+ running locally (`psql --version`)
- [ ] Redis running locally (`redis-cli ping`)

**Contract Developers**:
- [ ] Foundry installed
- [ ] VS Code with Solidity extension
- [ ] Explorer access to Somnia Shannon: https://shannon-explorer.somnia.network

**Backend Developers**:
- [ ] Node.js + Python setup
- [ ] Database URLs (PostgreSQL, Redis)
- [ ] RPC endpoint access (https://dream-rpc.somnia.network)

**Frontend Developers**:
- [ ] Node.js 20+
- [ ] Next.js knowledge
- [ ] Wagmi/Privy familiarity

### Getting Started (Next 30 Minutes)

```bash
# 1. Clone repo
git clone <repo-url> && cd bitdrum

# 2. Create feature branch for your phase
git checkout -b phase-1-contracts  # or phase-2-backend, phase-3-frontend, etc.

# 3. Read the full implementation plan
cat IMPLEMENTATION_PLAN.md | less

# 4. Start with your assigned phase (see Status Tracker below)
# Each phase has numbered steps — follow them sequentially
```

---

## 📊 Status Tracker

### Phase 1: Smart Contracts
**Assigned To**: [Contract Developer(s)]  
**Status**: ⏳ Not Started  
**Target Completion**: Week 2  
**Blockers**: None

**Checklist**:
- [ ] Foundry project initialized
- [ ] PredictionMarket.sol implemented
- [ ] SettlementEngine.sol implemented
- [ ] LiquidityVault.sol implemented
- [ ] Treasury.sol implemented
- [ ] LeaderboardRegistry.sol implemented
- [ ] SubscriptionsContract.sol implemented
- [ ] Oracle adapters (DIA + Protofire) implemented
- [ ] >90% test coverage achieved
- [ ] Contracts deployed to Shannon Testnet
- [ ] Sanity check transaction verified
- [ ] Ready for Phase 2 ✅

**Branch**: `phase-1-contracts`  
**Expected Commits**: 12-15

**Setup Commands**:
```bash
cd contracts
forge init . --force
forge install OpenZeppelin/openzeppelin-contracts --no-commit
```

---

### Phase 2: Backend Infrastructure
**Assigned To**: [Backend Developer(s)]  
**Status**: ⏳ Waiting for Phase 1  
**Target Completion**: Week 3.5  
**Blockers**: Phase 1 contracts on Shanghai testnet

**Checklist**:
- [ ] Keeper Bot (ethers.js settlement automation)
- [ ] Social Indexer (event listener + PostgreSQL)
- [ ] AI Agent (FastAPI signal inference)
- [ ] API Gateway (REST + WebSocket)
- [ ] Subscription Distributor (monthly payouts)
- [ ] All services tested locally
- [ ] E2E integration test passing
- [ ] Ready for Phase 3 ✅

**Branch**: `phase-2-backend`  
**Expected Commits**: 8-12

**Setup Commands**:
```bash
cd backend/keeper && npm init -y && npm install ethers@6 dotenv
cd ../indexer && npm init -y && npm install ethers@6 pg redis dotenv
cd ../ai-agent && python3 -m venv .venv && pip install fastapi uvicorn
cd ../gateway && npm init -y && npm install express ethers@6
cd ../subscription-distributor && npm init -y && npm install ethers@6 pg
```

---

### Phase 3: Frontend Development
**Assigned To**: [Frontend Developer(s)]  
**Status**: ⏳ Waiting for Phase 2  
**Target Completion**: Week 4  
**Blockers**: Phase 2 backend services running

**Checklist**:
- [ ] Next.js 14 project initialized
- [ ] Wagmi + Privy integration
- [ ] TradingDashboard component
- [ ] TradePanel component
- [ ] PriceChart component (TradingView)
- [ ] LeaderboardPage component
- [ ] TraderProfile component
- [ ] SignalPanel component (tier-gated)
- [ ] WebSocket real-time updates
- [ ] Manual testing on testnet passing
- [ ] Ready for Phase 4 ✅

**Branch**: `phase-3-frontend`  
**Expected Commits**: 15-20

**Setup Commands**:
```bash
cd frontend
npx create-next-app@latest . --typescript --tailwind --app-router
npm install ethers@6 wagmi viem @wagmi/core @rainbow-me/rainbowkit @privy-io/react-auth
```

---

### Phase 4: Integration & Testing
**Assigned To**: [QA Lead + All Developers]  
**Status**: ⏳ Waiting for Phase 3  
**Target Completion**: Week 5  
**Blockers**: Phase 3 frontend complete

**Checklist**:
- [ ] Full-stack running locally (all 5 services + frontend)
- [ ] E2E workflow test: open → join → settle → claim
- [ ] 10 smoke tests passing
- [ ] Performance benchmarks: keeper <5s/market
- [ ] Performance benchmarks: API <200ms p99
- [ ] Security checklist 100% complete
- [ ] No blocking issues found
- [ ] Ready for Phase 5 ✅

**Branch**: `phase-4-integration`  
**Expected Commits**: 6-8

---

### Phase 5: Security & Launch
**Assigned To**: [Security Lead + DevOps]  
**Status**: ⏳ Waiting for Phase 4  
**Target Completion**: Week 6+  
**Blockers**: Phase 4 integration complete

**Checklist**:
- [ ] Smart contract audit initiated
- [ ] Audit findings addressed
- [ ] Backend security review completed
- [ ] Contracts deployed to Somnia Mainnet
- [ ] All backend services deployed to production
- [ ] Frontend deployed to Vercel (mainnet)
- [ ] Production monitoring active
- [ ] Smoke tests passing on production
- [ ] Ready for user launch ✅

**Branch**: `phase-5-launch`  
**Expected Commits**: 4-6

---

## 🔄 Daily Workflow

### Morning Standup Questions
1. What phase are you assigned to? ← Check **Status Tracker** above
2. What step are you on? ← Reference **IMPLEMENTATION_PLAN.md**
3. What's your expected output today?
4. Any blockers?

### Commit After Each Major Milestone

**Example**:
```bash
# After implementing PredictionMarket.sol
git add src/PredictionMarket.sol
git commit -m "feat(contracts): implement PredictionMarket.sol core logic

- Market open/join/lock state machine
- Strike price recording via oracle
- Pool tracking for UP/DOWN sides
- <350 LOC, ready for tests"

# After tests pass
git add test/PredictionMarket.t.sol
git commit -m "test: add PredictionMarket unit tests (95% coverage)"

# After deployment
git commit -m "deploy: testnet contracts to somnia shannon (initial deploy)"
```

### Code Review Checklist

Before merging to main:
- [ ] All tests passing
- [ ] No console errors/warnings
- [ ] Environment variables documented
- [ ] Commit message follows format
- [ ] Code follows Solidity/TypeScript style
- [ ] At least 1 reviewer approval

---

## 📁 Project Structure Reference

```
bitdrum/
├── IMPLEMENTATION_PLAN.md          ← You are here
├── deployed_addresses.md           ← Record contract addresses per phase
├── README.md                        ← Project overview
│
├── contracts/                       ← Phase 1
│   ├── foundry.toml                ← Forge config
│   ├── src/                         ← Solidity contracts
│   │   ├── PredictionMarket.sol
│   │   ├── SettlementEngine.sol
│   │   └── ...
│   ├── test/                        ← Forge tests
│   │   ├── PredictionMarket.t.sol
│   │   └── ...
│   └── script/                      ← Deploy scripts
│       └── Deploy.s.sol
│
├── backend/                         ← Phase 2
│   ├── keeper/                      ← Settlement bot
│   │   ├── src/index.ts
│   │   ├── .env.example
│   │   └── package.json
│   ├── indexer/                     ← Event listener
│   │   ├── src/index.ts
│   │   ├── db/schema.sql
│   │   └── .env.example
│   ├── ai-agent/                    ← Signal inference
│   │   ├── main.py
│   │   ├── requirements.txt
│   │   └── .env.example
│   ├── gateway/                     ← REST + WebSocket
│   │   ├── src/index.ts
│   │   └── .env.example
│   └── subscription-distributor/    ← Payouts
│       ├── src/distributor.ts
│       └── .env.example
│
├── frontend/                        ← Phase 3
│   ├── app/
│   │   ├── page.tsx                 ← Home / market feed
│   │   └── layout.tsx
│   ├── components/
│   │   ├── TradingDashboard.tsx
│   │   ├── TradePanel.tsx
│   │   ├── Leaderboard.tsx
│   │   └── ...
│   ├── lib/
│   │   ├── wagmi-config.ts
│   │   ├── privy-config.ts
│   │   └── ...
│   ├── .env.local.example
│   └── package.json
│
└── tests/                           ← Phase 4
    └── smoke.test.ts                ← E2E smoke tests
```

---

## 🆘 Troubleshooting

### "Foundry not found"
```bash
curl -L https://foundry.paradigm.xyz | bash
foundryup
```

### "PostgreSQL connection refused"
```bash
# Start Docker container
docker run --name postgres -e POSTGRES_PASSWORD=password -d postgres:16
docker exec -it postgres createdb bitdrum
```

### "Redis connection refused"
```bash
# Start Redis
redis-server
# Or Docker
docker run --name redis -d redis:latest
```

### "Contract deployment fails"
1. Check RPC URL: `curl -X POST https://dream-rpc.somnia.network`
2. Check gas: Ensure account has SOMI/STT for testnet
3. Verify contract address: Check `.env` matches deployment output

### "WebSocket connection fails"
1. Ensure API Gateway running: `npm run dev` from `backend/gateway`
2. Check port 3001 open: `lsof -i :3001`
3. Verify `NEXT_PUBLIC_WS_URL` in frontend `.env.local`

---

## 📞 Communication

- **Daily Standup**: [Time TBD]
- **Phase Leads**:
  - Phase 1 (Contracts): [Name]
  - Phase 2 (Backend): [Name]
  - Phase 3 (Frontend): [Name]
- **Point of Contact for Blockers**: [Lead Name]

---

## 🎯 Success Metrics at End of Each Phase

**Phase 1**: Contracts deployed, >90% test coverage, settlement working  
**Phase 2**: All 5 services running, keeper settling markets, indexer synced  
**Phase 3**: Frontend connects wallet, shows markets, can trade  
**Phase 4**: E2E flow works, 10 smoke tests pass, no critical bugs  
**Phase 5**: Live on mainnet, users trading, zero incidents first 24h  

---

## 📚 Quick Links

| Resource | URL |
|----------|-----|
| Somnia RPC (Testnet) | https://dream-rpc.somnia.network |
| Somnia RPC (Mainnet) | https://api.infra.mainnet.somnia.network |
| Shannon Explorer | https://shannon-explorer.somnia.network |
| Somnia Explorer | https://explorer.somnia.network |
| Foundry Docs | https://book.getfoundry.sh |
| Ethers.js v6 Docs | https://docs.ethers.org/v6 |
| Wagmi Docs | https://wagmi.sh |
| Privy Docs | https://docs.privy.io |
| Next.js Docs | https://nextjs.org/docs |

---

**Document Version**: 1.0  
**Last Updated**: 2026-04-03  
**Status**: Ready for Team Onboarding
