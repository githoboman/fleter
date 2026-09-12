import { createPublicClient, defineChain, fallback, http, parseAbi } from 'viem';

export interface OraclePriceSnapshot {
  price: bigint;
  timestamp: number;
  source: 'binance' | 'dia' | 'static';
}

// DIA Oracle contract addresses on Somnia
const DIA_ORACLE_ADDRESS_MAINNET = '0xbA0E0750A56e995506CA458b2BdD752754CF39C4';
const DIA_ORACLE_ADDRESS_TESTNET = '0x9206296Ea3aEE3E6bdC07F7AaeF14DfCf33d865D';

const BOTCHAIN_RPC_URL = process.env.BOTCHAIN_RPC_URL || 'https://rpc.bohr.life';
const BOTCHAIN_RPC_FALLBACK_URL = process.env.BOTCHAIN_RPC_FALLBACK_URL || 'https://rpc.bohr.life';
const BOTCHAIN_CHAIN_ID = Number(process.env.BOTCHAIN_CHAIN_ID || 968); // Bot Chain Testnet
// DIA is only used as a secondary fallback — freshness requirement relaxed.
const DIA_MAX_AGE_SECONDS = Number(process.env.ORACLE_MAX_AGE_SECONDS || 300);
const getStaticOraclePrice = () => process.env.ORACLE_STATIC_PRICE || '7137582535985';

const DIA_ABI = parseAbi([
  'function getValue(string key) external view returns (uint128 price, uint128 timestamp)',
]);

const MULTICALL3_ADDRESS: Record<number, `0x${string}`> = {
  5031: '0x5e44F178E8cF9B2F5409B6f18ce936aB817C5a11',
  50312: '0x841b8199E6d3Db3C6f264f6C2bd8848b3cA64223',
};

const chain = defineChain({
  id: BOTCHAIN_CHAIN_ID,
  name: BOTCHAIN_CHAIN_ID === 677 ? 'Bot Chain' : 'Bot Chain Testnet',
  nativeCurrency:
    BOTCHAIN_CHAIN_ID === 677
      ? { name: 'BOT', symbol: 'BOT', decimals: 18 }
      : { name: 'tBOT', symbol: 'tBOT', decimals: 18 },
  rpcUrls: {
    default: { http: [BOTCHAIN_RPC_URL] },
    public: { http: [BOTCHAIN_RPC_URL] },
  },
  contracts: {
    multicall3: {
      address: MULTICALL3_ADDRESS[BOTCHAIN_CHAIN_ID] ?? '0x841b8199E6d3Db3C6f264f6C2bd8848b3cA64223',
    },
  },
});

const publicClient = createPublicClient({
  chain,
  transport: fallback(
    [
      http(BOTCHAIN_RPC_URL, { retryCount: 3, retryDelay: 1000 }),
      http(BOTCHAIN_RPC_FALLBACK_URL, { retryCount: 2, retryDelay: 2000 }),
    ],
    { rank: false },
  ),
});

function getOracleAddress(): `0x${string}` {
  return (BOTCHAIN_CHAIN_ID === 677 ? DIA_ORACLE_ADDRESS_MAINNET : DIA_ORACLE_ADDRESS_TESTNET) as `0x${string}`;
}

/**
 * Primary: fetch BTC/USD from Binance REST API.
 */
async function fetchBinancePrice(): Promise<OraclePriceSnapshot> {
  try {
    const response = await fetch(
      'https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT'
    );

    if (!response.ok) {
      throw new Error(`Binance HTTP ${response.status}`);
    }

    const data = await response.json() as { symbol: string; price: string };
    const priceUsd = parseFloat(data.price);

    if (!priceUsd || priceUsd <= 0) {
      throw new Error('Invalid price from Binance');
    }

    const price = BigInt(Math.round(priceUsd * 1e8));
    const timestamp = Math.floor(Date.now() / 1000);

    return { price, timestamp, source: 'binance' };
  } catch (err: any) {
    throw new Error(`Binance error: ${err?.message || String(err)}`);
  }
}

async function fetchDiaOnchain(): Promise<OraclePriceSnapshot> {
  const [price, timestamp] = await publicClient.readContract({
    address: getOracleAddress(),
    abi: DIA_ABI,
    functionName: 'getValue',
    args: ['BTC/USD'],
  });

  if (price === 0n) {
    throw new Error('[Oracle] DIA returned zero price');
  }

  const ts = Number(timestamp);
  const age = Math.floor(Date.now() / 1000) - ts;
  if (age > DIA_MAX_AGE_SECONDS) {
    throw new Error(`[Oracle] DIA price is stale (${age}s old)`);
  }

  return { price, timestamp: ts, source: 'dia' };
}

/**
 * Static fallback with "Mock Jitter" to prevent constant draws on testnet.
 * It adds a random drift of up to +/- 50 bps (0.5%) to the static price.
 */
function staticSnapshot(): OraclePriceSnapshot | null {
  const staticPriceStr = getStaticOraclePrice();
  if (!staticPriceStr) return null;

  let price = BigInt(staticPriceStr);

  // Add jitter: +/- 0.5%
  const jitterBps = Math.floor(Math.random() * 101) - 50; // -50 to +50
  const jitterAmount = (price * BigInt(Math.abs(jitterBps))) / 10000n;

  if (jitterBps > 0) {
    price += jitterAmount;
  } else {
    price -= jitterAmount;
  }

  return {
    price,
    timestamp: Math.floor(Date.now() / 1000),
    source: 'static',
  };
}

/**
 * Fetch the current BTC/USD price.
 * Priority: Binance REST → DIA on-chain → ORACLE_STATIC_PRICE (with jitter).
 */
export async function fetchOraclePrice(): Promise<OraclePriceSnapshot> {
  // 1. Binance REST
  try {
    return await fetchBinancePrice();
  } catch (err: any) {
    console.warn('[Oracle] Binance failed:', err.message);
  }

  // 2. DIA on-chain
  try {
    return await fetchDiaOnchain();
  } catch (err: any) {
    console.warn('[Oracle] DIA on-chain failed:', err.message);
  }

  // 3. Static fallback with jitter
  const snapshot = staticSnapshot();
  if (snapshot) {
    console.warn('[Oracle] Using jitter-mocked static price');
    return snapshot;
  }

  throw new Error('[Oracle] No price source available');
}
