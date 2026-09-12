'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BellRing, X } from 'lucide-react';
import { toHuman } from '@somnia-chain/markets-sdk';
import { PriceChart, type TradeMarker } from './PriceChart';
import { TradePanel } from './TradePanel';
import { DreamPositionsList } from './DreamPositions';
import { useBitdrumWallet } from './BitdrumWalletProvider';
import { Eyebrow, Panel, StatPill } from './ObsidianPrimitives';
import { useUpDownMarket } from '../hooks/useUpDownMarket';
import { useDreamPositions } from '../hooks/useDreamPositions';
import { useCollateralBalance } from '../hooks/useCollateralBalance';
import { COLLATERAL_SYMBOL } from '../lib/dreamdex/client';
import type { Asset, CadenceSec, UpDownSnapshot } from '../lib/dreamdex/markets';
import { formatTimeframe, type TradeExecutionRecord } from '../utils/bitdrum';

const ASSETS: Asset[] = ['BTC', 'ETH'];

const fmt = (n: number | null | undefined, digits = 2) =>
  n === null || n === undefined ? '--' : n.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });

type BookLevel = { price: number; qty: number };

function BookSide({ title, levels, up, maxQty }: { title: string; levels: BookLevel[]; up: boolean; maxQty: number }) {
  return (
    <div className="min-w-0">
      <div className={`text-[0.62rem] font-bold uppercase tracking-[0.24em] ${up ? 'text-[var(--state-up)]' : 'text-[var(--state-down)]'}`}>{title}</div>
      <div className="mt-3 grid gap-1.5">
        {levels.length ? (
          levels.map((l, i) => (
            <div key={i} className="relative overflow-hidden rounded-lg px-3 py-1.5 font-mono text-[0.78rem] tabular-nums">
              <div
                className="absolute inset-y-0 left-0 opacity-15"
                style={{ width: `${(l.qty / maxQty) * 100}%`, background: up ? 'var(--state-up)' : 'var(--state-down)' }}
              />
              <div className="relative flex justify-between">
                <span className="text-[var(--text-primary)]">{l.price.toFixed(3)}¢</span>
                <span className="text-[var(--text-secondary)]">{fmt(l.qty, 0)}</span>
              </div>
            </div>
          ))
        ) : (
          <p className="px-3 py-2 text-[0.72rem] text-[var(--text-muted)]">no asks</p>
        )}
      </div>
    </div>
  );
}

