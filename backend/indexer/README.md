# BitDrum Indexer — Apibara

This indexer uses [Apibara](https://www.apibara.com) to stream Starknet Sepolia events from the BitDrum PredictionMarket contract and persist them to PostgreSQL via Drizzle ORM.

## Architecture

| File | Purpose |
|---|---|
| `apibara.config.ts` | Runtime config: stream URL, starting block, contract address |
| `bitdrum.indexer.ts` | Main indexer: decodes events and writes to DB |
| `lib/schema.ts` | Drizzle ORM schema: traders, markets, stakes, ai_signals, follows |
| `drizzle.config.ts` | Drizzle Kit config for migrations |

## Events Indexed

| Event | What it does |
|---|---|
| `MarketOpened` | Creates a new market row, ensures opener trader row exists |
| `MarketJoined` | Creates a stake row, ensures participant trader row exists |
| `MarketLocked` | Updates market state to `LOCKED` |
| `MarketClaimable` | Updates market state to `CLAIMABLE`, stores settlement price |
| `Claimed` | Marks the participant's stake as claimed with their payout |

## Setup

### 1. Get an Apibara API key

Sign up at [https://app.apibara.com](https://app.apibara.com), create an API key, and add it to `.env`:

```
DNA_TOKEN=your-api-key-here
```

### 2. Configure Postgres

For the full BitDrum demo, the indexer must write into the same PostgreSQL database that the gateway reads from.

Example `backend/indexer/.env`:

```
DNA_TOKEN=your-api-key-here
POSTGRES_CONNECTION_STRING=postgresql://0t41k1@localhost:5432/bitdrum
STARKNET_RPC_URL=https://starknet-sepolia.public.blastapi.io
VAULT_ADDRESS=0x...
```

Notes:

- `POSTGRES_CONNECTION_STRING` is required for the shared demo path.
- `STARKNET_RPC_URL` is optional and falls back to a public Sepolia RPC.
- `VAULT_ADDRESS` is optional and only needed if you want vault-related event handling enabled.

### 3. Run database migrations

```bash
npm run db:generate   # Generate SQL migration files
npm run db:migrate    # Apply migrations to Postgres
```

### 4. Run the indexer

```bash
npm install
npm run build
npm run start
```

For local debugging you can still use:

```bash
npm run dev
```

## Starting Block

The `startingBlock` in `apibara.config.ts` is set to `7_910_000` — just before the contract deployment block. Apibara will replay all events from that block forward to populate the database.
