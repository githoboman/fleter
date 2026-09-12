# BitDrum V2 Deployment Addresses (Somnia Shannon Testnet)

Deployed on: 2026-04-09
Deployment Block: 352594919 (Start of V2 sequence)
Deployer/Owner: 0x29284e93b68C84A40c89873e567B9e14B95247b7

| Contract | Address |
| :--- | :--- |
| **BitdrumPriceAdapter** | `0xDeED8D1c527F673507F445fB6cb635C48DE0acB1` |
| **LiquidityVaultV2** | `0xB16927B62fccF99668B98544AFaF03c5C64d38ED` |
| **TreasuryV2** | `0x13B4A6C86EFa533e9bF3E035228021ca7Fa52ad7` |
| **LeaderboardRegistry** | `0x5BaC7081963c67518519bD70057dbA8E0e46ab45` |
| **PredictionMarketV2** | `0x87F8014110e5D6c69bb1A3e64f25dc595b4a861C` |
| **SettlementEngineV2** | `0x46c938d2D527A3Ca4a48ee8D8c4e72417618e67B` |

---

## Wiring Status
- [x] `vault.setPredictionMarket(market)`
- [x] `market.setSettlementEngine(engine)`
- [x] `leaderboard.setSettlementEngine(engine)`
- [x] `adapter.setKeeper(owner)`
- [x] `vault.deposit()` - Seeded with **50 STT**
