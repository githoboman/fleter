import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { BOTREM_MAINNET_ADDRESSES, PredictionMarketV2ABI } from '../lib/botrem/contracts';
import { parseUnits } from 'viem';

export function useBotremTrade() {
  const { writeContractAsync, data: hash, isPending } = useWriteContract();

  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash,
  });

  /**
   * openMarket(direction: uint8, duration: uint256) payable
   * The stake is sent as native BOT via msg.value
   */
  const openMarket = async (direction: 0 | 1, amountInBOT: string, durationSeconds: 60 | 300) => {
    try {
      const stakeValue = parseUnits(amountInBOT, 18); // native BOT, 18 decimals
      return await writeContractAsync({
        address: BOTREM_MAINNET_ADDRESSES.PredictionMarketV2 as `0x${string}`,
        abi: PredictionMarketV2ABI as any,
        functionName: 'openMarket',
        args: [direction, BigInt(durationSeconds)], // 2 args only
        value: stakeValue,                          // stake via msg.value
      });
    } catch (e) {
      console.error('Failed to open market:', e);
      throw e;
    }
  };

  /**
   * joinMarket(marketId: uint256, direction: uint8) payable
   * The stake is sent as native BOT via msg.value
   */
  const joinMarket = async (marketId: bigint, direction: 0 | 1, amountInBOT: string) => {
    try {
      const stakeValue = parseUnits(amountInBOT, 18);
      return await writeContractAsync({
        address: BOTREM_MAINNET_ADDRESSES.PredictionMarketV2 as `0x${string}`,
        abi: PredictionMarketV2ABI as any,
        functionName: 'joinMarket',
        args: [marketId, direction], // 2 args: marketId + direction
        value: stakeValue,           // stake via msg.value
      });
    } catch (e) {
      console.error('Failed to join market:', e);
      throw e;
    }
  };

  /**
   * claimPayout(marketId: uint256) nonpayable
   */
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
