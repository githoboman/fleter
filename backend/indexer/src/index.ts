import dotenv from 'dotenv';
import { mkdir, readFile, writeFile } from 'fs/promises';
import path from 'path';
import { Pool, type PoolClient } from 'pg';
import {
  createPublicClient,
  decodeEventLog,
  defineChain,
  fallback,
  getAddress,
  http,
  parseAbi,
} from 'viem';

dotenv.config();

const BOTCHAIN_RPC_URL = process.env.BOTCHAIN_RPC_URL || 'https://rpc.bohr.life';
const BOTCHAIN_RPC_FALLBACK_URL = process.env.BOTCHAIN_RPC_FALLBACK_URL || 'https://rpc.bohr.life';
const BOTCHAIN_CHAIN_ID = Number(process.env.BOTCHAIN_CHAIN_ID || 968);
// V2 contract addresses
const PREDICTION_MARKET_ADDRESS = process.env.PREDICTION_MARKET_ADDRESS || '';
const PRICE_ADAPTER_ADDRESS     = process.env.PRICE_ADAPTER_ADDRESS || '';
const START_BLOCK = BigInt(process.env.START_BLOCK || 0);
const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS || 3000);
const BLOCK_BATCH_SIZE = BigInt(process.env.BLOCK_BATCH_SIZE || 500);
const STATE_FILE = path.resolve(
  process.cwd(),
  process.env.INDEXER_STATE_FILE || 'data/indexer-state.json',
);
const DATABASE_URL =
  process.env.POSTGRES_CONNECTION_STRING || 'postgresql://0t41k1@localhost:5432/bitdrum';

const pool = new Pool({ connectionString: DATABASE_URL });

// V2: MarketOpened now includes payoutBps; MarketPomUpdated removed.
const MARKET_ABI = parseAbi([
  'event MarketOpened(uint256 indexed marketId, address indexed opener, uint8 direction, uint256 stakeAmount, uint256 duration, uint128 strikePrice, uint256 payoutBps)',
  'event MarketJoined(uint256 indexed marketId, address indexed participant, uint8 direction, uint256 stakeAmount)',
  'event MarketLocked(uint256 indexed marketId)',
  'event MarketSettled(uint256 indexed marketId, uint8 outcome, uint128 settlementPrice, uint256 feeAmount, uint256 sweptToVault)',
  'event MarketClaimed(uint256 indexed marketId, address indexed participant, uint8 outcome, uint256 payout, uint256 profit)',
  'function getMarket(uint256 marketId) view returns ((uint256 marketId,address opener,uint8 openerDirection,uint256 duration,uint256 openedAt,uint256 joiningWindowEnd,uint256 expiryAt,uint128 strikePrice,uint128 settlementPrice,uint128 strikeTimestamp,uint128 settlementTimestamp,uint256 pomProfitBps,uint256 upPool,uint256 downPool,uint256 totalUserStaked,uint256 vaultCommitted,uint256 feeAmount,uint256 sweptToVault,uint256 participantCount,uint256 claimedCount,uint8 state,uint8 outcome))',
  'function nextMarketId() view returns (uint256)',
]);

// Price adapter ABI for optional round indexing.
const ADAPTER_ABI = parseAbi([
  'event PricePosted(uint256 indexed roundId, uint128 price, uint128 timestamp)',
]);

type IndexerState = {
  lastProcessedBlock: string;
};

type MarketView = {
  marketId: bigint;
  opener: `0x${string}`;
  openerDirection: number;
  duration: bigint;
  openedAt: bigint;
  joiningWindowEnd: bigint;
  expiryAt: bigint;
  strikePrice: bigint;
  settlementPrice: bigint;
  strikeTimestamp: bigint;
  settlementTimestamp: bigint;
  pomProfitBps: bigint;
  upPool: bigint;
  downPool: bigint;
  totalUserStaked: bigint;
  vaultCommitted: bigint;
  feeAmount: bigint;
  sweptToVault: bigint;
  participantCount: bigint;
  claimedCount: bigint;
  state: number;
  outcome: number;
};

const MULTICALL3_ADDRESS: Record<number, `0x${string}`> = {
  5031: '0x5e44F178E8cF9B2F5409B6f18ce936aB817C5a11',
  50312: '0x841b8199E6d3Db3C6f264f6C2bd8848b3cA64223',
};

