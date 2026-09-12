/**
 * pricePublisher.ts
 *
 * Fetches the current BTC/USD price and posts it as a round to the
 * BitdrumPriceAdapter contract on a fixed cadence (PUBLISH_INTERVAL_MS).
 *
 * The market and settlement contracts read from the adapter — this loop
 * is the sole trusted price source for the v2 protocol.
 *
 * IMPORTANT: The adapter round timestamp is always Math.floor(Date.now() / 1000),
 * not the upstream oracle's timestamp. This ensures:
 *   - The settlement engine's `round.timestamp >= market.expiryAt` check always
 *     reflects when the keeper posted, not when DIA/Binance last updated.
 *   - Freshness guards based on block.timestamp work correctly.
 */

import { Contract } from 'ethers';
import { fetchOraclePrice } from './oracle';
import { getSigner } from './client';

const PRICE_ADAPTER_ADDRESS      = process.env.PRICE_ADAPTER_ADDRESS || '';
// Default 20s cadence: fast enough for 1m market settlement.
export const PUBLISH_INTERVAL_MS = Number(process.env.PRICE_PUBLISH_INTERVAL_MS || 20_000);
// If the latest onchain round is younger than this, skip a routine post.
// Ignored when force=true (called by settlement path).
const MIN_POST_INTERVAL_S        = Number(process.env.MIN_PRICE_POST_INTERVAL_S || 15);

const ADAPTER_ABI = [
  'function latestRoundId() view returns (uint256)',
  'function getLatestRound() view returns (uint256 roundId, uint128 price, uint128 timestamp)',
  'function postPrice(uint128 price, uint128 timestamp) returns (uint256 roundId)',
];

let adapterContract: Contract | null = null;

function ensureContracts() {
  if (!PRICE_ADAPTER_ADDRESS) {
    throw new Error('[PricePublisher] PRICE_ADAPTER_ADDRESS is not set');
  }
  if (!adapterContract) {
    const signer = getSigner();
    adapterContract = new Contract(PRICE_ADAPTER_ADDRESS, ADAPTER_ABI, signer);
  }
  return adapterContract;
}

/**
 * Post a single BTC/USD price round to the adapter.
 *
 * @param force  When true, skip the minimum-interval freshness guard.
 *               Used by the settlement path to guarantee a post-expiry round
 *               exists before calling SettlementEngineV2.settle().
 */
export async function publishPriceOnce(force = false): Promise<void> {
  const adapter = ensureContracts();
  const nowSeconds = Math.floor(Date.now() / 1000);

  // Check if the current onchain round is already fresh enough (routine posts only).
  if (!force) {
    try {
      const [, , latestTs] = await adapter.getLatestRound() as [bigint, bigint, bigint];
      const age = nowSeconds - Number(latestTs);
      if (age < MIN_POST_INTERVAL_S) {
        console.log(`[PricePublisher] Latest round is ${age}s old — skipping (min interval: ${MIN_POST_INTERVAL_S}s)`);
        return;
      }
    } catch {
      // No rounds yet — proceed to post.
    }
  }

  const snapshot = await fetchOraclePrice();

  // CRITICAL: Use the keeper's current wall-clock time as the adapter timestamp,
  // NOT the upstream oracle's (potentially stale) observation timestamp.
  // This ensures settlement freshness checks against block.timestamp work correctly.
  const postTimestamp = nowSeconds;

  const tx = await adapter.postPrice(snapshot.price, postTimestamp);
  const receipt = await tx.wait();
  const roundId = await adapter.latestRoundId();

  console.log(JSON.stringify({
    event:     'price_posted',
    roundId:   roundId.toString(),
    price:     snapshot.price.toString(),
    timestamp: postTimestamp,
    source:    snapshot.source,
    force,
    txHash:    receipt.hash,
  }));
}

export async function startPricePublisher(): Promise<void> {
  console.log(`[PricePublisher] Starting. Interval: ${PUBLISH_INTERVAL_MS}ms`);

  const loop = async () => {
    try {
      await publishPriceOnce();
    } catch (err: any) {
      console.error(JSON.stringify({
        event:   'price_publish_error',
        message: err?.message || String(err),
      }));
    }
    setTimeout(loop, PUBLISH_INTERVAL_MS);
  };

  loop();
}
