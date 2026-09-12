# Technical Glossary — BitDrum Somnia Implementation

## 🔗 Blockchain & Network

| Term | Definition | Example |
|------|-----------|---------|
| **Somnia** | EVM-compatible Layer 1 with 1M+ TPS and sub-second finality | Native support for DeFi |
| **Chain ID** | Unique network identifier on EVM networks | Testnet: `50312`, Mainnet: `5031` |
| **Shannon Testnet** | Somnia's public testnet for development | https://dream-rpc.somnia.network |
| **RPC** | JSON-RPC endpoint to read/write blockchain data | https://api.infra.mainnet.somnia.network |
| **STT** | Shannon Test Token (gas on testnet) | Faucet: [link TBD] |
| **SOMI** | Native token of Somnia (gas on mainnet) | Used for all transaction fees |
| **WBTC** | ERC-20 wrapped Bitcoin on Somnia | Staking token in BitDrum |

---

## 💻 Smart Contracts

| Term | Definition | Solidity File |
|------|-----------|---------------|
| **PredictionMarket** | Core contract managing market lifecycle & stakes | `src/PredictionMarket.sol` |
| **SettlementEngine** | Verifies oracle prices and settles outcomes | `src/SettlementEngine.sol` |
| **LiquidityVault** | Automatic counterparty and winner payout funding | `src/LiquidityVault.sol` |
| **Treasury** | Accumulates & allocates protocol fees | `src/Treasury.sol` |
| **LeaderboardRegistry** | Append-only on-chain trader stat storage | `src/LeaderboardRegistry.sol` |
| **SubscriptionsContract** | Manages Signal Pro / Elite tier subscriptions | `src/SubscriptionsContract.sol` |
| **ERC-20** | Token standard for WBTC | OpenZeppelin: `IERC20` |
| **ERC-4337** | Account Abstraction standard (gasless txns) | EntryPoint: `0x000...032` |
| **State Machine** | Market lifecycle: OPEN → LOCKED → SETTLED → CLAIMABLE → CLOSED | Core protocol |

---

## 🔮 Oracle & Price Feeds

| Term | Definition | Purpose |
|------|-----------|---------|
| **DIA Oracle** | Decentralized price oracle (primary) | BTC/USD feed for settlement |
| **Protofire** | Fallback centralized price oracle | Settlement fallback if DIA stale |
| **Staleness Check** | Verify price is ≤30 seconds old | Prevent stale data settlement |
| **Price Attestation** | Signed proof of price from oracle | On-chain verification required |
| **Strike Price** | BTC/USD price recorded at market open | Immutable reference point |

---

## 🚀 Backend Services

| Service | Language | Purpose | File |
|---------|----------|---------|------|
| **Keeper Bot** | Node.js/TS | Automatic settlement trigger every 3s | `backend/keeper/src/index.ts` |
| **Social Indexer** | Node.js/TS | Event listener + leaderboard compute | `backend/indexer/src/index.ts` |
| **AI Agent** | Python/FastAPI | Signal inference + POM calculation | `backend/ai-agent/main.py` |
| **API Gateway** | Node.js/Express | REST + WebSocket aggregation | `backend/gateway/src/index.ts` |
| **Subscription Distributor** | Node.js/TS | Monthly ORACLE reward payout | `backend/subscription-distributor/src/distributor.ts` |

---

## 🎨 Frontend Stack

| Component | Technology | Purpose | File |
|-----------|-----------|---------|------|
| **Framework** | Next.js 14 | React app with SSR | `frontend/app/page.tsx` |
| **Styling** | Tailwind CSS | Utility-based CSS | `frontend/app/globals.css` |
| **Wallet (New)** | Privy | Social login + EVM wallet | `frontend/lib/privy-config.ts` |
| **Wallet (Crypto)** | MetaMask + RainbowKit | Native wallet connection | `frontend/lib/wagmi-config.ts` |
| **Chain Interaction** | Wagmi + Ethers.js v6 | Contract reading/writing | `frontend/hooks/useContract` |
| **Real-Time** | WebSocket | Live market updates | `frontend/lib/useWebSocket.ts` |

---

## 📊 Data & Storage

| Layer | Technology | Content |
|-------|-----------|---------|
| **Smart Contracts** | Somnia Blockchain | Markets, stakes, settlement results |
| **PostgreSQL** | Relational DB | Trader profiles, leaderboard, signal history |
| **Redis** | In-Memory Cache | API response caching, rate-limiting |
| **Event Stream** | Ethers.js Listeners | Real-time market + settlement events |

---

## 💰 Economic Concepts

| Term | Definition | Range |
|------|-----------|-------|
| **POM** | Probable Outcome Multiplier (AI-determined profit %) | 5% - 70% |
| **Protocol Fee** | Deducted from each settled pool | 2% of total stakes |
| **Vault Margin** | Structural profit to Liquidity Vault | ~30% per cycle (at 50/50 split, 40% POM) |
| **Signal Pro** | Monthly subscription tier | $9.99/month in WBTC |
| **Signal Elite** | Premium subscription tier | $24.99/month in WBTC |
| **ORACLE Tier** | Top 1% of traders by performance | Gets free Signal Elite + monthly rewards |

