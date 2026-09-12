'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  ArrowUpRight,
  Droplets,
  ExternalLink,
  Loader2,
  Radar,
  ShieldCheck,
  Wallet,
} from 'lucide-react';
import { useBitdrumWallet } from './BitdrumWalletProvider';
import { useCollateralBalance, COLLATERAL_BALANCE_KEY } from '../hooks/useCollateralBalance';
import { DREAM_POSITIONS_KEY } from '../hooks/useDreamPositions';
import { COLLATERAL_SYMBOL, attachWallet, explorerTxUrl, signerAddress } from '../lib/dreamdex/client';
import type { CadenceSec, UpDownSnapshot } from '../lib/dreamdex/markets';
import { claimTestCollateral, DEFAULT_SLIPPAGE_BPS, placeStake, quoteStake, type StakeQuoteView } from '../lib/dreamdex/trade';
import type { EdgeSignal } from '../lib/signal/fairValue';
import { formatTimeframe, type BitdrumDirection, type TradeExecutionRecord } from '../utils/bitdrum';
import { Eyebrow, Panel, StatPill } from './ObsidianPrimitives';

/** Trading is disabled this close to expiry — the tx would race the lock. */
const LOCK_GUARD_SECONDS = 5;

/** How far the IOC may chase a moving book. Fills still land at resting prices. */
const TOLERANCES: { label: string; bps: bigint; hint: string }[] = [
  { label: 'Tight', bps: 300n, hint: '3% — may miss if the book moves while you confirm' },
  { label: 'Normal', bps: DEFAULT_SLIPPAGE_BPS, hint: '15% — covers a typical wallet confirmation' },
  { label: 'Wide', bps: 4000n, hint: '40% — fills through fast re-quotes; fewer shares sized' },
];

const fmtUsd = (n: number, digits = 2) =>
  n.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });

