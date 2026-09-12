'use client';
import { useQuery } from '@tanstack/react-query';
import type { Address } from 'viem';
import { readCollateralBalance, readGasBalance } from '../lib/dreamdex/trade';

export const COLLATERAL_BALANCE_KEY = 'dream-collateral';

export function useCollateralBalance(address: string | null | undefined) {
  const query = useQuery({
    queryKey: [COLLATERAL_BALANCE_KEY, address?.toLowerCase() ?? null],
    queryFn: async () => {
      const [collateral, gas] = await Promise.all([
        readCollateralBalance(address as Address),
        readGasBalance(address as Address),
      ]);
      return { collateral, gas };
    },
    enabled: Boolean(address),
    refetchInterval: 5_000,
  });
  return {
    balance: query.data?.collateral ?? null,
    /** Native STT; 0 means the node will reject any tx with "account does not exist". */
    gas: query.data?.gas ?? null,
    refetch: query.refetch,
  };
}
