import { mkdir, readFile, writeFile } from 'fs/promises';
import path from 'path';

export interface PersistedMarketState {
  marketId: string;
  joinDeadline: number;
  expiryAt?: number;
  lastKnownState: string;
  lastSeenAt: string;
  lastAttemptAt?: string;
  entryPrice?: string;
  settlementPrice?: string;
  lockTxHash?: string;
  settlementTxHash?: string;
  lastError?: string;
}

export interface KeeperState {
  version: number;
  updatedAt: string;
  markets: Record<string, PersistedMarketState>;
}

const DEFAULT_STATE_FILE = path.resolve(process.cwd(), 'data', 'keeper-state.json');

function getStateFilePath() {
  const configuredPath = process.env.KEEPER_STATE_FILE;
  return configuredPath ? path.resolve(process.cwd(), configuredPath) : DEFAULT_STATE_FILE;
}

export async function loadKeeperState(): Promise<KeeperState> {
  const stateFilePath = getStateFilePath();

  try {
    const raw = await readFile(stateFilePath, 'utf8');
    const parsed = JSON.parse(raw) as KeeperState;

    return {
      version: parsed.version ?? 1,
      updatedAt: parsed.updatedAt ?? new Date(0).toISOString(),
      markets: parsed.markets ?? {},
    };
  } catch (error: any) {
    if (error?.code !== 'ENOENT') {
      console.warn(`[Keeper] Failed to read state file ${stateFilePath}: ${error.message}`);
    }

    return {
      version: 1,
      updatedAt: new Date(0).toISOString(),
      markets: {},
    };
  }
}

export async function saveKeeperState(state: KeeperState) {
  const stateFilePath = getStateFilePath();
  const nextState: KeeperState = {
    ...state,
    version: 1,
    updatedAt: new Date().toISOString(),
  };

  await mkdir(path.dirname(stateFilePath), { recursive: true });
  await writeFile(stateFilePath, JSON.stringify(nextState, null, 2), 'utf8');
}

export function upsertMarketState(
  state: KeeperState,
  marketId: string,
  patch: Partial<PersistedMarketState>,
) {
  const existing = state.markets[marketId];

  state.markets[marketId] = {
    marketId,
    joinDeadline: patch.joinDeadline ?? existing?.joinDeadline ?? 0,
    expiryAt: patch.expiryAt ?? existing?.expiryAt,
    lastKnownState: patch.lastKnownState ?? existing?.lastKnownState ?? 'UNKNOWN',
    lastSeenAt: new Date().toISOString(),
    lastAttemptAt: patch.lastAttemptAt ?? existing?.lastAttemptAt,
    entryPrice: patch.entryPrice ?? existing?.entryPrice,
    settlementPrice: patch.settlementPrice ?? existing?.settlementPrice,
    lockTxHash: patch.lockTxHash ?? existing?.lockTxHash,
    settlementTxHash: patch.settlementTxHash ?? existing?.settlementTxHash,
    lastError: patch.lastError,
  };
}
