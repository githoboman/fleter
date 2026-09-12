import dotenv from 'dotenv';
import { publishInvalidation } from './realtime';
import { precomputeSignalForMarket } from './precompute';

dotenv.config();

const PREDICTION_MARKET_ADDRESS = process.env.PREDICTION_MARKET_ADDRESS || '';
const SOMNIA_CHAIN_ID = Number(process.env.SOMNIA_CHAIN_ID || 50312);
const SOMNIA_REACTIVITY_ENABLED = process.env.SOMNIA_REACTIVITY_ENABLED !== 'false';
const SOMNIA_REACTIVITY_WS_URL =
  process.env.SOMNIA_REACTIVITY_WS_URL || 'wss://api.infra.testnet.somnia.network/ws';
const SOMNIA_REACTIVITY_HTTP_URL =
  process.env.SOMNIA_REACTIVITY_HTTP_URL || 'https://dream-rpc.somnia.network';

type ReactivitySubscription = {
  unsubscribe?: () => Promise<unknown> | unknown;
};

const MARKET_EVENTS = [
  'event MarketOpened(uint256 indexed marketId, address indexed opener, uint8 direction, uint256 stakeAmount, uint256 duration, uint128 strikePrice)',
  'event MarketJoined(uint256 indexed marketId, address indexed participant, uint8 direction, uint256 stakeAmount)',
  'event MarketLocked(uint256 indexed marketId)',
  'event MarketSettled(uint256 indexed marketId, uint8 outcome, uint128 settlementPrice, uint256 feeAmount, uint256 sweptToVault)',
  'event MarketClaimed(uint256 indexed marketId, address indexed participant, uint8 outcome, uint256 payout, uint256 profit)',
] as const;

const GET_MARKET_ABI = [
  'function getMarket(uint256 marketId) view returns ((uint256 marketId,address opener,uint8 openerDirection,uint256 duration,uint256 openedAt,uint256 joiningWindowEnd,uint256 expiryAt,uint128 strikePrice,uint128 settlementPrice,uint128 strikeTimestamp,uint128 settlementTimestamp,uint256 pomProfitBps,uint256 upPool,uint256 downPool,uint256 totalUserStaked,uint256 vaultCommitted,uint256 feeAmount,uint256 sweptToVault,uint256 participantCount,uint256 claimedCount,uint8 state,uint8 outcome))',
] as const;

function enabledOnCurrentChain() {
  return SOMNIA_REACTIVITY_ENABLED && SOMNIA_CHAIN_ID === 50312;
}

