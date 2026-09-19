import PredictionMarketV2ABI from './PredictionMarketV2.abi.json';
import LiquidityVaultV2ABI from './LiquidityVaultV2.abi.json';

export const BOTREM_MAINNET_ADDRESSES = {
  BitdrumPriceAdapter: '0x833E8336d77F7Da45c155e6df4E5c72391073E6c',
  LiquidityVaultV2: '0x042D0fb514f9753980055B34f210e7b19CB5AAF8',
  TreasuryV2: '0x0aeeC511e30c7271ded720f17206c85F2F9EeFe7',
  LeaderboardRegistry: '0x90C70e356540C8b53Bb5cd0BA35B8f2779c9a10c',
  PredictionMarketV2: '0x86f62D80fbdD194fAb3ABFC86C676cF5C4411A9D',
  SettlementEngineV2: '0x17841E7c35FC5e2117f0a3344A3326B31e51dAfE',
} as const;

export { PredictionMarketV2ABI, LiquidityVaultV2ABI };
