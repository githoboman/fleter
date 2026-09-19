import { useReadContract, useReadContracts, useAccount } from 'wagmi';
import { BOTREM_MAINNET_ADDRESSES, PredictionMarketV2ABI } from '../lib/botrem/contracts';

export type Direction = 0 | 1; // 0: UP, 1: DOWN
export type MarketState = 0 | 1 | 2; // 0: OPEN, 1: LOCKED, 2: SETTLED

export interface Market {
  id: bigint;
  opener: `0x${string}`;
  direction: Direction;
  totalStake: bigint;
  vaultStake: bigint;
  strikePrice: bigint;
  settlementPrice: bigint;
  openTime: bigint;
  duration: bigint;
  payoutBps: bigint;
  state: MarketState;
}

export function useBotremMarkets() {
  const { address } = useAccount();

  // Fetch the latest market ID
  const { data: nextMarketId } = useReadContract({
    address: BOTREM_MAINNET_ADDRESSES.PredictionMarketV2,
    abi: PredictionMarketV2ABI as any,
    functionName: 'nextMarketId',
    query: { refetchInterval: 30_000 },
  });

  // Calculate the range of markets to fetch (last 10)
  const currentId = nextMarketId ? Number(nextMarketId) : 0;
  const startIndex = Math.max(0, currentId - 10);
  const marketIds = Array.from({ length: currentId - startIndex }, (_, i) => BigInt(startIndex + i)).reverse();

  // Fetch the markets using Multicall
  const { data: marketsData, isLoading } = useReadContracts({
    contracts: marketIds.map(id => ({
      address: BOTREM_MAINNET_ADDRESSES.PredictionMarketV2,
      abi: PredictionMarketV2ABI as any,
      functionName: 'getMarket',
      args: [id],
    })),
    query: { refetchInterval: 30_000 },
  });

  const markets = marketsData
    ?.map((result, i) => {
      if (result.status === 'success' && result.result) {
        return {
          id: marketIds[i],
          ...(result.result as Omit<Market, 'id'>),
        } as Market;
      }
      return null;
    })
    .filter(Boolean) as Market[] | undefined;

  // Fetch user positions for these markets
  const { data: positionsData } = useReadContracts({
    contracts: marketIds.map(id => ({
      address: BOTREM_MAINNET_ADDRESSES.PredictionMarketV2,
      abi: PredictionMarketV2ABI as any,
      functionName: 'getStakeRecord',
      args: [id, address || '0x0000000000000000000000000000000000000000'],
    })),
    query: {
      refetchInterval: 30_000,
      enabled: !!address && marketIds.length > 0,
    }
  });

  const positions = positionsData?.map((res, i) => ({
    marketId: marketIds[i],
    record: res.status === 'success' ? res.result : null,
  }));

  return {
    markets: markets || [],
    positions: positions || [],
    isLoading,
  };
}
