import { Router } from 'express';
import axios from 'axios';
import dotenv from 'dotenv';
import { checkSubscription } from '../middleware/auth';
import { pool } from '../db';
// V2: Streams write-on-read removed from GET endpoints.
// Streams publishing is optional and async — not on the critical path.
// import { ... } from '../services/streams';

dotenv.config();

const router = Router();
const AI_AGENT_URL = process.env.AI_AGENT_URL || 'http://localhost:8000';

type TraderPositionRow = {
  participant_address: string;
  direction: string;
  tier: string;
  markets_entered: number;
  wins: number;
  losses: number;
  total_staked: string;
  total_claimed: string;
  composite_score: string;
};

function normalizeDirection(direction: string | null | undefined) {
  const normalized = (direction || '').toUpperCase();

  if (['LONG', 'UP', 'BULLISH'].includes(normalized)) {
    return 'UP';
  }

  if (['SHORT', 'DOWN', 'BEARISH'].includes(normalized)) {
    return 'DOWN';
  }

  return 'NEUTRAL';
}

function bigintFromNumeric(value: string | null | undefined) {
  return BigInt(value || '0');
}

function parseStakeToWei(stake: string): bigint {
  if (!stake || stake === '0') return 0n;
  if (stake.includes('.')) {
    const [whole, frac = ''] = stake.split('.');
    const fracPadded = frac.padEnd(18, '0').slice(0, 18);
    return BigInt(whole || '0') * 10n ** 18n + BigInt(fracPadded);
  }
  return BigInt(stake);
}

function toUnixSeconds(value: string | Date | null | undefined) {
  if (!value) {
    return null;
  }

  return Math.floor(new Date(value).getTime() / 1000);
}

function calculateSettlementDeadline(
  openedAt: string | Date | null | undefined,
  durationSeconds: number | null | undefined,
  joinDeadline: number | null | undefined,
) {
  const openedAtSeconds = toUnixSeconds(openedAt);

  if (openedAtSeconds && durationSeconds) {
    return openedAtSeconds + durationSeconds;
  }

  return joinDeadline ?? null;
}

function calculateEntitledPayout(stakeAmount: string, pomProfitBps: number, outcome: string | null, direction: string) {
  const stake = bigintFromNumeric(stakeAmount);

  if (!outcome) {
    return 0n;
  }

  if (outcome === 'Draw' || normalizeDirection(outcome) === 'NEUTRAL') {
    return stake;
  }

  if (normalizeDirection(direction) === normalizeDirection(outcome)) {
    return stake + (stake * BigInt(pomProfitBps || 0)) / 10_000n;
  }

  return 0n;
}

function calculatePositionStatus(state: string, outcome: string | null, claimed: boolean, direction: string) {
  if (!outcome) {
    return state;
  }

  if (claimed) {
    return 'CLAIMED';
  }

  if (outcome === 'Draw' || normalizeDirection(outcome) === 'NEUTRAL') {
    return 'DRAW';
  }

  return normalizeDirection(direction) === normalizeDirection(outcome) ? 'WIN' : 'LOSS';
}

function buildSignalResponse(row: any) {
  return {
    market_id: row.market_id,
    signal: {
      direction: row.direction,
      confidence: row.confidence,
      rationale: row.rationale,
      generated_at: row.generated_at,
      is_accurate: row.is_accurate,
    },
    source: 'gateway-cache',
  };
}

async function getLatestSignal(marketId: string) {
  const { rows } = await pool.query(
    `
      SELECT market_id, direction, confidence, rationale, generated_at, is_accurate
      FROM ai_signals
      WHERE market_id = $1
      ORDER BY generated_at DESC
      LIMIT 1
    `,
    [marketId],
  );

  return rows[0] || null;
}

function buildSignalResponseFromStreams(signal: any) {
  return {
    market_id: signal.market_id,
    signal: {
      direction: signal.direction,
      confidence: signal.confidence,
      rationale: signal.rationale,
      generated_at: signal.generated_at,
      is_accurate: null,
    },
    source: 'somnia-streams',
  };
}

async function getSignalAccuracyLast30d() {
  const { rows } = await pool.query(
    `
      SELECT
        COUNT(*) FILTER (WHERE is_accurate IS NOT NULL) AS total_signals,
        COUNT(*) FILTER (WHERE is_accurate = true) AS accurate_signals
      FROM ai_signals
      WHERE generated_at >= NOW() - INTERVAL '30 days'
    `,
  );

  const totalSignals = Number(rows[0]?.total_signals || 0);
  const accurateSignals = Number(rows[0]?.accurate_signals || 0);

  return totalSignals > 0 ? accurateSignals / totalSignals : 0;
}

