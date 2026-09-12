import dotenv from 'dotenv';
import {
  SDK,
  SchemaEncoder,
} from '@somnia-chain/streams';
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  keccak256,
  stringToHex,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

dotenv.config();

const SOMNIA_CHAIN_ID = Number(process.env.SOMNIA_CHAIN_ID || 50312);
const SOMNIA_RPC_URL = process.env.SOMNIA_RPC_URL || 'https://dream-rpc.somnia.network';
const STREAMS_ENABLED = process.env.SOMNIA_STREAMS_ENABLED !== 'false';
const STREAMS_PUBLISHER_PRIVATE_KEY = process.env.STREAMS_PUBLISHER_PRIVATE_KEY || '';
const STREAMS_PUBLISHER_ADDRESS = process.env.STREAMS_PUBLISHER_ADDRESS || '';

const AI_SIGNAL_SCHEMA_NAME = 'bitdrum-ai-signal-v1';
const AI_SIGNAL_SCHEMA =
  'string marketId,string direction,uint32 confidence,string rationale,string generatedAt';
const LEADERBOARD_SCHEMA_NAME = 'bitdrum-leaderboard-snapshot-v1';
const LEADERBOARD_SCHEMA =
  'string snapshotId,string timeframe,string payloadJson,string generatedAt';

type StreamsClientBundle = {
  sdk: SDK;
  publisherAddress: `0x${string}` | null;
  aiSignalSchemaId: `0x${string}`;
  leaderboardSchemaId: `0x${string}`;
  aiSignalEncoder: SchemaEncoder;
  leaderboardEncoder: SchemaEncoder;
};

type AiSignalPayload = {
  marketId: string;
  direction: string;
  confidence: number;
  rationale: string;
  generatedAt: string;
};

type LeaderboardSnapshotPayload = {
  snapshotId: string;
  timeframe: string;
  payloadJson: string;
  generatedAt: string;
};

let bundlePromise: Promise<StreamsClientBundle | null> | null = null;

function getChain() {
  return defineChain({
    id: SOMNIA_CHAIN_ID,
    name: SOMNIA_CHAIN_ID === 5031 ? 'Somnia' : 'Somnia Shannon',
    network: SOMNIA_CHAIN_ID === 5031 ? 'somnia' : 'somnia-shannon',
    nativeCurrency:
      SOMNIA_CHAIN_ID === 5031
        ? { name: 'SOMI', symbol: 'SOMI', decimals: 18 }
        : { name: 'STT', symbol: 'STT', decimals: 18 },
    rpcUrls: {
      default: { http: [SOMNIA_RPC_URL] },
      public: { http: [SOMNIA_RPC_URL] },
    },
  });
}

async function getBundle(): Promise<StreamsClientBundle | null> {
  if (!STREAMS_ENABLED) {
    return null;
  }

  if (!bundlePromise) {
    bundlePromise = (async () => {
      const chain = getChain();
      const publicClient = createPublicClient({
        chain,
        transport: http(SOMNIA_RPC_URL),
      });

      const account = STREAMS_PUBLISHER_PRIVATE_KEY
        ? privateKeyToAccount(STREAMS_PUBLISHER_PRIVATE_KEY as `0x${string}`)
        : null;

      const walletClient = account
        ? createWalletClient({
            account,
            chain,
            transport: http(SOMNIA_RPC_URL),
          })
        : undefined;

      const sdk = new SDK({
        public: publicClient,
        ...(walletClient ? { wallet: walletClient } : {}),
      });

      const aiSignalEncoder = new SchemaEncoder(AI_SIGNAL_SCHEMA);
      const leaderboardEncoder = new SchemaEncoder(LEADERBOARD_SCHEMA);

      const aiSignalSchemaId = await sdk.streams.computeSchemaId(AI_SIGNAL_SCHEMA);
      const leaderboardSchemaId = await sdk.streams.computeSchemaId(LEADERBOARD_SCHEMA);

      if (aiSignalSchemaId instanceof Error || leaderboardSchemaId instanceof Error) {
        throw aiSignalSchemaId instanceof Error ? aiSignalSchemaId : leaderboardSchemaId;
      }

      const publisherAddress = account?.address
        ?? (STREAMS_PUBLISHER_ADDRESS ? (STREAMS_PUBLISHER_ADDRESS as `0x${string}`) : null);

      if (walletClient) {
        const registration = await sdk.streams.registerDataSchemas(
          [
            { schemaName: AI_SIGNAL_SCHEMA_NAME, schema: AI_SIGNAL_SCHEMA },
            { schemaName: LEADERBOARD_SCHEMA_NAME, schema: LEADERBOARD_SCHEMA },
          ],
          true,
        );

        if (registration instanceof Error) {
          console.warn('[Gateway] Somnia Streams schema registration failed:', registration);
        }
      }

      return {
        sdk,
        publisherAddress,
        aiSignalSchemaId,
        leaderboardSchemaId,
        aiSignalEncoder,
        leaderboardEncoder,
      };
    })().catch((error) => {
      console.warn('[Gateway] Somnia Streams initialization failed:', error);
      return null;
    });
  }

  return bundlePromise;
}

