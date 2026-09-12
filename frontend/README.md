# BitDrum Frontend

The frontend is a Next.js application that renders the live market feed, trade panel, leaderboard, positions view, and Cartridge wallet session UI.

## Environment

Create `frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api
NEXT_PUBLIC_WS_URL=ws://localhost:3001/ws
NEXT_PUBLIC_CARTRIDGE_URL=https://x.cartridge.gg
NEXT_PUBLIC_CARTRIDGE_PRESET=bitdrum
NEXT_PUBLIC_AVNU_PAYMASTER_URL=
```

Notes:

- `NEXT_PUBLIC_API_URL` is required.
- `NEXT_PUBLIC_WS_URL` is optional. If omitted, it is derived from `NEXT_PUBLIC_API_URL`.
- `NEXT_PUBLIC_CARTRIDGE_URL` and `NEXT_PUBLIC_CARTRIDGE_PRESET` are optional but recommended for a stable demo experience.
- `NEXT_PUBLIC_AVNU_PAYMASTER_URL` is optional. Leave it empty if you want normal gas-paid execution.
- The frontend wallet flow is fully handled by Cartridge Controller through StarkZap.

## Run Locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Production Build

```bash
npm run build
npm start
```

## Wallet Flow

- The app connects with Cartridge Controller through StarkZap.
- Trade execution uses the connected controller wallet directly.
- If a paymaster URL is not configured, the wallet must have STRK for gas on Sepolia.

## Backend Dependencies

For a working demo, start these services before opening the UI:

- `backend/indexer`
- `backend/ai-agent`
- `backend/gateway`
- `backend/keeper`

The frontend expects market data and signal APIs from the gateway at `NEXT_PUBLIC_API_URL`.