---

## 🔐 Security

| Concept | Implementation | Location |
|---------|----------------|----------|
| **Oracle Staleness** | Reject prices > 30 seconds old | `SettlementEngine.sol` |
| **Keeper Redundancy** | Anyone can call `settle()` directly | `SettlementEngine.sol` function |
| **Non-Custodial** | No admin has fund access | Contract design |
| **Immutability** | Contracts not upgradeable | Design choice |
| **ERC-4337** | Gasless transactions + session keys | EntryPoint integration |

---

## 🔄 Git Workflow

| Branch | Status | Represents |
|--------|--------|-----------|
| `main` | Production | Live deployments |
| `phase-1-contracts` | Development | Smart contract implementation |
| `phase-2-backend` | Development | Backend microservices |
| `phase-3-frontend` | Development | Next.js frontend |
| `phase-4-integration` | Development | E2E testing & QA |
| `phase-5-launch` | Development | Security & mainnet prep |

**Commit Strategy**: Small, focused commits after each completed task (30min-2hr chunks)

---

## 📝 File Structure

```
bitdrum/
├── IMPLEMENTATION_PLAN.md      ← Main roadmap (1,200+ lines)
├── QUICK_START.md               ← Onboarding guide
├── DEPLOYMENT_ADDRESSES.md      ← Contract address tracking
├── TECHNICAL_GLOSSARY.md        ← This file
│
├── contracts/
│   ├── foundry.toml             ← Foundry config
│   ├── src/                      ← Solidity contracts
│   ├── test/                     ← Forge tests
│   └── script/                   ← Deploy scripts
│
├── backend/
│   ├── keeper/                   ← Settlement bot
│   ├── indexer/                  ← Event indexer
│   ├── ai-agent/                 ← Signal engine
│   ├── gateway/                  ← API server
│   └── subscription-distributor/ ← Payout bot
│
└── frontend/
    ├── app/                      ← Next.js pages
    ├── components/               ← React components
    ├── lib/                      ← Utilities
    └── public/                   ← Static assets
```

---

## 🚦 Environment Variables Summary

### Contract Addresses (Needed by Frontend & Backend)

```
NEXT_PUBLIC_PREDICTION_MARKET_ADDR=0x...
NEXT_PUBLIC_SETTLEMENT_ENGINE_ADDR=0x...
NEXT_PUBLIC_LIQUIDITY_VAULT_ADDR=0x...
NEXT_PUBLIC_TREASURY_ADDR=0x...
NEXT_PUBLIC_LEADERBOARD_REGISTRY_ADDR=0x...
NEXT_PUBLIC_SUBSCRIPTIONS_ADDR=0x...
NEXT_PUBLIC_WBTC_ADDR=0x...
```

### RPC Endpoints (Needed by All Services)

```
SOMNIA_RPC_URL=https://api.infra.mainnet.somnia.network  # Mainnet
SOMNIA_RPC_URL=https://dream-rpc.somnia.network         # Testnet
```

### Private Keys (Keeper Bot Only)

```
KEEPER_PRIVATE_KEY=0x...  # Non-custodial, funded with
 gas
DEPLOYER_PRIVATE_KEY=0x...  # Used for initial deployment
```

### Database (Indexer, Gateway, AI Agent)

```
DATABASE_URL=postgres://user:password@host:5432/bitdrum
REDIS_URL=redis://user:password@host:6379
```

### External APIs

```
OPENAI_API_KEY=sk-...  # Optional for AI Agent
PRIVY_APP_ID=...       # For Privy wallet integration
```

---

## 🔗 External Resources

| Resource | URL | Used By |
|----------|-----|---------|
| Somnia Docs | https://docs.somnia.network | All |
| Foundry | https://book.getfoundry.sh | Phase 1 |
| Ethers.js | https://docs.ethers.org/v6 | All |
| Wagmi | https://wagmi.sh | Frontend |
| Privy | https://docs.privy.io | Frontend |
| Next.js | https://nextjs.org/docs | Frontend |
| PostgreSQL Docs | https://www.postgresql.org/docs | Indexer |
| Redis Docs | https://redis.io/documentation | Cache |
| DIA Oracle Docs | https://docs.diadata.org | Contracts |

---

## 🎯 Success Criteria by Phase

| Phase | Metric | Target |
|-------|--------|--------|
| 1 | Test Coverage | >90% |
| 1 | Contracts Deployed | ✓ Testnet |
| 2 | Services Running | 5/5 ✓ |
| 2 | Settlement Verified | ≥1 market ✓ |
| 3 | Frontend Responsive | Desktop + Mobile ✓ |
| 3 | Wallet Connection | Both methods ✓ |
| 4 | Smoke Tests | 10/10 passing ✓ |
| 4 | Performance | <5s/settle, <200ms API ✓ |
| 5 | Security Audit | Passed ✓ |
| 5 | Mainnet Live | Users trading ✓ |

---

**Document Version**: 1.0  
**Last Updated**: 2026-04-03  
**Scope**: Technical reference for Somnia Implementation
