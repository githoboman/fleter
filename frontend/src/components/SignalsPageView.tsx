'use client';

import { useState } from 'react';
import { BrainCircuit, Radar, Waves } from 'lucide-react';
import { useUpDownMarket } from '../hooks/useUpDownMarket';
import type { CadenceSec } from '../lib/dreamdex/markets';
import { formatTimeframe } from '../utils/bitdrum';
import { Eyebrow, Panel, StatPill } from './ObsidianPrimitives';

const pct = (x: number | null | undefined, digits = 1) => (x === null || x === undefined ? '--' : `${(x * 100).toFixed(digits)}%`);
const usd = (x: number | null | undefined) => (x === null || x === undefined ? '--' : `$${x.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);

function ProbabilityBar({ label, value, color }: { label: string; value: number | null; color: string }) {
  return (
    <div>
      <div className="flex items-center justify-between text-[0.62rem] uppercase tracking-[0.24em] text-[var(--text-muted)]">
        <span>{label}</span>
        <span className="font-mono text-[var(--text-primary)]">{pct(value)}</span>
      </div>
      <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-[rgba(255,255,255,0.05)]">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${(value ?? 0) * 100}%`, background: color, boxShadow: `0 0 12px ${color}` }} />
      </div>
    </div>
  );
}

/** Two horizontal probability bars: the model's P(UP) against the book's. */
function EdgeMeter({ modelUp, impliedUp }: { modelUp: number | null; impliedUp: number | null }) {
  return (
    <div className="grid gap-4">
      <ProbabilityBar label="Model P(UP)" value={modelUp} color="var(--accent-core)" />
      <ProbabilityBar label="Market P(UP) · YES mid" value={impliedUp} color="var(--accent-gold)" />
      <div className="relative h-px bg-[rgba(255,255,255,0.06)]">
        <div className="absolute left-1/2 top-1/2 h-3 w-px -translate-y-1/2 bg-[rgba(255,255,255,0.25)]" />
        <span className="absolute left-1/2 top-2 -translate-x-1/2 text-[0.55rem] uppercase tracking-[0.2em] text-[var(--text-muted)]">50%</span>
      </div>
    </div>
  );
}