const chain = defineChain({
  id: BOTCHAIN_CHAIN_ID,
  name: BOTCHAIN_CHAIN_ID === 677 ? 'Bot Chain' : 'Bot Chain Testnet',
  network: BOTCHAIN_CHAIN_ID === 677 ? 'botchain' : 'botchain-testnet',
  nativeCurrency:
    BOTCHAIN_CHAIN_ID === 677
      ? { name: 'BOT', symbol: 'BOT', decimals: 18 }
      : { name: 'tBOT', symbol: 'tBOT', decimals: 18 },
  rpcUrls: {
    default: {
      http: [BOTCHAIN_RPC_URL, BOTCHAIN_RPC_FALLBACK_URL],
    },
    public: {
      http: [BOTCHAIN_RPC_URL, BOTCHAIN_RPC_FALLBACK_URL],
    },
  },
  contracts: {
    multicall3: {
      address: MULTICALL3_ADDRESS[BOTCHAIN_CHAIN_ID] ?? '0x841b8199E6d3Db3C6f264f6C2bd8848b3cA64223',
    },
  },
});

const publicClient = createPublicClient({
  chain,
  transport: fallback(
    [
      http(BOTCHAIN_RPC_URL, { retryCount: 3, retryDelay: 1000 }),
      http(BOTCHAIN_RPC_FALLBACK_URL, { retryCount: 2, retryDelay: 2000 }),
    ],
    { rank: false },
  ),
});

function normalizeDirection(direction: number | string | null | undefined) {
  const value = typeof direction === 'number' ? direction : Number(direction ?? 0);
  return value === 0 ? 'UP' : value === 1 ? 'DOWN' : 'NEUTRAL';
}

function normalizeOutcome(outcome: number | string | null | undefined) {
  const value = typeof outcome === 'number' ? outcome : Number(outcome ?? 0);
  if (value === 1) return 'UP';
  if (value === 2) return 'DOWN';
  if (value === 3) return 'Draw';
  return null;
}

function normalizeState(state: number | string | null | undefined) {
  const value = typeof state === 'number' ? state : Number(state ?? 0);
  if (value === 1) return 'OPEN';
  if (value === 2) return 'LOCKED';
  if (value === 3) return 'CLAIMABLE';
  if (value === 4) return 'CLOSED';
  return 'NONE';
}

function toDate(seconds: bigint) {
  return new Date(Number(seconds) * 1000);
}

async function loadState(): Promise<IndexerState> {
  try {
    const raw = await readFile(STATE_FILE, 'utf8');
    return JSON.parse(raw) as IndexerState;
  } catch {
    return { lastProcessedBlock: START_BLOCK.toString() };
  }
}