/** Top-of-book for the live window: what the market is pricing UP and DOWN at. */
function WindowBook({ snap }: { snap: UpDownSnapshot | null }) {
  if (!snap) {
    return (
      <p className="py-10 text-center text-[0.68rem] uppercase tracking-[0.34em] text-[var(--text-muted)]">
        Locating live DreamDEX window...
      </p>
    );
  }
  const dec = snap.quoteDecimals;
  const rows = (levels: { price: bigint; quantity: bigint }[]) =>
    levels.slice(0, 5).map((l) => ({ price: toHuman(l.price, dec), qty: toHuman(l.quantity, dec) }));
  const upAsks = rows(snap.book.yesAsks);
  const downAsks = rows(snap.book.noAsks);
  const maxQty = Math.max(1, ...upAsks.map((r) => r.qty), ...downAsks.map((r) => r.qty));

  return (
    <Panel className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Eyebrow accent="core">Live window book</Eyebrow>
          <p className="mt-2 font-heading text-lg tracking-tight text-[var(--text-primary)]">
            {snap.asset} {formatTimeframe(snap.windowSec)} · expires {new Date(Number(snap.market.expiry) * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatPill label="Implied UP" value={snap.impliedUp === null ? '--' : `${(snap.impliedUp * 100).toFixed(1)}%`} accent="core" />
          <StatPill label="Spread" value={snap.spread === null ? '--' : `${(snap.spread * 100).toFixed(1)}¢`} accent="neutral" />
          <StatPill label="Mode" value={snap.market.mode} accent="neutral" />
        </div>
      </div>
      <div className="mt-5 grid gap-6 sm:grid-cols-2">
        <BookSide title="Buy UP (YES asks)" levels={upAsks} up maxQty={maxQty} />
        <BookSide title="Buy DOWN (NO asks)" levels={downAsks} up={false} maxQty={maxQty} />
      </div>
      <p className="mt-4 text-[0.72rem] leading-6 text-[var(--text-muted)]">
        Prices are collateral per share; a share pays 1 {COLLATERAL_SYMBOL} if its side wins. Orders expire with the window.
      </p>
    </Panel>
  );
}

export const TradingDashboard = () => {
  const { address, username, authenticated, error: walletError, connect, disconnect, openProfile } = useBitdrumWallet();

  const [asset, setAsset] = useState<Asset>('BTC');
  const [cadence, setCadence] = useState<CadenceSec>(300);
  const { snap, signal, error: marketError } = useUpDownMarket(asset, cadence);
  const { positions } = useDreamPositions(address);
  const { balance } = useCollateralBalance(address);

  const [showAccount, setShowAccount] = useState(false);
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [pendingTrades, setPendingTrades] = useState<TradeExecutionRecord[]>([]);
  const [selectedTab, setSelectedTab] = useState<'book' | 'positions'>('book');
  const [toast, setToast] = useState<{ title: string; message: string; tone: 'up' | 'gold' } | null>(null);
  const seenWins = useRef<Set<string> | null>(null);

  // Pop a toast the first time a position flips to WIN after mount.
  const winKeys = useMemo(() => positions.filter((p) => p.status === 'WIN').map((p) => p.key).join('|'), [positions]);
  useEffect(() => {
    if (seenWins.current === null) {
      if (!positions.length) return;
      seenWins.current = new Set(winKeys ? winKeys.split('|') : []);
      return;
    }
    const fresh = positions.find((p) => p.status === 'WIN' && !seenWins.current!.has(p.key));
    if (!fresh) return;
    seenWins.current.add(fresh.key);
    const id = setTimeout(() => {
      setToast({
        title: 'You called it',
        message: `${fresh.direction} on ${fresh.asset} settled in your favour — redeem ${fmt(fresh.claimable?.estPayout ?? fresh.shares)} ${COLLATERAL_SYMBOL}.`,
        tone: 'gold',
      });
      setSelectedTab('positions');
    }, 0);
    return () => clearTimeout(id);
  }, [winKeys, positions]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(id);
  }, [toast]);

  const liveCount = positions.filter((p) => p.status === 'LIVE' || p.status === 'SETTLING').length;
  const claimableTotal = positions.reduce((s, p) => s + (p.claimable?.estPayout ?? 0), 0);
  const markPnl = positions.reduce((s, p) => s + (p.status === 'LIVE' ? p.unrealizedPnl ?? 0 : 0), 0);

  const tradeMarkers = useMemo<TradeMarker[]>(
    () =>
      pendingTrades
        .filter((t) => t.status !== 'failed' && t.entryPrice)
        .map((t) => ({
          time: Math.floor(new Date(t.submittedAt).getTime() / 1000),
          price: t.entryPrice as number,
          direction: t.direction,
          label: `${t.direction} ${t.stake} ${COLLATERAL_SYMBOL}`,
        })),
    [pendingTrades],
  );

  const handleTradeSubmitted = (record: TradeExecutionRecord) => {
    if (record.status === 'confirmed') {
      setToast({ title: 'Order filled', message: `${record.direction} · ${record.stake} ${COLLATERAL_SYMBOL} routed to DreamDEX`, tone: 'up' });
    }
    setPendingTrades((previous) => {
      const idx = previous.findIndex((t) => t.id === record.id || (record.txHash && t.txHash === record.txHash) || (t.status === 'submitted' && t.submittedAt === record.submittedAt));
      if (idx >= 0) {
        const updated = [...previous];
        updated[idx] = record;
        return updated.slice(0, 8);
      }
      return [record, ...previous].slice(0, 8);
    });
  };

  const handleAuth = async () => {
    if (authenticated) {
      setShowAccount(true);
      return;
    }
    try {
      await connect();
      setShowAccount(true);
    } catch {
      // provider surfaces the error
    }
  };

  const handleDisconnect = async () => {
    await disconnect();
    setShowAccount(false);
  };

  return (
    <div id="live-markets" className="relative">
      {toast && (
        <div className="fixed bottom-6 right-6 z-[100] animate-in slide-in-from-bottom-5 fade-in duration-300">
          <div
            className={`max-w-[calc(100vw-2rem)] rounded-[1rem] border bg-[rgba(10,10,10,0.95)] px-5 py-4 backdrop-blur-xl ${
              toast.tone === 'gold'
                ? 'border-[rgba(245,185,66,0.3)] shadow-[0_8px_32px_rgba(245,185,66,0.15)]'
                : 'border-[rgba(22,163,74,0.3)] shadow-[0_8px_32px_rgba(22,163,74,0.15)]'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`flex h-8 w-8 items-center justify-center rounded-full ${toast.tone === 'gold' ? 'bg-[rgba(245,185,66,0.1)]' : 'bg-[rgba(22,163,74,0.1)]'}`}>
                <BellRing className={`h-4 w-4 ${toast.tone === 'gold' ? 'text-[var(--accent-gold)]' : 'text-[var(--state-up)]'}`} />
              </div>
              <div className="min-w-0">
                <p className={`text-[0.68rem] font-bold uppercase tracking-[0.2em] ${toast.tone === 'gold' ? 'text-[var(--accent-gold)]' : 'text-[var(--state-up)]'}`}>{toast.title}</p>
                <p className="font-heading text-sm text-[var(--text-primary)] break-words">{toast.message}</p>
              </div>
              <button onClick={() => setToast(null)} className="ml-4 rounded-full p-1 text-[var(--text-muted)] hover:bg-[rgba(255,255,255,0.05)] hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {showAccount ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4 backdrop-blur-md">
          <Panel className="w-full max-w-2xl p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <Eyebrow accent="gold">Wallet Session</Eyebrow>
                <h2 className="mt-3 font-heading text-4xl font-semibold tracking-[-0.05em] text-[var(--text-primary)]">
                  Somnia execution profile
                </h2>
              </div>
              <button onClick={() => setShowAccount(false)} className="rounded-full border border-[color:var(--border-subtle)] bg-[rgba(255,255,255,0.03)] p-2 text-[var(--text-secondary)]">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-8 grid gap-4 lg:grid-cols-2">
              <Panel className="p-5">
                <Eyebrow accent="neutral">Label</Eyebrow>
                <p className="mt-4 font-heading text-2xl tracking-[-0.04em] text-[var(--text-primary)]">{username || 'Injected Wallet'}</p>
                <p className="mt-4 font-mono text-sm text-[var(--text-secondary)] break-all">{address || 'Disconnected'}</p>
              </Panel>
              <Panel className="p-5">
                <Eyebrow accent="core">Venue</Eyebrow>
                <p className="mt-4 text-sm leading-7 text-[var(--text-secondary)]">
                  Orders are signed by your wallet and routed to DreamDEX Event Contracts on Somnia Shannon. Collateral is TestUSDC.
                </p>
              </Panel>
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <button onClick={() => void openProfile()} className="cta-press rounded-full bg-[linear-gradient(135deg,var(--accent-gold),#d97706)] px-5 py-3 text-sm text-[#140c00]">
                Open Explorer Profile
              </button>
              <button onClick={() => void handleDisconnect()} className="rounded-full border border-[color:var(--border-subtle)] bg-[rgba(255,255,255,0.03)] px-5 py-3 text-sm text-[var(--text-primary)]">
                Disconnect
              </button>
            </div>
          </Panel>
        </div>
      ) : null}

      <div className={`grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(320px,400px)] ${showAccount ? 'hidden' : ''}`}>
        <section className="flex min-w-0 flex-col gap-6">
          {walletError && (
            <div className="rounded-[1.55rem] border border-[rgba(220,38,38,0.22)] bg-[rgba(220,38,38,0.1)] px-5 py-4 text-sm text-[var(--text-primary)]">{walletError}</div>
          )}
          {marketError && (
            <div className="rounded-[1.55rem] border border-[rgba(245,185,66,0.22)] bg-[rgba(245,185,66,0.08)] px-5 py-4 text-sm text-[var(--text-primary)] break-words">
              DreamDEX feed hiccup — retrying. {marketError}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-4 rounded-[1.65rem] border border-[color:var(--border-subtle)] bg-[rgba(255,255,255,0.02)] px-4 py-4 sm:px-6 backdrop-blur-sm">
            <div className="flex min-w-0 flex-wrap items-center gap-4 sm:gap-6">
              <div className="flex items-center gap-2">
                <div className={`h-2 w-2 rounded-full ${snap ? 'bg-[var(--state-up)] shadow-[0_0_8px_var(--state-up)]' : 'bg-[var(--text-muted)]'}`} />
                <span className="text-[0.68rem] font-bold uppercase tracking-[0.2em] text-[var(--accent-gold)]">{snap ? 'Window Live' : 'Searching'}</span>
              </div>
              <div className="hidden h-4 w-px bg-[color:var(--border-subtle)] sm:block" />
              <div className="flex min-w-0 flex-wrap gap-2 sm:gap-4">
                <StatPill label="Live" value={String(liveCount)} accent="gold" />
                <StatPill label="Mark PnL" value={`${markPnl >= 0 ? '+' : ''}${fmt(markPnl)}`} accent={markPnl >= 0 ? 'success' : 'danger'} />
                {claimableTotal > 0 ? <StatPill label="Redeemable" value={`${fmt(claimableTotal)} ${COLLATERAL_SYMBOL}`} accent="success" /> : null}
                {authenticated && balance !== null ? <StatPill label="Balance" value={`${fmt(balance)} ${COLLATERAL_SYMBOL}`} accent="gold" /> : null}
              </div>
            </div>
            <div className="flex min-w-0 flex-wrap items-center justify-end gap-3 sm:gap-4">
              <button
                onClick={() => void handleAuth()}
                className="rounded-full border border-[rgba(245,185,66,0.3)] bg-[rgba(245,185,66,0.08)] px-3 py-1 text-[0.62rem] uppercase tracking-[0.24em] text-[var(--accent-gold)] transition hover:bg-[var(--accent-gold)] hover:text-black"
              >
                {authenticated ? 'Account' : 'Connect'}
              </button>
              <div className="flex gap-1 rounded-full border border-[color:var(--border-subtle)] bg-[rgba(255,255,255,0.03)] p-1">
                {ASSETS.map((a) => (
                  <button
                    key={a}
                    onClick={() => setAsset(a)}
                    className={`rounded-full px-3 py-1 text-[0.62rem] uppercase tracking-[0.2em] transition ${
                      asset === a ? 'bg-[rgba(245,185,66,0.14)] text-[var(--accent-gold)]' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    {a}
                  </button>
                ))}
              </div>
              <span className="font-mono text-sm font-semibold text-[var(--text-primary)]">
                {asset} {currentPrice ? `$${fmt(currentPrice)}` : '--'}
              </span>
              <div className="rounded-full border border-[rgba(59,130,246,0.18)] bg-[rgba(59,130,246,0.08)] px-3 py-1 text-[0.62rem] uppercase tracking-[0.24em] text-[var(--accent-core)]">
                DreamDEX
              </div>
            </div>
          </div>

          <PriceChart
            asset={asset}
            openingPrice={snap?.openingPrice ?? null}
            tradeMarkers={tradeMarkers}
            recentExecutions={pendingTrades}
            onPriceUpdate={setCurrentPrice}
          />

          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2 border-b border-[color:var(--border-subtle)] pb-2">
              <button
                onClick={() => setSelectedTab('book')}
                className={`px-4 py-2 text-[0.68rem] uppercase tracking-[0.34em] transition ${
                  selectedTab === 'book' ? 'text-[var(--accent-gold)] border-b-2 border-[var(--accent-gold)]' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                }`}
              >
                Window Book
              </button>
              <button
                onClick={() => setSelectedTab('positions')}
                className={`px-4 py-2 text-[0.68rem] uppercase tracking-[0.34em] transition ${
                  selectedTab === 'positions' ? 'text-[var(--accent-gold)] border-b-2 border-[var(--accent-gold)]' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                }`}
              >
                My Positions ({positions.length})
              </button>
            </div>

            {selectedTab === 'book' ? <WindowBook snap={snap} /> : <DreamPositionsList compact limit={12} />}
          </div>
        </section>

        <aside className="flex min-w-0 flex-col gap-6">
          <TradePanel
            snap={snap}
            signal={signal}
            marketError={marketError}
            cadence={cadence}
            onCadenceChange={setCadence}
            onTradeSubmitted={handleTradeSubmitted}
          />
        </aside>
      </div>
    </div>
  );
};