function calculateTraderInfluence(positions: TraderPositionRow[]) {
  const traderMetrics = positions.map((position) => {
    const decisiveTrades = Number(position.wins || 0) + Number(position.losses || 0);
    const winRate = decisiveTrades > 0 ? Number(position.wins || 0) / decisiveTrades : 0;
    const netPnl =
      Number(position.total_claimed || 0) - Number(position.total_staked || 0);

    return {
      ...position,
      winRate,
      netPnl,
    };
  });

  const maxPositiveNetPnl = traderMetrics.reduce((max, trader) => {
    return trader.netPnl > max ? trader.netPnl : max;
  }, 0);

  let totalWeight = 0;
  let directionalBias = 0;
  let longVotes = 0;
  let shortVotes = 0;

  const enriched = traderMetrics.map((trader) => {
    const normalizedNetPnl =
      maxPositiveNetPnl > 0 && trader.netPnl > 0 ? trader.netPnl / maxPositiveNetPnl : 0;
    const participationWeight = Math.min(1, Number(trader.markets_entered || 0) / 50);
    const tis = (trader.winRate * 0.6 + normalizedNetPnl * 0.4) * participationWeight;
    const vote = normalizeDirection(trader.direction) === 'UP' ? 1 : -1;

    totalWeight += tis;
    directionalBias += tis * vote;

    if (vote > 0) {
      longVotes += 1;
    } else {
      shortVotes += 1;
    }

    return {
      address: trader.participant_address,
      tier: trader.tier,
      direction: normalizeDirection(trader.direction),
      weight: tis,
      composite_score: trader.composite_score,
    };
  });

  return {
    traders: enriched,
    longVotes,
    shortVotes,
    totalQualifyingTraders: enriched.length,
    directionBias: totalWeight > 0 ? directionalBias / totalWeight : 0,
    alignmentStrength: totalWeight > 0 ? Math.abs(directionalBias / totalWeight) : 0,
  };
}

async function getMarketContext(marketId: string) {
  const { rows: marketRows } = await pool.query(
    `
      SELECT *
      FROM markets
      WHERE market_id = $1
      LIMIT 1
    `,
    [marketId],
  );

  const market = marketRows[0];

  if (!market) {
    return null;
  }

  const { rows: positionRows } = await pool.query<TraderPositionRow>(
    `
      SELECT
        s.participant_address,
        s.direction,
        t.tier,
        t.markets_entered,
        t.wins,
        t.losses,
        t.total_staked,
        t.total_claimed,
        t.composite_score
      FROM stakes s
      JOIN traders t ON lower(t.address) = lower(s.participant_address)
      WHERE s.market_id = $1
        AND t.tier IN ('ORACLE', 'PROPHET')
    `,
    [marketId],
  );

  const alignment = calculateTraderInfluence(positionRows);

  return {
    market: {
      market_id: market.market_id,
      state: market.state,
      long_pool: market.long_pool,
      short_pool: market.short_pool,
      pom_profit_bps: market.pom_profit_bps,
      entry_price: market.entry_price,
      settlement_price: market.settlement_price,
      outcome: market.outcome,
      join_deadline: market.join_deadline,
      opened_at: market.opened_at,
      duration_seconds: market.duration_seconds,
      settlement_deadline: calculateSettlementDeadline(
        market.opened_at,
        Number(market.duration_seconds || 0),
        market.join_deadline,
      ),
      settled_at: market.settled_at,
      up_pool: market.long_pool,
      down_pool: market.short_pool,
    },
    top_trader_alignment: alignment,
    signal_accuracy_last_30d: await getSignalAccuracyLast30d(),
  };
}

