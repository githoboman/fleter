import dotenv from 'dotenv';
import path from 'path';

// Load from current working directory or specific path
dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { startPricePublisher, PUBLISH_INTERVAL_MS } from './services/pricePublisher';
import { startMarketLifecycle } from './services/marketLifecycle';

// Market lifecycle poll interval — check for lock/settle actions.
const LIFECYCLE_INTERVAL_MS = Number(process.env.POLLING_INTERVAL) || 3_000;

const startKeeper = async () => {
  console.log(JSON.stringify({
    event:              'keeper_start',
    version:            'v2',
    lifecycleIntervalMs: LIFECYCLE_INTERVAL_MS,
    publishIntervalMs:   PUBLISH_INTERVAL_MS,
  }));

  // Loop 1: Post BTC/USD price to BitdrumPriceAdapter every ~20s.
  await startPricePublisher();

  // Loop 2: Lock open markets and settle expired markets every 3s.
  await startMarketLifecycle(LIFECYCLE_INTERVAL_MS);
};

startKeeper().catch((err) => {
  console.error(JSON.stringify({ event: 'keeper_fatal', error: err?.message || String(err) }));
  process.exit(1);
});
