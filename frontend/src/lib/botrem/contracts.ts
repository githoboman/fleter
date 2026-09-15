import PredictionMarketV2ABI from './PredictionMarketV2.abi.json';
import LiquidityVaultV2ABI from './LiquidityVaultV2.abi.json';

export const BOTREM_TESTNET_ADDRESSES = {
  BitdrumPriceAdapter: '0xA21706591876338155BC49E72902F0c8A1d3Ce74',
  LiquidityVaultV2: '0x0468bBF96D4CAF5f62360b92357753344c83724b',
  TreasuryV2: '0x2fFfBC6FE555da5d83FF31be54425FE05Bb085a4',
  LeaderboardRegistry: '0xa5f71Bf0227b97ffd23E7B85813dc412AAc29B50',
  PredictionMarketV2: '0x5360001E9249c0F4AD7F9E1C86b54C3c33d89348',
  SettlementEngineV2: '0xC9D070fBBa7c067ED93616Ea006f1aFCa074a397',
} as const;

export { PredictionMarketV2ABI, LiquidityVaultV2ABI };
