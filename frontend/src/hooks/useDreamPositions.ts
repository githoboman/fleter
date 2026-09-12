'use client';
import { useQuery } from '@tanstack/react-query';
import type { Address } from 'viem';
import { fetchPositions } from '../lib/dreamdex/positions';

export const DREAM_POSITIONS_KEY = 'dream-positions';

export function useDreamPositions(address: string | null | undefined) {
  const query = useQuery({
    queryKey: [DREAM_POSITIONS_KEY, address?.toLowerCase() ?? null],
    queryFn: () => fetchPositions(address as Address),
    enabled: Boolean(address),
    refetchInterval: 5_000,
    staleTime: 2_000,
  });
  return {
    positions: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error instanceof Error ? query.error.message : null,
    refetch: query.refetch,
  };
}
