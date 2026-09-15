export const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";
export const WS_URL =
  process.env.NEXT_PUBLIC_WS_URL || API_BASE.replace(/^http/, "ws").replace(/\/api$/, "/ws");

export const BOTCHAIN_MAINNET = {
  chainId: 5031,
  chainIdHex: "0x13a7",
  chainName: "Bot Chain",
  nativeCurrency: { name: "SOMI", symbol: "SOMI", decimals: 18 },
  rpcUrls: ["https://api.infra.mainnet.somnia.network"],
  blockExplorerUrls: ["https://explorer.somnia.network"],
  /** Multicall3 deployed address on Bot Chain Mainnet */
  multicall3Address: "0x5e44F178E8cF9B2F5409B6f18ce936aB817C5a11" as `0x${string}`,
};

export const BOTCHAIN_SHANNON = {
  chainId: 50312,
  chainIdHex: "0xc488",
  chainName: "Bot Chain Testnet",
  nativeCurrency: { name: "STT", symbol: "STT", decimals: 18 },
  rpcUrls: ["https://dream-rpc.somnia.network"],
  blockExplorerUrls: ["https://shannon-explorer.somnia.network"],
  /** Multicall3 deployed address on Bot Chain Testnet testnet */
  multicall3Address: "0x841b8199E6d3Db3C6f264f6C2bd8848b3cA64223" as `0x${string}`,
};

export const ACTIVE_BOTCHAIN_NETWORK =
  process.env.NEXT_PUBLIC_CHAIN_ID === String(BOTCHAIN_MAINNET.chainId)
    ? BOTCHAIN_MAINNET
    : BOTCHAIN_SHANNON;

export const PREDICTION_MARKET_ADDRESS =
  process.env.NEXT_PUBLIC_PREDICTION_MARKET_ADDR || "0x0000000000000000000000000000000000000000";

export const BOTCHAIN_EXPLORER_BASE_URL =
  ACTIVE_BOTCHAIN_NETWORK.blockExplorerUrls[0] || "https://shannon-explorer.somnia.network";
