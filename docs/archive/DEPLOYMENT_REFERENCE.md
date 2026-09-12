# BitDrum Somnia Deployment Reference

**Deployed**: April 6, 2026  
**Network**: Somnia Shannon (Chain ID 50312)  
**Block**: 350054041

## Contract Addresses

| Contract              | Address                                      |
| --------------------- | -------------------------------------------- |
| PredictionMarket      | `0x90C70e356540C8b53Bb5cd0BA35B8f2779c9a10c` |
| SettlementEngine      | `0x86f62D80fbdD194fAb3ABFC86C676cF5C4411A9D` |
| SubscriptionsContract | `0x0478E0bF2d6C969365Ae33eDbBbB40e467F43BAB` |
| LeaderboardRegistry   | `0x0aeeC511e30c7271ded720f17206c85F2F9EeFe7` |
| LiquidityVault        | `0x833E8336d77F7Da45c155e6df4E5c72391073E6c` |
| Treasury              | `0x042D0fb514f9753980055B34f210e7b19CB5AAF8` |

## Environment Variables Status

✅ **Fully Configured**

- ✅ `backend/indexer/.env` — START_BLOCK=350054041
- ✅ `backend/gateway/.env` — PREDICTION_MARKET_ADDRESS filled
- ✅ `backend/keeper/.env` — Contract addresses filled
- ✅ `frontend/.env.local` — All vars filled

⏳ **TODO**

- [ ] `backend/keeper/.env` — Add `KEEPER_PRIVATE_KEY` (generate new keeper wallet)
- [ ] `backend/gateway/.env` — Add `STREAMS_PUBLISHER_PRIVATE_KEY` and `STREAMS_PUBLISHER_ADDRESS`
- [ ] `backend/ai-agent/.env` — Verify `OPENAI_API_KEY` is set

## Quick Registry

For explorer lookups and testing:

```
Predicted Market opening signal: tx → PredictionMarket.openMarket()
Settlement: SettlementEngine.settle() via keeperPolling
Leaderboard: LeaderboardRegistry.records(userAddress)
Treasury fees: Treasury.distribute()
```

## Next Steps

1. **Generate Keeper Wallet** → fund with STT
2. **Set KEEPER_PRIVATE_KEY** in keeper + gateway .env
3. **Start Phase 5** services (Indexer → Gateway → Keeper → AI Agent → Frontend)
4. **Run Phase 6** smoke tests
