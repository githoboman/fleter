import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { BOTREM_MAINNET_ADDRESSES, PredictionMarketV2ABI } from '../lib/botrem/contracts';
import { parseUnits } from 'viem';

export function useBotremTrade() {
  const { writeContractAsync, data: hash, isPending } = useWriteContract();

  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash,
  });

  const openMarket = async (direction: 0 | 1, amountInBOT: string, durationSeconds: 60 | 300) => {
    try {
      const stakeAmount = parseUnits(amountInBOT, 18); // STT has 18 decimals
      return await writeContractAsync({
        address: BOTREM_MAINNET_ADDRESSES.PredictionMarketV2 as `0x${string}`,
        abi: PredictionMarketV2ABI as any,
        functionName: 'openMarket',
        args: [direction, stakeAmount, BigInt(durationSeconds)],
      });
    } catch (e) {
      console.error('Failed to open market:', e);
      throw e;
    }
  };

  const joinMarket = async (marketId: bigint, amountInBOT: string) => {
    try {
      const stakeAmount = parseUnits(amountInBOT, 18);
      return await writeContractAsync({
        address: BOTREM_MAINNET_ADDRESSES.PredictionMarketV2 as `0x${string}`,
        abi: PredictionMarketV2ABI as any,
        functionName: 'joinMarket',
        args: [marketId, stakeAmount],
      });
    } catch (e) {
      console.error('Failed to join market:', e);
      throw e;
    }
  };

  const claimPayout = async (marketId: bigint) => {
    try {
      return await writeContractAsync({
        address: BOTREM_MAINNET_ADDRESSES.PredictionMarketV2 as `0x${string}`,
        abi: PredictionMarketV2ABI as any,
        functionName: 'claimPayout',
        args: [marketId],
      });
    } catch (e) {
      console.error('Failed to claim payout:', e);
      throw e;
    }
  };

  return {
    openMarket,
    joinMarket,
    claimPayout,
    isPending,
    isConfirming,
    isConfirmed,
    hash,
  };
}