export async function startSomniaReactivityBridge() {
  if (!enabledOnCurrentChain()) {
    console.log('[Gateway] Somnia Reactivity disabled or unsupported on this chain. Using fallback transport.');
    return () => undefined;
  }

  if (!PREDICTION_MARKET_ADDRESS) {
    console.warn('[Gateway] PREDICTION_MARKET_ADDRESS missing. Reactivity bridge not started.');
    return () => undefined;
  }

  try {
    const [{ SDK }, viem] = await Promise.all([
      import('@somnia-chain/reactivity'),
      import('viem'),
    ]);

    const {
      createPublicClient,
      decodeEventLog,
      decodeFunctionResult,
      defineChain,
      parseAbi,
      parseAbiItem,
      toFunctionSelector,
      toEventSelector,
      webSocket,
    } = viem as any;

    const chain = defineChain({
      id: 50312,
      name: 'Somnia Shannon',
      network: 'somnia-shannon',
      nativeCurrency: {
        name: 'STT',
        symbol: 'STT',
        decimals: 18,
      },
      rpcUrls: {
        default: {
          http: [SOMNIA_REACTIVITY_HTTP_URL],
          webSocket: [SOMNIA_REACTIVITY_WS_URL],
        },
        public: {
          http: [SOMNIA_REACTIVITY_HTTP_URL],
          webSocket: [SOMNIA_REACTIVITY_WS_URL],
        },
      },
      contracts: {
        multicall3: { address: '0x841b8199E6d3Db3C6f264f6C2bd8848b3cA64223' },
      },
    });

    const publicClient = createPublicClient({
      chain,
      transport: webSocket(SOMNIA_REACTIVITY_WS_URL),
    });

    const sdk = new SDK({ public: publicClient });
    const marketEventAbi = parseAbi([...MARKET_EVENTS]);
    const getMarketCallData = toFunctionSelector('getMarket(uint256)');

    const subscriptions: ReactivitySubscription[] = [];

    for (const eventSignature of MARKET_EVENTS) {
      const eventItem = parseAbiItem(eventSignature);
      const topic = toEventSelector(eventItem);
      const eventName = eventSignature.slice('event '.length, eventSignature.indexOf('('));

      const subscription = await sdk.subscribe({
        eventContractSources: [PREDICTION_MARKET_ADDRESS as `0x${string}`],
        topicOverrides: [topic],
        ethCalls: [
          {
            to: PREDICTION_MARKET_ADDRESS as `0x${string}`,
            data: getMarketCallData,
          },
        ],
        context: 'topic1',
        onlyPushChanges: true,
        onData: (payload: any) => {
          try {
            const decodedLog = decodeEventLog({
              abi: marketEventAbi,
              topics: payload?.result?.topics ?? [],
              data: payload?.result?.data ?? '0x',
            });

            const marketResult = payload?.result?.simulationResults?.[0];
            const decodedMarket =
              marketResult
                ? decodeFunctionResult({
                    abi: parseAbi(GET_MARKET_ABI),
                    functionName: 'getMarket',
                    data: marketResult,
                  })
                : null;

            const marketId =
              decodedLog?.args?.marketId !== undefined
                ? String(decodedLog.args.marketId)
                : decodedMarket?.marketId !== undefined
                  ? String(decodedMarket.marketId)
                  : null;

            const traderAddress =
              decodedLog?.args?.participant ?? decodedLog?.args?.opener ?? null;

            console.log(
              `[Gateway] Reactivity event ${eventName} received for market ${marketId ?? 'unknown'}`,
            );

            publishInvalidation({
              reason: 'reactivity-event',
              eventName,
              marketId,
              traderAddress: traderAddress ? String(traderAddress) : null,
              occurredAt: new Date().toISOString(),
            });

            // Precompute AI signal at market open and at lock so the
            // user-facing /signal/:id endpoint reads from cache instantly.
            if (marketId && (eventName === 'MarketOpened' || eventName === 'MarketLocked')) {
              precomputeSignalForMarket(marketId).catch(() => {
                // fire-and-forget; errors logged inside precomputeSignalForMarket
              });
            }
          } catch (error) {
            console.error(`[Gateway] Failed to decode Reactivity payload for ${eventName}:`, error);
          }
        },
        onError: (error: Error) => {
          console.error(`[Gateway] Reactivity subscription error for ${eventName}:`, error);
        },
      });

      if (subscription instanceof Error) {
        console.error(`[Gateway] Reactivity subscription failed for ${eventName}:`, subscription);
        continue;
      }

      subscriptions.push(subscription);
    }

    console.log(
      `[Gateway] Somnia Reactivity bridge started with ${subscriptions.length} subscriptions on ${SOMNIA_REACTIVITY_WS_URL}`,
    );

    return async () => {
      await Promise.all(
        subscriptions.map(async (subscription) => {
          try {
            await subscription?.unsubscribe?.();
          } catch (error) {
            console.error('[Gateway] Failed to unsubscribe Reactivity subscription:', error);
          }
        }),
      );
    };
  } catch (error: any) {
    console.warn(
      `[Gateway] Somnia Reactivity bridge unavailable: ${error?.message || error}. Falling back to periodic refresh.`,
    );
    return () => undefined;
  }
}