async function getPreviewContext(direction: string, stake: string, durationSeconds: number) {
  const { rows: marketRows } = await pool.query(
    `
      SELECT long_pool, short_pool
      FROM markets
      WHERE state IN ('OPEN', 'LOCKED')
      ORDER BY opened_at DESC
      LIMIT 25
    `,
  );

  const { rows: positionRows } = await pool.query<TraderPositionRow>(
    `
      SELECT
        s.participant_address,
        s.direction,
        t.tier,
        t.markets_entered,
        t.wins,
        t.losses,
        t.total_staked,
        t.total_claimed,
        t.composite_score
      FROM stakes s
      JOIN traders t ON lower(t.address) = lower(s.participant_address)
      JOIN markets m ON m.market_id = s.market_id
      WHERE m.state IN ('OPEN', 'LOCKED')
        AND t.tier IN ('ORACLE', 'PROPHET')
      ORDER BY s.timestamp DESC
      LIMIT 50
    `,
  );

  const previewStake = parseStakeToWei(stake);
  const currentLongPool = marketRows.reduce((sum, row) => sum + bigintFromNumeric(row.long_pool), 0n);
  const currentShortPool = marketRows.reduce((sum, row) => sum + bigintFromNumeric(row.short_pool), 0n);

  const projectedLongPool =
    normalizeDirection(direction) === 'UP' ? currentLongPool + previewStake : currentLongPool;
  const projectedShortPool =
    normalizeDirection(direction) === 'DOWN' ? currentShortPool + previewStake : currentShortPool;
  const now = Math.floor(Date.now() / 1000);
  const joinDeadline = now + Math.floor(durationSeconds / 3);

  return {
    market: {
      market_id: 'preview',
      state: 'PREVIEW',
      long_pool: projectedLongPool.toString(),
      short_pool: projectedShortPool.toString(),
      pom_profit_bps: null,
      entry_price: null,
      settlement_price: null,
      outcome: null,
      join_deadline: joinDeadline,
      opened_at: new Date(now * 1000).toISOString(),
      duration_seconds: durationSeconds,
      settlement_deadline: now + durationSeconds,
      settled_at: null,
      up_pool: projectedLongPool.toString(),
      down_pool: projectedShortPool.toString(),
    },
    top_trader_alignment: calculateTraderInfluence(positionRows),
    signal_accuracy_last_30d: await getSignalAccuracyLast30d(),
  };
}

// 1. Public Market Feed
router.get('/markets', async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `
        SELECT
          m.*,
          s.direction AS signal_direction,
          s.confidence AS signal_confidence,
          s.rationale AS signal_rationale
        FROM markets m
        LEFT JOIN LATERAL (
          SELECT direction, confidence, rationale
          FROM ai_signals
          WHERE market_id = m.market_id
          ORDER BY generated_at DESC
          LIMIT 1
        ) s ON true
        ORDER BY m.opened_at DESC
        LIMIT 50
      `,
    );

    const markets = rows.map((row) => ({
      id: row.market_id,
      state: row.state,
      direction: normalizeDirection(row.opener_direction),
      entry_price: row.entry_price,
      settlement_price: row.settlement_price,
      long_pool: row.long_pool,
      short_pool: row.short_pool,
      up_pool: row.long_pool,
      down_pool: row.short_pool,
      pom_profit_bps: row.pom_profit_bps,
      outcome: row.outcome ? normalizeDirection(row.outcome) : row.outcome,
      join_deadline: row.join_deadline,
      opened_at: row.opened_at,
      duration_seconds: row.duration_seconds,
      settlement_deadline: calculateSettlementDeadline(
        row.opened_at,
        Number(row.duration_seconds || 0),
        row.join_deadline,
      ),
      signal: row.signal_direction
        ? {
            direction: normalizeDirection(row.signal_direction),
            confidence: row.signal_confidence,
            rationale: row.signal_rationale,
          }
        : null,
    }));

    res.json({ markets, source: 'Postgres DB' });
  } catch (error: any) {
    console.error('[Gateway] Markets error:', error);
    res.status(500).json({ error: 'Database unavailable' });
  }
});

router.get('/markets/:market_id', async (req, res) => {
  try {
    const context = await getMarketContext(req.params.market_id);

    if (!context) {
      return res.status(404).json({ error: 'Market not found' });
    }

    res.json(context);
  } catch (error: any) {
    console.error('[Gateway] Market detail error:', error.message);
    res.status(500).json({ error: 'Failed to fetch market details' });
  }
});

// 2. AI Signal (Gated)
router.get('/signal/preview', async (req, res) => {
  const direction = String(req.query.direction || 'UP');
  const stake = String(req.query.stake || '0');
  const durationSeconds = Number(req.query.durationSeconds || req.query.duration_seconds || 300);

  try {
    const response = await axios.post(`${AI_AGENT_URL}/signal/preview`, {
      direction,
      stake,
      duration_seconds: durationSeconds,
    });

    res.json(response.data);
  } catch (error: any) {
    console.warn(`[Gateway] AI preview unavailable, returning static fallback: ${error.message}`);
    res.json({
      signal: {
        direction: 'NEUTRAL',
        confidence: 50,
        rationale: 'AI signal agent is currently unavailable. Proceed with your own analysis.',
        generated_at: new Date().toISOString(),
        is_accurate: null,
      },
      source: 'static-fallback',
    });
  }
});