function makeDataId(input: string) {
  return keccak256(stringToHex(input));
}

function decodeRecord(decoded: Array<Array<{ name: string; value: { value: unknown } }>> | Error, fieldName: string) {
  if (decoded instanceof Error || decoded.length === 0) {
    return null;
  }

  const last = decoded[decoded.length - 1];
  const match = last.find((item) => item.name === fieldName);
  return match ? (match.value.value as string) : null;
}

export async function publishAiSignalToStreams(signal: AiSignalPayload) {
  const bundle = await getBundle();

  if (!bundle || !bundle.sdk.streams || !STREAMS_PUBLISHER_PRIVATE_KEY) {
    return null;
  }

  const encoded = bundle.aiSignalEncoder.encodeData([
    { name: 'marketId', type: 'string', value: signal.marketId },
    { name: 'direction', type: 'string', value: signal.direction },
    { name: 'confidence', type: 'uint32', value: signal.confidence },
    { name: 'rationale', type: 'string', value: signal.rationale },
    { name: 'generatedAt', type: 'string', value: signal.generatedAt },
  ]);

  const txHash = await bundle.sdk.streams.set([
    {
      id: makeDataId(`ai-signal:${signal.marketId}`),
      schemaId: bundle.aiSignalSchemaId,
      data: encoded,
    },
  ]);

  if (txHash instanceof Error) {
    throw txHash;
  }

  return txHash;
}

export async function publishLeaderboardSnapshotToStreams(snapshot: LeaderboardSnapshotPayload) {
  const bundle = await getBundle();

  if (!bundle || !bundle.sdk.streams || !STREAMS_PUBLISHER_PRIVATE_KEY) {
    return null;
  }

  const encoded = bundle.leaderboardEncoder.encodeData([
    { name: 'snapshotId', type: 'string', value: snapshot.snapshotId },
    { name: 'timeframe', type: 'string', value: snapshot.timeframe },
    { name: 'payloadJson', type: 'string', value: snapshot.payloadJson },
    { name: 'generatedAt', type: 'string', value: snapshot.generatedAt },
  ]);

  const txHash = await bundle.sdk.streams.set([
    {
      id: makeDataId(`leaderboard:${snapshot.snapshotId}`),
      schemaId: bundle.leaderboardSchemaId,
      data: encoded,
    },
  ]);

  if (txHash instanceof Error) {
    throw txHash;
  }

  return txHash;
}

export async function getAiSignalFromStreams(marketId: string) {
  const bundle = await getBundle();

  if (!bundle || !bundle.publisherAddress) {
    return null;
  }

  const result = await bundle.sdk.streams.getByKey(
    bundle.aiSignalSchemaId,
    bundle.publisherAddress,
    makeDataId(`ai-signal:${marketId}`),
  );

  if (result instanceof Error || result.length === 0) {
    return null;
  }

  const decoded = result as Array<Array<{ name: string; value: { value: unknown } }>>;

  return {
    market_id: marketId,
    direction: decodeRecord(decoded, 'direction'),
    confidence: Number(decodeRecord(decoded, 'confidence') || 0),
    rationale: decodeRecord(decoded, 'rationale'),
    generated_at: decodeRecord(decoded, 'generatedAt'),
  };
}

export async function getLatestLeaderboardSnapshotFromStreams() {
  const bundle = await getBundle();

  if (!bundle || !bundle.publisherAddress) {
    return null;
  }

  const result = await bundle.sdk.streams.getLastPublishedDataForSchema(
    bundle.leaderboardSchemaId,
    bundle.publisherAddress,
  );

  if (result instanceof Error || result.length === 0) {
    return null;
  }

  const decoded = result as Array<Array<{ name: string; value: { value: unknown } }>>;
  const payloadJson = decodeRecord(decoded, 'payloadJson');

  if (!payloadJson) {
    return null;
  }

  return {
    snapshot_id: decodeRecord(decoded, 'snapshotId'),
    timeframe: decodeRecord(decoded, 'timeframe'),
    generated_at: decodeRecord(decoded, 'generatedAt'),
    rankings: JSON.parse(payloadJson),
  };
}
