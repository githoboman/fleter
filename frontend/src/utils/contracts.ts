/**
 * Direct contract reads via viem multicall.
 *
 * Hot-path data (market state, pool sizes, claimability) is read here
 * instead of going through the gateway. This cuts a full round-trip and
 * removes gateway load for the most latency-sensitive operations.
 *
 * Gateway still serves AI signals, leaderboard, and social feed.
 */

import { createPublicClient, defineChain, http, type PublicClient } from 'viem';
import {
  ACTIVE_SOMNIA_NETWORK,
  PREDICTION_MARKET_ADDRESS,
} from './somnia';

const GET_MARKET_ABI = [
  {
    name: 'getMarket',
    type: 'function',
    inputs: [{ name: 'marketId', type: 'uint256' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'marketId', type: 'uint256' },
          { name: 'opener', type: 'address' },
          { name: 'openerDirection', type: 'uint8' },
          { name: 'duration', type: 'uint256' },
          { name: 'openedAt', type: 'uint256' },
          { name: 'joiningWindowEnd', type: 'uint256' },
          { name: 'expiryAt', type: 'uint256' },
          { name: 'strikePrice', type: 'uint128' },
          { name: 'settlementPrice', type: 'uint128' },
          { name: 'strikeTimestamp', type: 'uint128' },
          { name: 'settlementTimestamp', type: 'uint128' },
          { name: 'pomProfitBps', type: 'uint256' },
          { name: 'upPool', type: 'uint256' },
          { name: 'downPool', type: 'uint256' },
          { name: 'totalUserStaked', type: 'uint256' },
          { name: 'vaultCommitted', type: 'uint256' },
          { name: 'feeAmount', type: 'uint256' },
          { name: 'sweptToVault', type: 'uint256' },
          { name: 'participantCount', type: 'uint256' },
          { name: 'claimedCount', type: 'uint256' },
          { name: 'state', type: 'uint8' },
          { name: 'outcome', type: 'uint8' },
        ],
      },
    ],
    stateMutability: 'view',
  },
] as const;