async function saveState(state: IndexerState) {
  await mkdir(path.dirname(STATE_FILE), { recursive: true });
  await writeFile(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
}

async function readMarket(marketId: bigint): Promise<MarketView> {
  return publicClient.readContract({
    address: PREDICTION_MARKET_ADDRESS as `0x${string}`,
    abi: MARKET_ABI,
    functionName: 'getMarket',
    args: [marketId],
  }) as Promise<MarketView>;
}

async function ensureTrader(client: PoolClient, address: string) {
  await client.query(
    `
      INSERT INTO traders (address)
      VALUES ($1)
      ON CONFLICT (address) DO NOTHING
    `,
    [address.toLowerCase()],
  );
}

async function upsertMarket(client: PoolClient, market: MarketView, txHash?: string | null) {
  await client.query(
    `
      INSERT INTO markets (
        market_id,
        opener_address,
        opener_direction,
        pom_profit_bps,
        stake,
        long_pool,
        short_pool,
        join_deadline,
        duration_seconds,
        state,
        entry_price,
        settlement_price,
        outcome,
        transaction_hash,
        opened_at,
        settled_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
      ON CONFLICT (market_id) DO UPDATE SET
        opener_address = EXCLUDED.opener_address,
        opener_direction = EXCLUDED.opener_direction,
        pom_profit_bps = EXCLUDED.pom_profit_bps,
        stake = EXCLUDED.stake,
        long_pool = EXCLUDED.long_pool,
        short_pool = EXCLUDED.short_pool,
        join_deadline = EXCLUDED.join_deadline,
        duration_seconds = EXCLUDED.duration_seconds,
        state = EXCLUDED.state,
        entry_price = EXCLUDED.entry_price,
        settlement_price = EXCLUDED.settlement_price,
        outcome = EXCLUDED.outcome,
        transaction_hash = COALESCE(EXCLUDED.transaction_hash, markets.transaction_hash),
        opened_at = EXCLUDED.opened_at,
        settled_at = EXCLUDED.settled_at
    `,
    [
      market.marketId.toString(),
      market.opener.toLowerCase(),
      normalizeDirection(market.openerDirection),
      Number(market.pomProfitBps),
      market.totalUserStaked.toString(),
      market.upPool.toString(),
      market.downPool.toString(),
      Number(market.joiningWindowEnd),
      Number(market.duration),
      normalizeState(market.state),
      market.strikePrice.toString(),
      market.settlementPrice > 0n ? market.settlementPrice.toString() : null,
      normalizeOutcome(market.outcome),
      txHash ?? null,
      toDate(market.openedAt),
      market.settlementTimestamp > 0n ? toDate(market.settlementTimestamp) : null,
    ],
  );
}

async function upsertStake(
  client: PoolClient,
  marketId: bigint,
  participantAddress: string,
  direction: string,
  stakeAmount: bigint,
  txHash?: string | null,
) {
  await client.query(
    `
      INSERT INTO stakes (
        market_id,
        participant_address,
        direction,
        stake_amount,
        claimed,
        transaction_hash
      )
      VALUES ($1,$2,$3,$4,false,$5)
      ON CONFLICT DO NOTHING
    `,
    [marketId.toString(), participantAddress.toLowerCase(), direction, stakeAmount.toString(), txHash ?? null],
  );
}

async function markClaimed(
  client: PoolClient,
  marketId: bigint,
  participantAddress: string,
  payout: bigint,
  txHash?: string | null,
) {
  await client.query(
    `
      UPDATE stakes
      SET claimed = true,
          payout = $3,
          transaction_hash = COALESCE($4, transaction_hash)
      WHERE market_id = $1
        AND lower(participant_address) = lower($2)
    `,
    [marketId.toString(), participantAddress, payout.toString(), txHash ?? null],
  );
}

async function recomputeTraderProfiles(client: PoolClient) {
  const { rows: stakeRows } = await client.query(
    `
      SELECT
        s.market_id,
        s.participant_address,
        s.direction,
        s.stake_amount,
        s.claimed,
        s.payout,
        s.timestamp,
        m.outcome,
        m.state,
        m.opened_at,
        m.settled_at
      FROM stakes s
      JOIN markets m ON m.market_id = s.market_id
      ORDER BY COALESCE(m.settled_at, m.opened_at) ASC, s.timestamp ASC
    `,
  );

  type Aggregate = {
    address: string;
    marketsEntered: number;
    wins: number;
    losses: number;
    draws: number;
    totalStaked: bigint;
    totalClaimed: bigint;
    lastActive: Date | null;
    settledResults: number[];
  };

  const aggregates = new Map<string, Aggregate>();

  const getAggregate = (address: string) => {
    const normalized = address.toLowerCase();
    let aggregate = aggregates.get(normalized);
    if (!aggregate) {
      aggregate = {
        address: normalized,
        marketsEntered: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        totalStaked: 0n,
        totalClaimed: 0n,
        lastActive: null,
        settledResults: [],
      };
      aggregates.set(normalized, aggregate);
    }
    return aggregate;
  };

  for (const row of stakeRows) {
    const aggregate = getAggregate(row.participant_address);
    aggregate.marketsEntered += 1;
    aggregate.totalStaked += BigInt(row.stake_amount || '0');
    aggregate.totalClaimed += BigInt(row.payout || '0');
    aggregate.lastActive = row.settled_at ?? row.opened_at ?? aggregate.lastActive;

    const outcome = row.outcome as string | null;
    const direction = String(row.direction || '').toUpperCase();

    if (!outcome) {
      continue;
    }

    if (outcome === 'Draw') {
      aggregate.draws += 1;
      aggregate.settledResults.push(0);
      continue;
    }

    if (direction === outcome) {
      aggregate.wins += 1;
      aggregate.settledResults.push(1);
    } else {
      aggregate.losses += 1;
      aggregate.settledResults.push(0);
    }
  }

  const scored = Array.from(aggregates.values()).map((aggregate) => {
    const decisiveTrades = aggregate.wins + aggregate.losses;
    const winRate = decisiveTrades > 0 ? aggregate.wins / decisiveTrades : 0;
    const netPnl = aggregate.totalClaimed - aggregate.totalStaked;
    return {
      ...aggregate,
      winRate,
      netPnl,
    };
  });

  const maxPositivePnl = scored.reduce(
    (max, trader) => (trader.netPnl > max ? trader.netPnl : max),
    0n,
  );

  const ranked = scored
    .map((trader) => {
      const normalizedPnl =
        maxPositivePnl > 0n && trader.netPnl > 0n
          ? Number(trader.netPnl) / Number(maxPositivePnl)
          : 0;
      const compositeScore = winRateComposite(trader.winRate, normalizedPnl, trader.settledResults);
      return {
        ...trader,
        compositeScore,
      };
    })
    .sort((a, b) => b.compositeScore - a.compositeScore);

  const totalRanked = ranked.length;

  for (const [index, trader] of ranked.entries()) {
    const rank = index + 1;
    const tier = determineTier(rank, totalRanked, trader.marketsEntered);
    await client.query(
      `
        UPDATE traders
        SET
          markets_entered = $2,
          wins = $3,
          losses = $4,
          draws = $5,
          total_staked = $6,
          total_claimed = $7,
          composite_score = $8,
          tier = $9,
          last_active = $10
        WHERE lower(address) = lower($1)
      `,
      [
        trader.address,
        trader.marketsEntered,
        trader.wins,
        trader.losses,
        trader.draws,
        trader.totalStaked.toString(),
        trader.totalClaimed.toString(),
        trader.compositeScore.toString(),
        tier,
        trader.lastActive,
      ],
    );
  }
}

function winRateComposite(winRate: number, normalizedPnl: number, results: number[]) {
  const consistency = calculateConsistencyScore(results);
  return winRate * 0.4 + normalizedPnl * 0.4 + consistency * 0.2;
}

function calculateConsistencyScore(results: number[]) {
  if (results.length <= 1) return 1;
  const rollingRates: number[] = [];
  for (let i = 0; i < results.length; i += 1) {
    const window = results.slice(Math.max(0, i - 6), i + 1);
    const avg = window.reduce((sum, value) => sum + value, 0) / window.length;
    rollingRates.push(avg);
  }
  const mean = rollingRates.reduce((sum, value) => sum + value, 0) / rollingRates.length;
  const variance =
    rollingRates.reduce((sum, value) => sum + (value - mean) ** 2, 0) / rollingRates.length;
  return Math.max(0, Math.min(1, 1 - Math.sqrt(variance)));
}

function determineTier(rank: number, totalRanked: number, settledMarkets: number) {
  if (totalRanked === 0) return 'SCOUT';
  const oracleCutoff = Math.max(1, Math.ceil(totalRanked * 0.01));
  const prophetCutoff = Math.max(1, Math.ceil(totalRanked * 0.05));
  const traderCutoff = Math.max(1, Math.ceil(totalRanked * 0.2));
  if (settledMarkets >= 3 && rank <= oracleCutoff) return 'ORACLE';
  if (settledMarkets >= 2 && rank <= prophetCutoff) return 'PROPHET';
  if (settledMarkets >= 1 && rank <= traderCutoff) return 'TRADER';
  return 'SCOUT';
}

async function processLogs(fromBlock: bigint, toBlock: bigint) {
  if (!PREDICTION_MARKET_ADDRESS) {
    throw new Error('Missing PREDICTION_MARKET_ADDRESS');
  }

  // Collect logs from market contract (and optionally adapter).
  const addresses: `0x${string}`[] = [PREDICTION_MARKET_ADDRESS as `0x${string}`];
  if (PRICE_ADAPTER_ADDRESS) {
    addresses.push(PRICE_ADAPTER_ADDRESS as `0x${string}`);
  }

  const logs = await publicClient.getLogs({
    address: addresses.length === 1 ? addresses[0] : addresses,
    fromBlock,
    toBlock,
  });

  if (logs.length === 0) {
    return;
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    for (const log of logs) {
      let decoded;
      try {
        decoded = decodeEventLog({
          abi: MARKET_ABI,
          topics: log.topics,
          data: log.data,
          strict: false,
        });
      } catch (error) {
        // Skip logs that don't match any event in the ABI
        continue;
      }

      if (!decoded.eventName) {
        continue;
      }

      if (decoded.eventName === 'MarketOpened') {
        const marketId = decoded.args.marketId as bigint;
        const opener = getAddress(String(decoded.args.opener));
        const market = await readMarket(marketId);
        await ensureTrader(client, opener);
        await upsertMarket(client, market, log.transactionHash);
        await upsertStake(
          client,
          marketId,
          opener,
          normalizeDirection(Number(decoded.args.direction)),
          decoded.args.stakeAmount as bigint,
          log.transactionHash,
        );
        continue;
      }

      if (decoded.eventName === 'MarketJoined') {
        const marketId = decoded.args.marketId as bigint;
        const participant = getAddress(String(decoded.args.participant));
        const market = await readMarket(marketId);
        await ensureTrader(client, participant);
        await upsertMarket(client, market, log.transactionHash);
        await upsertStake(
          client,
          marketId,
          participant,
          normalizeDirection(Number(decoded.args.direction)),
          decoded.args.stakeAmount as bigint,
          log.transactionHash,
        );
        continue;
      }

      if (
        decoded.eventName === 'MarketLocked'
        || decoded.eventName === 'MarketSettled'
      ) {
        const marketId = decoded.args.marketId as bigint;
        const market = await readMarket(marketId);
        await upsertMarket(client, market, log.transactionHash);
        continue;
      }

      if (decoded.eventName === 'MarketClaimed') {
        const marketId = decoded.args.marketId as bigint;
        const participant = getAddress(String(decoded.args.participant));
        const market = await readMarket(marketId);
        await upsertMarket(client, market, log.transactionHash);
        await markClaimed(
          client,
          marketId,
          participant,
          decoded.args.payout as bigint,
          log.transactionHash,
        );
        continue;
      }

      // V2: index adapter price rounds for operator visibility.
      if (decoded.eventName === 'PricePosted') {
        // No DB write needed for MVP — log for observability only.
        const args = decoded.args as Record<string, unknown>;
        console.log(`[Indexer] PricePosted round=${args['roundId']} price=${args['price']} ts=${args['timestamp']}`);
      }
    }

    await recomputeTraderProfiles(client);
    await client.query('COMMIT');

    // Notify listeners (gateway) that the DB has been updated.
    await client.query('NOTIFY bitdrum_update');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function syncLoop() {
  const state = await loadState();
  let lastProcessedBlock = BigInt(state.lastProcessedBlock || START_BLOCK.toString());

  console.log(`[Indexer] Starting Bot Chain projector from block ${lastProcessedBlock.toString()}`);

  while (true) {
    try {
      const latestBlock = await publicClient.getBlockNumber();

      if (latestBlock <= lastProcessedBlock) {
        await sleep(POLL_INTERVAL_MS);
        continue;
      }

      const nextToBlock =
        latestBlock - lastProcessedBlock > BLOCK_BATCH_SIZE
          ? lastProcessedBlock + BLOCK_BATCH_SIZE
          : latestBlock;
      const fromBlock = lastProcessedBlock + 1n;

      console.log(`[Indexer] Syncing blocks ${fromBlock.toString()} -> ${nextToBlock.toString()}`);
      await processLogs(fromBlock, nextToBlock);
      lastProcessedBlock = nextToBlock;
      await saveState({ lastProcessedBlock: lastProcessedBlock.toString() });
    } catch (error) {
      console.error('[Indexer] Sync failure:', error);
      await sleep(POLL_INTERVAL_MS);
    }
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

syncLoop().catch((error) => {
  console.error('[Indexer] Fatal error:', error);
  process.exit(1);
});
