import {
  createPublicClient,
  createWalletClient,
  custom,
  formatUnits,
  http,
  parseUnits,
  defineChain,
  type WalletClient,
  type PublicClient,
} from 'viem';
import {
  ACTIVE_SOMNIA_NETWORK,
  PREDICTION_MARKET_ADDRESS,
  SOMNIA_EXPLORER_BASE_URL,
} from './somnia';

type Eip1193Provider = {
  request(args: { method: string; params?: unknown[] | object }): Promise<unknown>;
  on?(event: string, handler: (...args: unknown[]) => void): void;
  isMetaMask?: boolean;
  isKeplr?: boolean;
  providers?: Eip1193Provider[];
};

declare global {
  interface Window {
    ethereum?: Eip1193Provider;
  }
}

/**
 * Several extensions (MetaMask, Keplr, Rabby, …) each inject a provider and
 * fight over `window.ethereum`. Prefer MetaMask when it is present; a locked
 * Keplr otherwise throws "KeyRing is locked" before we can even ask for accounts.
 */
export function pickInjectedProvider(): Eip1193Provider | undefined {
  const root = window.ethereum;
  if (!root) return undefined;
  const candidates = root.providers?.length ? root.providers : [root];
  return candidates.find((p) => p.isMetaMask && !p.isKeplr) ?? candidates.find((p) => !p.isKeplr) ?? root;
}

/** Native STT uses 18 decimals. */
export const STT_DECIMALS = 18;