const NEXT_MARKET_ID_ABI = [
  {
    name: 'nextMarketId',
    type: 'function',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
] as const;

function buildChain() {
  return defineChain({
    id: ACTIVE_SOMNIA_NETWORK.chainId,
    name: ACTIVE_SOMNIA_NETWORK.chainName,
    nativeCurrency: ACTIVE_SOMNIA_NETWORK.nativeCurrency,
    rpcUrls: {
      default: { http: ACTIVE_SOMNIA_NETWORK.rpcUrls as string[] },
      public: { http: ACTIVE_SOMNIA_NETWORK.rpcUrls as string[] },
    },
    contracts: {
      multicall3: { address: ACTIVE_SOMNIA_NETWORK.multicall3Address },
    },
  });
}

let _publicClient: PublicClient | null = null;

function getPublicClient(): PublicClient {
  if (!_publicClient) {
    _publicClient = createPublicClient({
      chain: buildChain(),
      transport: http(ACTIVE_SOMNIA_NETWORK.rpcUrls[0]),
    });
  }
  return _publicClient;
}

const STATE_MAP: Record<number, string> = {
  0: 'NONE',
  1: 'OPEN',
  2: 'LOCKED',
  3: 'CLAIMABLE',
  4: 'CLOSED',
};
const DIRECTION_MAP: Record<number, string> = { 0: 'UP', 1: 'DOWN' };
const OUTCOME_MAP: Record<number, string | null> = {
  0: null,
  1: 'UP',
  2: 'DOWN',
  3: 'Draw',
};

export type OnchainMarket = {
  id: string;
  state: string;
  direction: string;
  up_pool: string;
  down_pool: string;
  entry_price: string;
  settlement_price: string | null;
  pom_profit_bps: number;
  outcome: string | null;
  join_deadline: number;
  settlement_deadline: number;
  opened_at: number;
  duration_seconds: number;
  participant_count: number;
};

/**
 * Read a single market's live state directly from the contract.
 * Use this in the TradePanel join flow so pool sizes are always fresh
 * without a gateway round-trip.
 */
export async function readMarketOnchain(marketId: string): Promise<OnchainMarket> {
  const client = getPublicClient();

  const m = await client.readContract({
    address: PREDICTION_MARKET_ADDRESS as `0x${string}`,
    abi: GET_MARKET_ABI,
    functionName: 'getMarket',
    args: [BigInt(marketId)],
  });

  return {
    id: m.marketId.toString(),
    state: STATE_MAP[m.state] ?? 'NONE',
    direction: DIRECTION_MAP[m.openerDirection] ?? 'UP',
    up_pool: m.upPool.toString(),
    down_pool: m.downPool.toString(),
    entry_price: m.strikePrice.toString(),
    settlement_price: m.settlementPrice > 0n ? m.settlementPrice.toString() : null,
    pom_profit_bps: Number(m.pomProfitBps),
    outcome: OUTCOME_MAP[m.outcome] ?? null,
    join_deadline: Number(m.joiningWindowEnd),
    settlement_deadline: Number(m.expiryAt),
    opened_at: Number(m.openedAt),
    duration_seconds: Number(m.duration),
    participant_count: Number(m.participantCount),
  };
}

/**
 * Read multiple markets in a single multicall round-trip.
 */
export async function readMarketsOnchain(marketIds: string[]): Promise<OnchainMarket[]> {
  if (marketIds.length === 0) return [];

  const client = getPublicClient();
  const address = PREDICTION_MARKET_ADDRESS as `0x${string}`;

  const results = await client.multicall({
    contracts: marketIds.map((id) => ({
      address,
      abi: GET_MARKET_ABI,
      functionName: 'getMarket' as const,
      args: [BigInt(id)] as [bigint],
    })),
    allowFailure: true,
  });

  return results.flatMap((result, i) => {
    if (result.status !== 'success') return [];
    const m = result.result as Awaited<ReturnType<typeof readMarketOnchain>> extends Promise<infer R> ? never : any;
    return [
      {
        id: m.marketId.toString(),
        state: STATE_MAP[m.state] ?? 'NONE',
        direction: DIRECTION_MAP[m.openerDirection] ?? 'UP',
        up_pool: m.upPool.toString(),
        down_pool: m.downPool.toString(),
        entry_price: m.strikePrice.toString(),
        settlement_price: m.settlementPrice > 0n ? m.settlementPrice.toString() : null,
        pom_profit_bps: Number(m.pomProfitBps),
        outcome: OUTCOME_MAP[m.outcome] ?? null,
        join_deadline: Number(m.joiningWindowEnd),
        settlement_deadline: Number(m.expiryAt),
        opened_at: Number(m.openedAt),
        duration_seconds: Number(m.duration),
        participant_count: Number(m.participantCount),
      } satisfies OnchainMarket,
    ];
  });
}

/**
 * Read the user's native STT balance.
 */
export async function readSttBalance(address: `0x${string}`): Promise<bigint> {
  const client = getPublicClient();
  return client.getBalance({ address });
}

/**
 * Read market state + user native STT balance in parallel.
 * Used by TradePanel to update pool sizes and balance before execution.
 */
export async function readMarketAndBalance(
  marketId: string,
  userAddress: `0x${string}`,
): Promise<{ market: OnchainMarket; wbtcBalance: bigint }> {
  const client = getPublicClient();

  const [m, sttBalance] = await Promise.all([
    client.readContract({
      address: PREDICTION_MARKET_ADDRESS as `0x${string}`,
      abi: GET_MARKET_ABI,
      functionName: 'getMarket',
      args: [BigInt(marketId)],
    }),
    client.getBalance({ address: userAddress }),
  ]);

  return {
    market: {
      id: (m as any).marketId.toString(),
      state: STATE_MAP[(m as any).state] ?? 'NONE',
      direction: DIRECTION_MAP[(m as any).openerDirection] ?? 'UP',
      up_pool: (m as any).upPool.toString(),
      down_pool: (m as any).downPool.toString(),
      entry_price: (m as any).strikePrice.toString(),
      settlement_price: (m as any).settlementPrice > 0n ? (m as any).settlementPrice.toString() : null,
      pom_profit_bps: Number((m as any).pomProfitBps),
      outcome: OUTCOME_MAP[(m as any).outcome] ?? null,
      join_deadline: Number((m as any).joiningWindowEnd),
      settlement_deadline: Number((m as any).expiryAt),
      opened_at: Number((m as any).openedAt),
      duration_seconds: Number((m as any).duration),
      participant_count: Number((m as any).participantCount),
    },
    wbtcBalance: sttBalance,
  };
}