router.get('/signal/:market_id', async (req, res) => {
  const { market_id } = req.params;

  try {
    const cachedSignal = await getLatestSignal(market_id);

    if (cachedSignal) {
      const generatedAt = new Date(cachedSignal.generated_at).getTime();
      if (Date.now() - generatedAt < 30_000) {
        return res.json(buildSignalResponse(cachedSignal));
      }
    }

    const response = await axios.post(`${AI_AGENT_URL}/signal`, { market_id });
    res.json(response.data);
  } catch (error: any) {
    console.error(`[Gateway] AI Error: ${error.message}`);

    try {
      const cachedSignal = await getLatestSignal(market_id);
      if (cachedSignal) {
        return res.json(buildSignalResponse(cachedSignal));
      }
    } catch (cacheError) {
      console.error('[Gateway] Signal cache fallback failed:', cacheError);
    }

    // V2: no Streams fallback; if AI and DB are both unavailable, return graceful error.
    res.status(503).json({ error: 'AI signal unavailable', details: error.message });
  }
});

// V2: /pom endpoints removed. Payout rates are now fixed per-market and visible
// onchain via market.pomProfitBps (locked at open time by vault liquidity).
// Frontend reads payout directly from the contract via currentPayoutBps().

// 3. Leaderboard
router.get('/leaderboard', async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `
        SELECT
          address,
          tier,
          composite_score AS score,
          markets_entered,
          wins,
          losses,
          draws,
          total_staked,
          total_claimed
        FROM traders
        ORDER BY composite_score DESC, wins DESC
        LIMIT 50
      `,
    );

    const rankings = rows.map((row) => {
      const decisiveTrades = Number(row.wins || 0) + Number(row.losses || 0);
      const winRate = decisiveTrades > 0 ? Number(row.wins || 0) / decisiveTrades : 0;
      const pnl = bigintFromNumeric(row.total_claimed) - bigintFromNumeric(row.total_staked);

      return {
        ...row,
        win_rate: winRate,
        net_pnl: pnl.toString(),
      };
    });

    res.json({ rankings, source: 'Postgres DB' });
  } catch (error: any) {
    console.error('[Gateway] Leaderboard error:', error);
    res.status(500).json({ error: 'Database unavailable' });
  }
});

// 4. Active Positions & PnL
router.get('/positions/:address', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `
        SELECT
          s.market_id,
          s.participant_address,
          s.direction,
          s.stake_amount,
          s.claimed,
          s.payout,
          s.transaction_hash,
          s.timestamp,
          m.state,
          m.entry_price,
          m.settlement_price,
          m.outcome,
          m.pom_profit_bps,
          m.join_deadline,
          m.opened_at,
          m.settled_at
        FROM stakes s
        JOIN markets m ON m.market_id = s.market_id
        WHERE lower(s.participant_address) = lower($1)
        ORDER BY COALESCE(m.settled_at, m.opened_at) DESC, s.timestamp DESC
      `,
      [req.params.address],
    );

    const positions = rows.map((row) => {
      const entitledPayout = calculateEntitledPayout(
        row.stake_amount,
        Number(row.pom_profit_bps || 0),
        row.outcome,
        row.direction,
      );
      const netPnl = entitledPayout - bigintFromNumeric(row.stake_amount);
      const status = calculatePositionStatus(row.state, row.outcome, row.claimed, row.direction);
      const canClaim =
        !row.claimed &&
        row.state === 'CLAIMABLE' &&
        (row.outcome === 'Draw'
          || normalizeDirection(row.outcome) === 'NEUTRAL'
          || normalizeDirection(row.direction) === normalizeDirection(row.outcome));

      return {
        market_id: row.market_id,
        direction: normalizeDirection(row.direction),
        stake_amount: row.stake_amount,
        claimed: row.claimed,
        payout: row.payout,
        expected_payout: entitledPayout.toString(),
        net_pnl: netPnl.toString(),
        state: row.state,
        entry_price: row.entry_price,
        settlement_price: row.settlement_price,
        outcome: row.outcome ? normalizeDirection(row.outcome) : row.outcome,
        transaction_hash: row.transaction_hash,
        duration_seconds: row.duration_seconds ?? 300,
        join_deadline: row.join_deadline,
        opened_at: row.opened_at,
        settlement_deadline: calculateSettlementDeadline(
          row.opened_at,
          Number(row.duration_seconds || 0),
          row.join_deadline,
        ),
        settled_at: row.settled_at,
        status,
        can_claim: canClaim,
      };
    });

    const summary = positions.reduce(
      (accumulator, position) => {
        const netPnl = bigintFromNumeric(position.net_pnl);
        const stakeAmount = bigintFromNumeric(position.stake_amount);

        accumulator.total_staked += stakeAmount;

        if (position.outcome) {
          accumulator.resolved_pnl += netPnl;
          if (position.status === 'WIN') accumulator.wins += 1;
          if (position.status === 'LOSS') accumulator.losses += 1;
          if (position.status === 'DRAW') accumulator.draws += 1;
        } else {
          accumulator.active_positions += 1;
        }

        return accumulator;
      },
      {
        total_staked: 0n,
        resolved_pnl: 0n,
        wins: 0,
        losses: 0,
        draws: 0,
        active_positions: 0,
      },
    );

    const decisiveTrades = summary.wins + summary.losses;

    res.json({
      positions,
      summary: {
        total_staked: summary.total_staked.toString(),
        resolved_pnl: summary.resolved_pnl.toString(),
        wins: summary.wins,
        losses: summary.losses,
        draws: summary.draws,
        active_positions: summary.active_positions,
        win_rate: decisiveTrades > 0 ? summary.wins / decisiveTrades : 0,
      },
    });
  } catch (error: any) {
    console.error('[Gateway] Positions error:', error.message);
    res.status(500).json({ error: 'Failed to fetch positions' });
  }
});