export function SignalsPageView() {
  const [cadence, setCadence] = useState<CadenceSec>(300);
  const { snap, signal, error } = useUpDownMarket('BTC', cadence);

  const direction = signal?.direction ?? 'NEUTRAL';
  const move = snap?.livePrice && snap?.openingPrice ? (snap.livePrice / snap.openingPrice - 1) * 100 : null;
  const hurdle = signal ? 0.03 + (snap?.spread ?? 0) / 2 : null;

  return (
    <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
      <Panel tone="core" className="surface-lift p-5 sm:p-6">
        <Eyebrow accent="core">BitDrum Edge</Eyebrow>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
          <h2 className="font-heading text-[2rem] font-semibold tracking-[-0.05em] text-[var(--text-primary)]">
            Fair value vs. the book
          </h2>
          <div className="flex items-center gap-3">
            <div className="flex gap-2">
              {([60, 300] as CadenceSec[]).map((seconds) => (
                <button
                  key={seconds}
                  onClick={() => setCadence(seconds)}
                  className={`rounded-full border px-3 py-1.5 text-[0.62rem] uppercase tracking-[0.24em] transition ${
                    cadence === seconds
                      ? 'border-[rgba(245,185,66,0.24)] bg-[rgba(245,185,66,0.08)] text-[var(--accent-gold)]'
                      : 'border-[color:var(--border-subtle)] bg-[rgba(255,255,255,0.03)] text-[var(--text-secondary)]'
                  }`}
                >
                  {formatTimeframe(seconds)}
                </button>
              ))}
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[rgba(34,211,238,0.18)] bg-[rgba(34,211,238,0.08)] px-3 py-1.5 text-[0.66rem] uppercase tracking-[0.26em] text-[var(--accent-cyan)]">
              <Waves className="h-3.5 w-3.5" />
              {signal ? 'Live' : error ? 'Retrying' : 'Syncing'}
            </div>
          </div>
        </div>

        <div className="mt-8 grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="flex justify-center">
            <div className="core-ring h-[15rem] w-[15rem]">
              <div className="core-ring__inner">
                <span
                  className={`text-[0.72rem] uppercase tracking-[0.32em] ${
                    direction === 'UP' ? 'text-[var(--state-up)]' : direction === 'DOWN' ? 'text-[var(--state-down)]' : 'text-[var(--accent-cyan)]'
                  }`}
                >
                  {direction}
                </span>
                <strong className="mt-3 font-mono text-5xl font-semibold text-[var(--text-primary)]">{signal?.confidence ?? 0}%</strong>
                <span className="mt-2 text-[0.6rem] uppercase tracking-[0.24em] text-[var(--text-muted)]">
                  edge {signal?.edge === null || signal?.edge === undefined ? '--' : `${signal.edge >= 0 ? '+' : ''}${(signal.edge * 100).toFixed(1)}%`}
                </span>
              </div>
            </div>
          </div>
          <div className="space-y-4">
            <Panel className="p-5">
              <EdgeMeter modelUp={signal?.modelUp ?? null} impliedUp={snap?.impliedUp ?? null} />
            </Panel>
            <Panel className="p-5">
              <div className="flex items-center gap-2 text-[0.68rem] uppercase tracking-[0.3em] text-[var(--accent-cyan)]">
                <BrainCircuit className="h-4 w-4" />
                Rationale
              </div>
              <p className="mt-4 text-sm leading-7 text-[var(--text-secondary)]">
                {signal?.rationale ||
                  (snap
                    ? 'Waiting for the opening price and a two-sided book before pricing this window.'
                    : 'Locating the live DreamDEX Up/Down window for this cadence.')}
              </p>
            </Panel>
            <div className="flex flex-wrap gap-3">
              <StatPill label="Direction" value={direction} accent={direction === 'UP' ? 'success' : direction === 'DOWN' ? 'danger' : 'core'} />
              <StatPill label="Hurdle" value={pct(hurdle)} accent="neutral" />
              <StatPill label="Spread" value={snap?.spread === null || snap?.spread === undefined ? '--' : `${(snap.spread * 100).toFixed(1)}¢`} accent="gold" />
            </div>
          </div>
        </div>
      </Panel>

      <Panel className="surface-lift p-5 sm:p-6">
        <div className="flex items-center gap-2">
          <Radar className="h-5 w-5 text-[var(--accent-core)]" />
          <div>
            <Eyebrow accent="core">Signal Inputs</Eyebrow>
            <h3 className="mt-2 font-heading text-[1.5rem] font-semibold tracking-[-0.04em] text-[var(--text-primary)]">
              What the model sees
            </h3>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <StatPill label="Live index" value={usd(snap?.livePrice)} accent="gold" />
          <StatPill label="Window open" value={usd(snap?.openingPrice)} accent="core" />
          <StatPill label="Move vs open" value={move === null ? '--' : `${move >= 0 ? '+' : ''}${move.toFixed(3)}%`} accent={move === null ? 'neutral' : move >= 0 ? 'success' : 'danger'} />
          <StatPill label="Time left" value={snap ? `${Math.max(0, snap.secondsLeft)}s / ${snap.windowSec}s` : '--'} accent="neutral" />
          <StatPill label="Realized σ / min" value={signal ? pct(signal.sigmaPerMin, 3) : '--'} accent="neutral" />
          <StatPill label="z-score" value={signal ? signal.zScore.toFixed(2) : '--'} accent="core" />
          <StatPill label="Best UP ask" value={snap?.bestUpAsk === null || snap?.bestUpAsk === undefined ? '--' : `${snap.bestUpAsk.toFixed(3)}¢`} accent="success" />
          <StatPill label="Best DOWN ask" value={snap?.bestDownAsk === null || snap?.bestDownAsk === undefined ? '--' : `${snap.bestDownAsk.toFixed(3)}¢`} accent="danger" />
        </div>

        <Panel className="mt-5 p-5">
          <Eyebrow accent="neutral">The model</Eyebrow>
          <p className="mt-3 font-mono text-[0.8rem] leading-7 text-[var(--text-primary)]">
            P(UP) = Φ( ln(S / K) / (σ · √τ) )
          </p>
          <p className="mt-3 text-sm leading-7 text-[var(--text-secondary)]">
            S is the live index, K the window&apos;s opening price, σ the realized per-minute volatility from the last hour of
            1-minute candles, τ the minutes left. Edge is the gap between that and the YES mid. A call only fires when
            the gap clears half the spread plus a 3% margin, so it never recommends paying through a wide book.
            Driftless, fee-blind, and short-horizon — treat it as a signal, not a guarantee.
          </p>
        </Panel>
      </Panel>
    </div>
  );
}
