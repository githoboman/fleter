# BitDrum Keeper Bot

The Keeper Bot is an automation service responsible for polling Starknet for expired markets and triggering the settlement process. It ensures that payouts are processed as soon as a market expires.

## Role in the System
- Monitors market expiry block/timestamp.
- Fetches real-time price attestations from Pragma Oracle.
- Submits `settle` transactions to the Settlement Engine.

## Stack
- Node.js / TypeScript
- Starkzap Server SDK
- Pragma SDK

## Environment

Create `backend/keeper/.env`:

```env
STARKNET_RPC_URL=https://starknet-sepolia.public.blastapi.io
MARKET_CONTRACT_ADDRESS=0x...
SETTLEMENT_ENGINE_ADDRESS=0x...
PRAGMA_ORACLE_ADDRESS=0x...
KEEPER_ADDRESS=0x...
KEEPER_PRIVATE_KEY=0x...
POLLING_INTERVAL=3000
SETTLEMENT_DELAY_SECONDS=60
ATTESTATION_MAX_AGE_SECONDS=30
KEEPER_STATE_FILE=data/keeper-state.json
```

Notes:

- `MARKET_CONTRACT_ADDRESS`, `SETTLEMENT_ENGINE_ADDRESS`, and `PRAGMA_ORACLE_ADDRESS` should match the deployed Sepolia contracts.
- `KEEPER_STATE_FILE` defaults to `data/keeper-state.json` and is created automatically.

## Run

```bash
npm install
npm run build
npm start
```

The keeper polls for expired markets, locks them when the join window closes, then settles them after the configured settlement delay.