// 5. Social Follow Graph
router.post('/follow', async (req, res) => {
  const { followerAddress, followingAddress } = req.body ?? {};

  if (!followerAddress || !followingAddress) {
    return res.status(400).json({ error: 'followerAddress and followingAddress are required' });
  }

  if (followerAddress.toLowerCase() === followingAddress.toLowerCase()) {
    return res.status(400).json({ error: 'Cannot follow the same wallet' });
  }

  try {
    const existing = await pool.query(
      `
        SELECT id
        FROM follows
        WHERE lower(follower_address) = lower($1)
          AND lower(following_address) = lower($2)
        LIMIT 1
      `,
      [followerAddress, followingAddress],
    );

    if (existing.rowCount === 0) {
      await pool.query(
        `
          INSERT INTO follows (follower_address, following_address)
          VALUES ($1, $2)
        `,
        [followerAddress, followingAddress],
      );
    }

    res.status(201).json({ ok: true });
  } catch (error: any) {
    console.error('[Gateway] Follow error:', error.message);
    res.status(500).json({ error: 'Failed to save follow relationship' });
  }
});

router.delete('/follow', async (req, res) => {
  const { followerAddress, followingAddress } = req.body ?? {};

  if (!followerAddress || !followingAddress) {
    return res.status(400).json({ error: 'followerAddress and followingAddress are required' });
  }

  try {
    await pool.query(
      `
        DELETE FROM follows
        WHERE lower(follower_address) = lower($1)
          AND lower(following_address) = lower($2)
      `,
      [followerAddress, followingAddress],
    );

    res.json({ ok: true });
  } catch (error: any) {
    console.error('[Gateway] Unfollow error:', error.message);
    res.status(500).json({ error: 'Failed to remove follow relationship' });
  }
});

