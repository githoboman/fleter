'use client';

import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ExternalLink, Loader2 } from 'lucide-react';
import { useBitdrumWallet } from './BitdrumWalletProvider';
import { useDreamPositions, DREAM_POSITIONS_KEY } from '../hooks/useDreamPositions';
import { COLLATERAL_BALANCE_KEY } from '../hooks/useCollateralBalance';
import { COLLATERAL_SYMBOL, explorerTxUrl } from '../lib/dreamdex/client';
import { redeemPosition, type DreamPosition } from '../lib/dreamdex/positions';
import { formatTimeframe } from '../utils/bitdrum';
import { Panel, StatPill } from './ObsidianPrimitives';

const fmt = (n: number | null, digits = 2) =>
  n === null ? '--' : n.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });

function CountdownTimer({ expiry }: { expiry: number }) {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const id = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(id);
  }, []);
  const remaining = Math.max(0, expiry - now);
  if (remaining <= 0) {
    return (
      <span className="inline-flex items-center gap-2 rounded-full border border-[rgba(245,185,66,0.18)] bg-[rgba(245,185,66,0.08)] px-3 py-1 text-[0.62rem] uppercase tracking-[0.24em] text-[var(--accent-gold)]">
        <Loader2 className="h-3 w-3 animate-spin" />
        Settling
      </span>
    );
  }
  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const urgent = remaining <= 10;
  return (
    <span
      className={`rounded-full border px-3 py-1 font-mono text-[0.62rem] tabular-nums uppercase tracking-[0.24em] ${
        urgent
          ? 'border-[rgba(220,38,38,0.2)] bg-[rgba(220,38,38,0.1)] text-[var(--state-down)] animate-pulse'
          : 'border-[rgba(245,185,66,0.18)] bg-[rgba(245,185,66,0.08)] text-[var(--accent-gold)]'
      }`}
    >
      {mins > 0 ? `${mins}m ${secs.toString().padStart(2, '0')}s` : `${secs}s`}
    </span>
  );
}

const statusTone = (status: DreamPosition['status']): 'neutral' | 'gold' | 'core' | 'success' | 'danger' => {
  if (status === 'WIN') return 'success';
  if (status === 'LOSS') return 'danger';
  if (status === 'VOID') return 'core';
  if (status === 'SETTLING') return 'gold';
  return 'neutral';
};

export function PositionCard({
  position,
  compact = false,
}: {
  position: DreamPosition;
  compact?: boolean;
}) {
  const queryClient = useQueryClient();
  const [redeeming, setRedeeming] = useState(false);
  const [redeemHash, setRedeemHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRedeem = async () => {
    setRedeeming(true);
    setError(null);
    try {
      const res = await redeemPosition(position);
      setRedeemHash(res.hash);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: [DREAM_POSITIONS_KEY] }),
        queryClient.invalidateQueries({ queryKey: [COLLATERAL_BALANCE_KEY] }),
      ]);
    } catch (caughtError: unknown) {
      setError(caughtError instanceof Error ? caughtError.message : 'Redeem failed');
    } finally {
      setRedeeming(false);
    }
  };

  const pnl = position.status === 'WIN'
    ? (position.claimable?.estPayout ?? position.shares) - position.costBasis
    : position.status === 'LOSS'
      ? -position.costBasis
      : position.unrealizedPnl;
  const isUp = position.direction === 'UP';

  return (
    <Panel className={`flex flex-col gap-4 ${compact ? 'p-4' : 'p-5'}`}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <span
            className={`rounded-full border px-2.5 py-1 text-[0.62rem] uppercase tracking-[0.24em] ${
              isUp ? 'text-[var(--state-up)] border-[var(--state-up)]/20' : 'text-[var(--state-down)] border-[var(--state-down)]/20'
            }`}
          >
            {position.direction}
          </span>
          <div className="min-w-0">
            <p className="font-heading text-lg tracking-tight text-[var(--text-primary)]">
              {position.asset} {position.intervalSec ? formatTimeframe(position.intervalSec) : ''} · {new Date(position.expiry * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <StatPill label="Status" value={position.status} accent={statusTone(position.status)} />
              <StatPill label="Stake" value={`${fmt(position.costBasis)} ${COLLATERAL_SYMBOL}`} />
              <StatPill label="Pays" value={`${fmt(position.shares)} ${COLLATERAL_SYMBOL}`} accent="gold" />
              {position.strike ? <StatPill label="Open" value={`$${fmt(position.strike)}`} accent="core" /> : null}
              <StatPill
                label={position.status === 'LIVE' ? 'Mark PnL' : 'PnL'}
                value={pnl === null ? '--' : `${pnl >= 0 ? '+' : ''}${fmt(pnl)}`}
                accent={pnl === null ? 'neutral' : pnl >= 0 ? 'success' : 'danger'}
              />
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {position.status === 'LIVE' || position.status === 'SETTLING' ? <CountdownTimer expiry={position.expiry} /> : null}
          {position.claimable && !redeemHash ? (
            <button
              disabled={redeeming}
              onClick={() => void handleRedeem()}
              className="rounded-full border border-[rgba(245,185,66,0.3)] bg-[rgba(245,185,66,0.08)] px-3 py-1 text-[0.68rem] uppercase tracking-[0.2em] text-[var(--accent-gold)] transition hover:bg-[var(--accent-gold)] hover:text-black disabled:opacity-50"
            >
              {redeeming ? 'Redeeming…' : `Redeem ${fmt(position.claimable.estPayout)}`}
            </button>
          ) : null}
          {redeemHash ? (
            <a
              href={explorerTxUrl(redeemHash)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-[0.62rem] uppercase tracking-[0.2em] text-[var(--state-up)]"
            >
              Redeemed <ExternalLink className="h-3 w-3" />
            </a>
          ) : null}
        </div>
      </div>
      {error ? <p className="text-[0.75rem] text-[var(--state-down)] break-words">{error}</p> : null}
    </Panel>
  );
}

export function DreamPositionsList({ compact = false, limit }: { compact?: boolean; limit?: number }) {
  const { address, authenticated, connect } = useBitdrumWallet();
  const { positions, isLoading, error } = useDreamPositions(address);
  const rows = limit ? positions.slice(0, limit) : positions;

  if (!authenticated) {
    return (
      <div className="rounded-[1.5rem] border border-dashed border-[color:var(--border-subtle)] px-4 py-10 text-center">
        <p className="text-[0.68rem] uppercase tracking-[0.34em] text-[var(--text-muted)]">Connect to see positions</p>
        <button
          onClick={() => void connect().catch(() => {})}
          className="cta-press mt-5 rounded-full bg-[linear-gradient(135deg,var(--accent-gold),#d97706)] px-5 py-3 text-sm text-[#140c00]"
        >
          Connect wallet
        </button>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-[1.35rem] border border-[rgba(220,38,38,0.25)] bg-[rgba(220,38,38,0.08)] px-5 py-4 text-sm text-[var(--state-down)] break-words">
        Positions unavailable: {error}
      </div>
    );
  }

  if (isLoading && !positions.length) {
    return (
      <p className="py-10 text-center text-[0.68rem] uppercase tracking-[0.34em] text-[var(--text-muted)]">Reading DreamDEX positions...</p>
    );
  }

  if (!rows.length) {
    return <p className="py-10 text-center text-[0.68rem] uppercase tracking-[0.34em] text-[var(--text-muted)]">No positions yet</p>;
  }

  return (
    <div className="grid gap-3">
      {rows.map((position) => (
        <PositionCard key={position.key} position={position} compact={compact} />
      ))}
    </div>
  );
}