export const TradePanel = ({
  snap,
  signal,
  marketError,
  cadence,
  onCadenceChange,
  onTradeSubmitted,
}: {
  snap: UpDownSnapshot | null;
  signal: EdgeSignal | null;
  marketError?: string | null;
  cadence: CadenceSec;
  onCadenceChange: (cadence: CadenceSec) => void;
  onTradeSubmitted?: (record: TradeExecutionRecord) => void;
}) => {
  const queryClient = useQueryClient();
  const { wallet, address, authenticated, connecting, connect } = useBitdrumWallet();

  // Belt and braces: make sure the SDK signs with the wallet on screen.
  const ensureSigner = () => {
    if (wallet && signerAddress()?.toLowerCase() !== wallet.address.toLowerCase()) {
      attachWallet(wallet.walletClient, wallet.address);
    }
  };
  const { balance, gas } = useCollateralBalance(address);
  const needsGas = authenticated && gas !== null && gas <= 0;

  const [stake, setStake] = useState('5');
  const [previewDirection, setPreviewDirection] = useState<BitdrumDirection>('UP');
  const [slippageBps, setSlippageBps] = useState<bigint>(DEFAULT_SLIPPAGE_BPS);
  const [quote, setQuote] = useState<StakeQuoteView | null>(null);
  const [quoteState, setQuoteState] = useState<'idle' | 'loading' | 'too-small' | 'no-liquidity' | 'error'>('idle');
  const [isPending, setIsPending] = useState(false);
  const [isFauceting, setIsFauceting] = useState(false);
  const [lastRecord, setLastRecord] = useState<TradeExecutionRecord | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Local 1s countdown between 2s market refreshes so the timer reads smoothly.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const secondsLeft = snap ? Math.max(0, Number(snap.market.expiry) - Math.floor(now / 1000)) : null;
  const locking = secondsLeft !== null && secondsLeft <= LOCK_GUARD_SECONDS;

  const numericStake = Number(stake || '0');
  const stakeValid = Number.isFinite(numericStake) && numericStake > 0;

  // Re-quote against the live book whenever the inputs move.
  useEffect(() => {
    if (!snap || !stakeValid) {
      setQuote(null);
      setQuoteState('idle');
      return;
    }
    const sideAsks = previewDirection === 'UP' ? snap.book.yesAsks : snap.book.noAsks;
    if (!sideAsks.length) {
      setQuote(null);
      setQuoteState('no-liquidity');
      return;
    }
    let cancelled = false;
    setQuoteState('loading');
    quoteStake(snap, previewDirection, numericStake, slippageBps)
      .then((q) => {
        if (cancelled) return;
        setQuote(q);
        setQuoteState(q ? 'idle' : 'too-small');
      })
      .catch(() => {
        if (cancelled) return;
        setQuote(null);
        setQuoteState('error');
      });
    return () => {
      cancelled = true;
    };
  }, [snap, previewDirection, numericStake, stakeValid, slippageBps]);

  const handleConnect = async () => {
    setError(null);
    try {
      await connect();
    } catch (caughtError: unknown) {
      setError(caughtError instanceof Error ? caughtError.message : 'Wallet connection failed');
    }
  };

  const handleFaucet = async () => {
    if (needsGas) {
      setError('This wallet has no STT for gas on Somnia Shannon. Get some from the Somnia faucet first.');
      return;
    }
    setError(null);
    setIsFauceting(true);
    try {
      ensureSigner();
      await claimTestCollateral();
      await queryClient.invalidateQueries({ queryKey: [COLLATERAL_BALANCE_KEY] });
    } catch (caughtError: unknown) {
      setError(caughtError instanceof Error ? caughtError.message : 'Faucet call failed');
    } finally {
      setIsFauceting(false);
    }
  };

  const handleTrade = async () => {
    if (!authenticated || !address) {
      setError('Connect your wallet to lock a position.');
      return;
    }
    if (!snap || !quote) {
      setError('No executable quote for this stake.');
      return;
    }
    if (locking) {
      setError('Window is locking — wait for the next one.');
      return;
    }
    if (needsGas) {
      setError('This wallet has no STT for gas on Somnia Shannon. Get some from the Somnia faucet first.');
      return;
    }

    setError(null);
    setLastRecord(null);
    setIsPending(true);

    const base: TradeExecutionRecord = {
      id: `${Date.now()}-${quote.direction}`,
      kind: 'OPEN',
      marketId: snap.market.marketId,
      direction: quote.direction,
      stake: fmtUsd(quote.maxLoss),
      timeframeSeconds: snap.windowSec,
      entryPrice: snap.livePrice ?? null,
      txHash: '',
      explorerUrl: '',
      status: 'submitted',
      submittedAt: new Date().toISOString(),
      timestamp: Date.now(),
      error: null,
    };
    setLastRecord(base);
    onTradeSubmitted?.(base);

    try {
      ensureSigner();
      const res = await placeStake(snap, quote.direction, numericStake, slippageBps);
      const confirmed: TradeExecutionRecord = {
        ...base,
        stake: fmtUsd(res.quote.maxLoss),
        id: res.hash,
        txHash: res.hash,
        explorerUrl: explorerTxUrl(res.hash),
        status: 'confirmed',
        error: res.fullyFilled ? null : `Partially filled: ${fmtUsd(res.filledShares)} shares`,
      };
      setLastRecord(confirmed);
      onTradeSubmitted?.(confirmed);
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: [DREAM_POSITIONS_KEY] }),
        queryClient.invalidateQueries({ queryKey: [COLLATERAL_BALANCE_KEY] }),
      ]);
    } catch (caughtError: unknown) {
      const message = caughtError instanceof Error ? caughtError.message : 'Trade execution failed';
      const failed: TradeExecutionRecord = { ...base, status: 'failed', error: message };
      setLastRecord(failed);
      onTradeSubmitted?.(failed);
      setError(message);
    } finally {
      setIsPending(false);
    }
  };

  const coreDirection = signal?.direction ?? 'NEUTRAL';
  const coreConfidence = signal?.confidence ?? 0;
  const rationale =
    signal?.rationale ??
    (marketError
      ? 'DreamDEX feed unavailable — retrying.'
      : snap
        ? 'Waiting for the opening price and a live book before pricing this window.'
        : 'Locating the live DreamDEX Up/Down window for this cadence.');

  const pct = (x: number | null | undefined) => (x === null || x === undefined ? '--' : `${(x * 100).toFixed(1)}%`);

  const bestAskFor = (direction: BitdrumDirection) => (direction === 'UP' ? snap?.bestUpAsk : snap?.bestDownAsk) ?? null;

  const formatErrorMessage = (msg: string) => {
    if (!msg) return '';
    if (msg.includes('User rejected') || msg.includes('user rejected')) return 'Order cancelled in wallet';
    if (msg.includes('ImmediateOrCancelNoFill'))
      return 'The book moved before your order landed — no fill, nothing charged. Widen the fill tolerance or confirm faster.';
    if (msg.includes('account does not exist')) return 'Somnia rejected the tx: this wallet has no STT for gas on Shannon. Fund it from the Somnia faucet, then retry.';
    if (msg.toLowerCase().includes('insufficient')) return `Insufficient ${COLLATERAL_SYMBOL} — hit the faucet`;
    return msg.length > 200 ? `${msg.slice(0, 200)}...` : msg;
  };

  const tradeDisabled = isPending || connecting || (authenticated && (!quote || locking || quoteState === 'loading'));

  const ctaLabel = useMemo(() => {
    if (isPending) return 'Routing to DreamDEX...';
    if (!authenticated) return 'Connect Somnia Wallet';
    if (!snap) return 'No live window';
    if (locking) return 'Window locking';
    if (quoteState === 'too-small') return 'Stake too small';
    if (quoteState === 'no-liquidity') return 'No liquidity on this side';
    if (quoteState === 'loading') return 'Pricing...';
    return `Buy ${previewDirection}`;
  }, [authenticated, isPending, locking, previewDirection, quoteState, snap]);

  return (
    <Panel tone="gold" className="surface-lift overflow-hidden p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Eyebrow accent="gold">Command Module</Eyebrow>
          <h3 className="mt-3 font-heading text-[1.85rem] font-semibold tracking-[-0.05em] text-[var(--text-primary)]">
            {snap ? `${snap.asset} ${formatTimeframe(snap.windowSec)} window` : 'Lock a fresh call'}
          </h3>
        </div>
        {secondsLeft !== null ? (
          <span
            className={`rounded-full border px-3 py-1 font-mono text-[0.72rem] tabular-nums tracking-[0.12em] ${
              locking
                ? 'border-[rgba(220,38,38,0.2)] bg-[rgba(220,38,38,0.1)] text-[var(--state-down)] animate-pulse'
                : 'border-[rgba(245,185,66,0.18)] bg-[rgba(245,185,66,0.08)] text-[var(--accent-gold)]'
            }`}
          >
            {locking ? 'LOCKING' : `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, '0')}`}
          </span>
        ) : null}
      </div>

      <div className="mt-6 grid gap-4">
        <div className="rounded-[1.85rem] border border-[rgba(59,130,246,0.16)] bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.12),transparent_42%),linear-gradient(145deg,#0f1218,#0a0d11)] p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Eyebrow accent="core">BitDrum Edge</Eyebrow>
              <h4 className="mt-3 font-heading text-[1.45rem] font-semibold tracking-[-0.04em] text-[var(--text-primary)]">
                Model vs. market
              </h4>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[rgba(34,211,238,0.18)] bg-[rgba(34,211,238,0.08)] px-3 py-1.5 text-[0.66rem] uppercase tracking-[0.26em] text-[var(--accent-cyan)]">
              <Radar className="h-3.5 w-3.5" />
              {signal ? 'Online' : 'Syncing'}
            </div>
          </div>

          <div className="mt-4 rounded-[1.45rem] border border-[rgba(59,130,246,0.14)] bg-[rgba(59,130,246,0.04)] p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5 text-[0.62rem] font-bold uppercase tracking-[0.24em] text-[var(--accent-cyan)]">
                <Radar className="h-3.5 w-3.5" />
                Edge Intel
              </div>
              <div
                className={`rounded-full border px-3 py-1 text-[0.68rem] font-black uppercase tracking-[0.16em] ${
                  coreDirection === 'UP'
                    ? 'text-[var(--state-up)] border-[var(--state-up)]/20 bg-[var(--state-up)]/5'
                    : coreDirection === 'DOWN'
                      ? 'text-[var(--state-down)] border-[var(--state-down)]/20 bg-[var(--state-down)]/5'
                      : 'text-[var(--text-secondary)] border-[color:var(--border-subtle)] bg-[rgba(255,255,255,0.03)]'
                }`}
              >
                {coreDirection} {coreDirection === 'NEUTRAL' ? '' : `${coreConfidence}%`}
              </div>
            </div>
            <p className="mt-4 text-[0.88rem] leading-6 text-[var(--text-secondary)]">{rationale}</p>
            <div className="mt-5 grid grid-cols-3 gap-2">
              {[
                { label: 'Model UP', value: pct(signal?.modelUp), tone: 'text-[var(--accent-core)]' },
                { label: 'Market UP', value: pct(snap?.impliedUp), tone: 'text-[var(--accent-gold)]' },
                {
                  label: 'Edge',
                  value: signal?.edge === null || signal?.edge === undefined ? '--' : `${signal.edge >= 0 ? '+' : ''}${(signal.edge * 100).toFixed(1)}%`,
                  tone: coreDirection === 'UP' ? 'text-[var(--state-up)]' : coreDirection === 'DOWN' ? 'text-[var(--state-down)]' : 'text-[var(--text-secondary)]',
                },
              ].map((item) => (
                <div key={item.label} className="rounded-[1rem] border border-[color:var(--border-subtle)] bg-[rgba(255,255,255,0.03)] px-3 py-2.5 text-center">
                  <div className="text-[0.55rem] uppercase tracking-[0.2em] text-[var(--text-muted)]">{item.label}</div>
                  <div className={`mt-1 font-mono text-[0.95rem] font-semibold tabular-nums ${item.tone}`}>{item.value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {([60, 300] as CadenceSec[]).map((seconds) => (
            <button
              key={seconds}
              onClick={() => onCadenceChange(seconds)}
              className={`rounded-full border px-4 py-3 text-[0.7rem] uppercase tracking-[0.28em] transition ${
                cadence === seconds
                  ? 'border-[rgba(245,185,66,0.24)] bg-[rgba(245,185,66,0.08)] text-[var(--accent-gold)]'
                  : 'border-[color:var(--border-subtle)] bg-[rgba(255,255,255,0.03)] text-[var(--text-secondary)]'
              }`}
            >
              {formatTimeframe(seconds)}
            </button>
          ))}
        </div>
        {snap && !snap.book.yesAsks.length && !snap.book.noAsks.length ? (
          <p className="-mt-1 px-1 text-[0.72rem] leading-6 text-[var(--text-muted)]">
            No resting liquidity in this window yet — the testnet market maker mostly quotes 5m. Edge still prices it; switch cadence to trade.
          </p>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-[1fr_1fr]">
          <label className="rounded-[1.45rem] border border-[color:var(--border-subtle)] bg-[rgba(255,255,255,0.03)] p-4">
            <span className="text-[0.68rem] uppercase tracking-[0.3em] text-[var(--text-muted)]">Stake</span>
            <div className="mt-3 flex items-end justify-between gap-4">
              <input
                value={stake}
                inputMode="decimal"
                onChange={(event) => setStake(event.target.value)}
                className="w-full bg-transparent font-mono text-3xl font-semibold text-[var(--text-primary)] outline-none"
              />
              <span className="pb-1 text-sm text-[var(--text-secondary)]">{COLLATERAL_SYMBOL}</span>
            </div>
          </label>

          <div className="rounded-[1.45rem] border border-[color:var(--border-subtle)] bg-[rgba(255,255,255,0.03)] p-4">
            <span className="text-[0.68rem] uppercase tracking-[0.3em] text-[var(--text-muted)]">Wallet</span>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <StatPill label="Mode" value={authenticated ? 'Connected' : 'Offline'} accent={authenticated ? 'success' : 'neutral'} />
              {gas !== null ? <StatPill label="Gas" value={`${gas.toFixed(3)} STT`} accent={needsGas ? 'danger' : 'neutral'} /> : null}
              {balance !== null ? <StatPill label="Balance" value={`${fmtUsd(balance)} ${COLLATERAL_SYMBOL}`} accent="neutral" /> : null}
              {authenticated ? (
                <button
                  onClick={() => void handleFaucet()}
                  disabled={isFauceting}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(34,211,238,0.18)] bg-[rgba(34,211,238,0.08)] px-3 py-1.5 text-[0.62rem] uppercase tracking-[0.22em] text-[var(--accent-cyan)] transition hover:bg-[rgba(34,211,238,0.16)] disabled:opacity-50"
                >
                  {isFauceting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Droplets className="h-3 w-3" />}
                  Faucet
                </button>
              ) : null}
            </div>
          </div>
        </div>

        {needsGas ? (
          <div className="rounded-[1.4rem] border border-[rgba(245,185,66,0.25)] bg-[rgba(245,185,66,0.08)] px-4 py-3 text-[0.8rem] leading-6 text-[var(--text-primary)]">
            No STT for gas — Somnia won&apos;t accept a transaction from an unfunded account.{' '}
            <a href="https://testnet.somnia.network/" target="_blank" rel="noopener noreferrer" className="underline text-[var(--accent-gold)]">
              Get Shannon STT from the Somnia faucet
            </a>
            , then come back for TestUSDC.
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-4">
          {(['UP', 'DOWN'] as BitdrumDirection[]).map((direction) => {
            const active = previewDirection === direction;
            const isUp = direction === 'UP';
            const ask = bestAskFor(direction);
            return (
              <button
                key={direction}
                onClick={() => setPreviewDirection(direction)}
                className={`cta-press rounded-[2rem] border px-6 py-7 text-left transition-all duration-300 ${
                  active
                    ? isUp
                      ? 'border-[rgba(22,163,74,0.4)] bg-[radial-gradient(circle_at_top,rgba(22,163,74,0.18),transparent_60%),rgba(22,163,74,0.08)] shadow-[0_0_24px_rgba(22,163,74,0.16)]'
                      : 'border-[rgba(220,38,38,0.4)] bg-[radial-gradient(circle_at_top,rgba(220,38,38,0.18),transparent_60%),rgba(220,38,38,0.08)] shadow-[0_0_24px_rgba(220,38,38,0.14)]'
                    : 'border-[color:var(--border-subtle)] bg-[rgba(255,255,255,0.03)] hover:border-[rgba(255,255,255,0.12)] hover:bg-[rgba(255,255,255,0.05)]'
                }`}
              >
                <div className="text-[0.62rem] font-bold uppercase tracking-[0.24em] text-[var(--text-muted)] opacity-80">
                  {isUp ? 'Closes above open' : 'Closes below open'}
                </div>
                <div className={`mt-3 font-heading text-4xl font-bold tracking-tight ${isUp ? 'text-[var(--state-up)]' : 'text-[var(--state-down)]'}`}>
                  {direction}
                </div>
                <div className="mt-3 font-mono text-[0.78rem] text-[var(--text-secondary)]">
                  {ask === null ? 'no asks' : `${ask.toFixed(3)}¢ · pays ${(1 / ask).toFixed(2)}x`}
                </div>
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2 px-1">
          <span className="text-[0.58rem] uppercase tracking-[0.24em] text-[var(--text-muted)]">Fill tolerance</span>
          {TOLERANCES.map((t) => (
            <button
              key={t.label}
              onClick={() => setSlippageBps(t.bps)}
              title={t.hint}
              className={`rounded-full border px-3 py-1 text-[0.62rem] uppercase tracking-[0.2em] transition ${
                slippageBps === t.bps
                  ? 'border-[rgba(245,185,66,0.24)] bg-[rgba(245,185,66,0.08)] text-[var(--accent-gold)]'
                  : 'border-[color:var(--border-subtle)] bg-[rgba(255,255,255,0.03)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <button
          onClick={() => (authenticated ? void handleTrade() : void handleConnect())}
          disabled={tradeDisabled}
          className="cta-press relative mt-2 flex w-full items-center justify-between overflow-hidden rounded-[2rem] border border-[rgba(245,185,66,0.3)] bg-[linear-gradient(135deg,var(--accent-gold),#d97706)] px-8 py-7 text-left text-[#140c00] shadow-[0_18px_48px_rgba(245,185,66,0.15)] transition-all hover:-translate-y-0.5 hover:shadow-[0_24px_64px_rgba(245,185,66,0.22)] disabled:cursor-not-allowed disabled:opacity-65"
        >
          <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.2),transparent)] -translate-x-full animate-[shimmer_2s_infinite]" />
          <div className="relative">
            <div className="text-[0.62rem] font-black uppercase tracking-[0.3em] text-[#4d3300] opacity-60">
              {authenticated ? 'DreamDEX Event Contract · IOC' : 'Security layer'}
            </div>
            <div className="mt-2 font-heading text-2xl font-bold tracking-tight">{ctaLabel}</div>
          </div>
          <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-black/10">
            {isPending || connecting ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : authenticated ? (
              <ArrowUpRight className="h-6 w-6" />
            ) : (
              <Wallet className="h-6 w-6" />
            )}
          </div>
        </button>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-[1.4rem] border border-[color:var(--border-subtle)] bg-[rgba(255,255,255,0.02)] p-4 text-center">
            <div className="text-[0.58rem] font-bold uppercase tracking-[0.24em] text-[var(--text-muted)]">Payout if win</div>
            <div className="mt-3 font-heading text-xl font-bold text-[var(--state-up)]">
              {quote ? fmtUsd(quote.payoutIfWin) : '--'}
              <span className="ml-1 text-[0.6rem] font-medium opacity-50">{COLLATERAL_SYMBOL}</span>
            </div>
            {quote ? (
              <div className="mt-1 font-mono text-[0.62rem] text-[var(--text-muted)]">+{(quote.profitMultiple * 100).toFixed(0)}%</div>
            ) : null}
          </div>
          <div className="rounded-[1.4rem] border border-[rgba(220,38,38,0.14)] bg-[rgba(220,38,38,0.06)] p-4 text-center">
            <div className="text-[0.58rem] font-bold uppercase tracking-[0.24em] text-[var(--state-down)]">Max loss</div>
            <div className="mt-3 font-heading text-xl font-bold text-[var(--text-primary)]">
              {quote ? fmtUsd(quote.maxLoss) : '--'}
              <span className="ml-1 text-[0.6rem] font-medium opacity-50">{COLLATERAL_SYMBOL}</span>
            </div>
            {quote ? (
              <div className="mt-1 font-mono text-[0.62rem] text-[var(--text-muted)]">worst {quote.limitPrice.toFixed(3)}¢</div>
            ) : null}
          </div>
          <div className="rounded-[1.4rem] border border-[rgba(59,130,246,0.14)] bg-[rgba(59,130,246,0.06)] p-4 text-center">
            <div className="text-[0.58rem] font-bold uppercase tracking-[0.24em] text-[var(--accent-core)]">Open</div>
            <div className="mt-3 font-heading text-xl font-bold text-[var(--text-primary)]">
              {snap?.openingPrice ? `$${fmtUsd(snap.openingPrice)}` : '--'}
            </div>
            {snap ? (
              <div className="mt-1 font-mono text-[0.62rem] text-[var(--text-muted)]">
                {snap.market.mode === 'reference' ? 'oracle open' : 'strike at open'}
              </div>
            ) : null}
          </div>
        </div>

        {error ? (
          <div className="overflow-hidden rounded-[1.4rem] border border-[rgba(220,38,38,0.22)] bg-[rgba(220,38,38,0.1)] px-4 py-4 text-sm text-[var(--text-primary)] break-words">
            {formatErrorMessage(error)}
          </div>
        ) : null}

        {lastRecord ? (
          <div className="rounded-[1.4rem] border border-[color:var(--border-subtle)] bg-[rgba(255,255,255,0.03)] px-4 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[0.68rem] uppercase tracking-[0.3em] text-[var(--text-muted)]">Latest order</p>
                <p className="mt-2 text-sm text-[var(--text-primary)]">
                  {lastRecord.direction} · {lastRecord.stake} {COLLATERAL_SYMBOL} · {formatTimeframe(lastRecord.timeframeSeconds)}
                </p>
                {lastRecord.error && lastRecord.status === 'confirmed' ? (
                  <p className="mt-1 text-[0.72rem] text-[var(--accent-gold)]">{lastRecord.error}</p>
                ) : null}
              </div>
              <span
                className={`rounded-full border px-3 py-1 text-[0.66rem] uppercase tracking-[0.24em] ${
                  lastRecord.status === 'confirmed'
                    ? 'border-[rgba(22,163,74,0.22)] bg-[rgba(22,163,74,0.08)] text-[var(--state-up)]'
                    : lastRecord.status === 'failed'
                      ? 'border-[rgba(220,38,38,0.22)] bg-[rgba(220,38,38,0.1)] text-[var(--state-down)]'
                      : 'border-[rgba(245,185,66,0.18)] bg-[rgba(245,185,66,0.08)] text-[var(--accent-gold)]'
                }`}
              >
                {lastRecord.status === 'confirmed' ? 'filled' : lastRecord.status}
              </span>
            </div>
            {lastRecord.explorerUrl ? (
              <a
                href={lastRecord.explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex items-center gap-2 text-[0.68rem] uppercase tracking-[0.24em] text-[var(--text-secondary)] transition hover:text-[var(--text-primary)]"
              >
                View transaction
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            ) : null}
          </div>
        ) : null}

        {!authenticated ? (
          <button
            onClick={() => void handleConnect()}
            disabled={connecting}
            className="cta-press inline-flex items-center justify-center gap-3 rounded-full border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.03)] px-5 py-3 text-sm text-[var(--text-primary)] transition hover:border-[rgba(245,185,66,0.18)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ShieldCheck className="h-4 w-4 text-[var(--accent-gold)]" />
            {connecting ? 'Connecting wallet...' : 'Connect wallet to arm the module'}
          </button>
        ) : null}
      </div>
    </Panel>
  );
};