router.get('/feed', async (req, res) => {
  const feedType = String(req.query.type || 'following');
  const viewerAddress = String(req.query.address || '');

  try {
    let query = `
      SELECT
        s.market_id,
        s.participant_address,
        s.direction,
        s.stake_amount,
        s.timestamp,
        m.opener_address,
        m.long_pool,
        m.short_pool,
        m.state,
        m.pom_profit_bps,
        m.join_deadline,
        m.opened_at,
        t.tier,
        t.composite_score
      FROM stakes s
      JOIN markets m ON m.market_id = s.market_id
      LEFT JOIN traders t ON lower(t.address) = lower(s.participant_address)
    `;
    const params: string[] = [];

    if (feedType === 'following') {
      if (!viewerAddress) {
        return res.status(400).json({ error: 'address query param required for following feed' });
      }

      query += `
        JOIN follows f
          ON lower(f.following_address) = lower(s.participant_address)
         AND lower(f.follower_address) = lower($1)
      `;
      params.push(viewerAddress);
      query += ` ORDER BY s.timestamp DESC LIMIT 50`;
    } else if (feedType === 'oracle') {
      query += ` WHERE t.tier = 'ORACLE' ORDER BY s.timestamp DESC LIMIT 50`;
    } else {
      query += ` WHERE m.state IN ('OPEN', 'LOCKED') ORDER BY (m.long_pool::numeric + m.short_pool::numeric) DESC, s.timestamp DESC LIMIT 50`;
    }

    const { rows } = await pool.query(query, params);
    const marketIds = Array.from(new Set(rows.map((row) => row.market_id)));
    const latestSignals =
      marketIds.length === 0
        ? []
        : (
            await pool.query(
              `
                SELECT DISTINCT ON (market_id)
                  market_id,
                  direction,
                  confidence,
                  rationale
                FROM ai_signals
                WHERE market_id = ANY($1::text[])
                ORDER BY market_id, generated_at DESC
              `,
              [marketIds],
            )
          ).rows;

    const signalByMarket = new Map(latestSignals.map((signal) => [signal.market_id, signal]));

    const feed = rows.map((row) => {
      const signal = signalByMarket.get(row.market_id);

      return {
        market_id: row.market_id,
        participant_address: row.participant_address,
        action: row.participant_address.toLowerCase() === row.opener_address.toLowerCase() ? 'OPENED' : 'JOINED',
        direction: normalizeDirection(row.direction),
        stake_amount: row.stake_amount,
        timestamp: row.timestamp,
        tier: row.tier || 'SCOUT',
        long_pool: row.long_pool,
        short_pool: row.short_pool,
        up_pool: row.long_pool,
        down_pool: row.short_pool,
        state: row.state,
        pom_profit_bps: row.pom_profit_bps,
        duration_seconds: row.duration_seconds ?? 300,
        join_deadline: row.join_deadline,
        opened_at: row.opened_at,
        settlement_deadline: calculateSettlementDeadline(
          row.opened_at,
          Number(row.duration_seconds || 0),
          row.join_deadline,
        ),
        signal: signal
          ? {
              direction: normalizeDirection(signal.direction),
              confidence: signal.confidence,
              rationale: signal.rationale,
            }
          : null,
      };
    });

    res.json({ feed, type: feedType });
  } catch (error: any) {
    console.error('[Gateway] Feed error:', error.message);
    res.status(500).json({ error: 'Failed to fetch social feed' });
  }
});

// 6. Internal AI / POM support
router.get('/internal/market-context/preview', async (req, res) => {
  try {
    const direction = String(req.query.direction || 'UP');
    const stake = String(req.query.stake || '0');
    const durationSeconds = Number(req.query.durationSeconds || req.query.duration_seconds || 300);
    const context = await getPreviewContext(direction, stake, durationSeconds);
    res.json(context);
  } catch (error: any) {
    console.error('[Gateway] Internal preview context error:', error.message);
    res.status(500).json({ error: 'Failed to build preview context' });
  }
});

router.get('/internal/market-context/:market_id', async (req, res) => {
  try {
    const context = await getMarketContext(req.params.market_id);

    if (!context) {
      return res.status(404).json({ error: 'Market not found' });
    }

    res.json(context);
  } catch (error: any) {
    console.error('[Gateway] Internal market context error:', error.message);
    res.status(500).json({ error: 'Failed to fetch market context' });
  }
});

router.post('/internal/ai-signals', async (req, res) => {
  const { market_id, direction, confidence, rationale } = req.body ?? {};

  if (!market_id || !direction || confidence === undefined || !rationale) {
    return res.status(400).json({
      error: 'market_id, direction, confidence, and rationale are required',
    });
  }

  try {
    await pool.query(
      `
        INSERT INTO ai_signals (market_id, direction, confidence, rationale)
        VALUES ($1, $2, $3, $4)
      `,
      [market_id, direction, confidence, rationale],
    );

    // V2: Streams publish removed from POST path (write-on-read pattern).
    res.status(201).json({ ok: true });
  } catch (error: any) {
    console.error('[Gateway] AI signal persistence error:', error.message);
    res.status(500).json({ error: 'Failed to persist AI signal' });
  }
});

// V2: /streams endpoints removed — Streams write-on-read eliminated from all read paths.

// 7. Gateway Router
export default router;