const MARKET_ABI = [
  {
    name: 'openMarket',
    type: 'function',
    inputs: [
      { name: 'direction', type: 'uint8' },
      { name: 'duration', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'payable',
  },
  {
    name: 'joinMarket',
    type: 'function',
    inputs: [
      { name: 'marketId', type: 'uint256' },
      { name: 'direction', type: 'uint8' },
    ],
    outputs: [],
    stateMutability: 'payable',
  },
  {
    name: 'claimPayout',
    type: 'function',
    inputs: [{ name: 'marketId', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
] as const;

export type BitdrumDirection = 'UP' | 'DOWN';
export type TradeExecutionStatus = 'submitted' | 'confirmed' | 'failed';

export type TradeExecutionRecord = {
  id: string;
  kind: 'OPEN' | 'JOIN' | 'CLAIM';
  marketId: string | null;
  direction: BitdrumDirection;
  stake: string;
  timeframeSeconds: number;
  entryPrice: number | null;
  txHash: string;
  explorerUrl: string;
  status: TradeExecutionStatus;
  submittedAt: string;
  timestamp: number;
  error: string | null;
};

export type MarketRecord = {
  id: string;
  state: string;
  direction?: string;
  entry_price?: string | null;
  settlement_price?: string | null;
  up_pool?: string;
  down_pool?: string;
  long_pool?: string;
  short_pool?: string;
  pom_profit_bps?: number | null;
  outcome?: string | null;
  join_deadline?: number | null;
  opened_at?: string | null;
  duration_seconds?: number | null;
  settlement_deadline?: number | null;
  signal?: {
    direction: string;
    confidence: number;
    rationale: string;
  } | null;
};

export type PositionRecord = {
  market_id: string;
  direction: string;
  stake_amount: string;
  claimed: boolean;
  payout: string | null;
  transaction_hash?: string | null;
  expected_payout: string;
  net_pnl: string;
  state: string;
  entry_price: string | null;
  settlement_price: string | null;
  outcome: string | null;
  duration_seconds: number | null;
  join_deadline: number | null;
  settlement_deadline: number | null;
  opened_at: string | null;
  settled_at: string | null;
  status: string;
  can_claim: boolean;
};

export function normalizeUnixTimestamp(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null;

  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value <= 0) return null;
    return value > 1_000_000_000_000 ? Math.floor(value / 1000) : Math.floor(value);
  }

  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric > 0) {
    return normalizeUnixTimestamp(numeric);
  }

  const parsed = Date.parse(value);
  if (Number.isNaN(parsed) || parsed <= 0) return null;
  return Math.floor(parsed / 1000);
}

export function toIsoFromTimestamp(value: string | number | null | undefined): string | null {
  const seconds = normalizeUnixTimestamp(value);
  return seconds ? new Date(seconds * 1000).toISOString() : null;
}

export function isResolvedPositionStatus(status: string | null | undefined) {
  const normalized = String(status || '').toUpperCase();
  return normalized === 'WIN' || normalized === 'LOSS' || normalized === 'DRAW';
}

export function formatUsdPriceLabel(value: string | number | null | undefined) {
  const numeric =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? formatOraclePrice(value)
        : null;

  if (numeric === null || numeric === undefined || Number.isNaN(numeric)) {
    return '--';
  }

  return `$${numeric.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export type BitdrumWallet = {
  address: `0x${string}`;
  walletClient: WalletClient;
  publicClient: PublicClient;
  label: string;
  disconnect(): Promise<void>;
  openProfile(): Promise<void>;
};

type BitdrumTx = {
  hash: string;
  explorerUrl: string;
  wait(): Promise<unknown>;
};

function directionToEnum(direction: BitdrumDirection): number {
  return direction === 'UP' ? 0 : 1;
}

function buildSomniaChain() {
  return defineChain({
    id: ACTIVE_SOMNIA_NETWORK.chainId,
    name: ACTIVE_SOMNIA_NETWORK.chainName,
    nativeCurrency: ACTIVE_SOMNIA_NETWORK.nativeCurrency,
    rpcUrls: {
      default: { http: ACTIVE_SOMNIA_NETWORK.rpcUrls as string[] },
      public: { http: ACTIVE_SOMNIA_NETWORK.rpcUrls as string[] },
    },
    blockExplorers: {
      default: { name: 'Somnia Explorer', url: ACTIVE_SOMNIA_NETWORK.blockExplorerUrls[0] },
    },
    contracts: {
      multicall3: { address: ACTIVE_SOMNIA_NETWORK.multicall3Address },
    },
  });
}

async function ensureSomniaChain(walletClient: WalletClient) {
  const chainId = await walletClient.getChainId();
  if (chainId === ACTIVE_SOMNIA_NETWORK.chainId) return;

  try {
    await walletClient.switchChain({ id: ACTIVE_SOMNIA_NETWORK.chainId });
  } catch {
    await pickInjectedProvider()!.request({
      method: 'wallet_addEthereumChain',
      params: [ACTIVE_SOMNIA_NETWORK],
    });
  }
}

function assertWalletSupport() {
  if (!window.ethereum) {
    throw new Error('No EVM wallet detected. Install MetaMask or another Somnia-compatible wallet.');
  }
}

function buildExplorerUrl(txHash: string) {
  return `${SOMNIA_EXPLORER_BASE_URL}/tx/${txHash}`;
}

export async function connectBitdrumWallet(): Promise<BitdrumWallet> {
  assertWalletSupport();

  const chain = buildSomniaChain();

  const walletClient = createWalletClient({
    chain,
    transport: custom(pickInjectedProvider()!),
  });

  const publicClient = createPublicClient({
    chain,
    transport: http(ACTIVE_SOMNIA_NETWORK.rpcUrls[0]),
  });

  await ensureSomniaChain(walletClient);

  const [address] = await walletClient.requestAddresses();

  if (!address) {
    throw new Error('Wallet connection did not return an account.');
  }

  return {
    address,
    walletClient,
    publicClient,
    label: 'Injected EVM Wallet',
    async disconnect() {
      return;
    },
    async openProfile() {
      window.open(`${SOMNIA_EXPLORER_BASE_URL}/address/${address}`, '_blank', 'noopener,noreferrer');
    },
  };
}

export async function openMarket(params: {
  wallet: BitdrumWallet;
  direction: BitdrumDirection;
  stake: string;
  durationSeconds: number;
}): Promise<BitdrumTx> {
  const amount = parseUnits(params.stake, STT_DECIMALS);
  const chain = buildSomniaChain();

  const sttBalance = await params.wallet.publicClient.getBalance({ address: params.wallet.address });
  if (sttBalance < amount) {
    throw new Error(
      `Insufficient STT. Need ${formatUnits(amount, STT_DECIMALS)} STT but only have ${formatUnits(sttBalance, STT_DECIMALS)} STT.`,
    );
  }

  const hash = await params.wallet.walletClient.writeContract({
    address: PREDICTION_MARKET_ADDRESS as `0x${string}`,
    abi: MARKET_ABI,
    functionName: 'openMarket',
    args: [
      directionToEnum(params.direction),
      BigInt(params.durationSeconds),
    ],
    value: amount,
    account: params.wallet.address,
    chain,
  });

  return {
    hash,
    explorerUrl: buildExplorerUrl(hash),
    wait: () => params.wallet.publicClient.waitForTransactionReceipt({ hash }),
  };
}

export async function joinMarket(params: {
  wallet: BitdrumWallet;
  marketId: string;
  direction: BitdrumDirection;
  stake: string;
}): Promise<BitdrumTx> {
  const amount = parseUnits(params.stake, STT_DECIMALS);
  const chain = buildSomniaChain();

  const sttBalance = await params.wallet.publicClient.getBalance({ address: params.wallet.address });
  if (sttBalance < amount) {
    throw new Error(
      `Insufficient STT. Need ${formatUnits(amount, STT_DECIMALS)} STT but only have ${formatUnits(sttBalance, STT_DECIMALS)} STT.`,
    );
  }

  const hash = await params.wallet.walletClient.writeContract({
    address: PREDICTION_MARKET_ADDRESS as `0x${string}`,
    abi: MARKET_ABI,
    functionName: 'joinMarket',
    args: [BigInt(params.marketId), directionToEnum(params.direction)],
    value: amount,
    account: params.wallet.address,
    chain,
  });

  return {
    hash,
    explorerUrl: buildExplorerUrl(hash),
    wait: () => params.wallet.publicClient.waitForTransactionReceipt({ hash }),
  };
}

export async function claimMarket(params: {
  wallet: BitdrumWallet;
  marketId: string;
}): Promise<BitdrumTx> {
  const chain = buildSomniaChain();

  const hash = await params.wallet.walletClient.writeContract({
    address: PREDICTION_MARKET_ADDRESS as `0x${string}`,
    abi: MARKET_ABI,
    functionName: 'claimPayout',
    args: [BigInt(params.marketId)],
    account: params.wallet.address,
    chain,
  });

  return {
    hash,
    explorerUrl: buildExplorerUrl(hash),
    wait: () => params.wallet.publicClient.waitForTransactionReceipt({ hash }),
  };
}

/**
 * Format a raw token amount (in wei, 18 decimals) to a human-readable string.
 */
export function formatTokenAmount(
  rawAmount: string | bigint | null | undefined,
  decimals = STT_DECIMALS,
  precision = 4,
) {
  if (typeof rawAmount === 'string' && rawAmount.includes('.')) {
    const numeric = Number(rawAmount);
    if (!Number.isFinite(numeric)) return '0';
    return numeric.toFixed(precision).replace(/\.?0+$/, '');
  }

  const normalized = typeof rawAmount === 'bigint' ? rawAmount : BigInt(rawAmount || '0');
  const value = normalized;
  const isNegative = value < 0n;
  const absoluteValue = isNegative ? value * -1n : value;
  const divisor = 10n ** BigInt(decimals);
  const whole = absoluteValue / divisor;
  const fraction = absoluteValue % divisor;
  const paddedFraction = fraction.toString().padStart(decimals, '0').slice(0, precision);
  const formatted = `${whole.toString()}.${paddedFraction}`.replace(/\.$/, '');
  return isNegative ? `-${formatted}` : formatted;
}

export function shortAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function formatTimeframe(durationSeconds: number | null | undefined) {
  if (durationSeconds === 30) return '30s';
  if (durationSeconds === 60) return '1m';
  if (durationSeconds === 300) return '5m';
  if (!durationSeconds) return '--';
  return `${durationSeconds}s`;
}

/**
 * Format a raw Pyth oracle price (8 decimals, BTC/USD) to a JS number.
 */
export function formatOraclePrice(rawAmount: string | null | undefined, decimals = 8) {
  const numeric = Number(rawAmount || '0');
  if (!Number.isFinite(numeric) || numeric === 0) {
    return null;
  }

  return numeric / 10 ** decimals;
}
