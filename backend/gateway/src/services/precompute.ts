/**
 * AI signal precomputation.
 *
 * Triggered by Reactivity events (MarketOpened, MarketLocked) rather than
 * on the user-facing request path. The result is cached in the DB and
 * optionally published to Somnia Streams so the frontend can read it
 * instantly without waiting for generation.
 */

import dotenv from 'dotenv';
import axios from 'axios';
import { pool } from '../db';
import { publishAiSignalToStreams } from './streams';

dotenv.config();

const AI_AGENT_URL = process.env.AI_AGENT_URL || 'http://localhost:8000';

// Prevent concurrent precompute calls for the same market.
const inFlight = new Set<string>();

export async function precomputeSignalForMarket(marketId: string): Promise<void> {
  const key = marketId;
  if (inFlight.has(key)) {
    return;
  }
  inFlight.add(key);

  try {
    const response = await axios.post(
      `${AI_AGENT_URL}/signal`,
      { market_id: marketId },
      { timeout: 15_000 },
    );

    const data = response.data?.signal ?? response.data;

    if (!data?.direction || data.confidence === undefined || !data.rationale) {
      console.warn(`[Precompute] Incomplete signal response for market ${marketId}`);
      return;
    }

    // Insert a new signal row (ai_signals allows multiple per market;
    // getLatestSignal reads ORDER BY generated_at DESC LIMIT 1).
    await pool.query(
      `
        INSERT INTO ai_signals (market_id, direction, confidence, rationale, generated_at)
        VALUES ($1, $2, $3, $4, NOW())
      `,
      [marketId, data.direction, Number(data.confidence), data.rationale],
    );

    // Publish to Somnia Streams (best-effort; don't block on failure)
    publishAiSignalToStreams({
      marketId,
      direction: data.direction,
      confidence: Number(data.confidence),
      rationale: data.rationale,
      generatedAt: new Date().toISOString(),
    }).catch((error) => {
      console.warn(`[Precompute] Streams publish failed for market ${marketId}:`, error?.message ?? error);
    });

    console.log(
      `[Precompute] Signal cached for market ${marketId}: ${data.direction} @ ${data.confidence}%`,
    );
  } catch (error: any) {
    console.warn(`[Precompute] Signal computation failed for market ${marketId}:`, error?.message ?? error);
  } finally {
    inFlight.delete(key);
  }
}
