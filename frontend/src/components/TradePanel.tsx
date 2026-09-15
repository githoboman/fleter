'use client';

import React, { useState } from 'react';
import { ArrowUpRight, ArrowDownRight, Loader2, Wallet } from 'lucide-react';
import { useBotremTrade } from '../hooks/useBotremTrade';
import { useAccount } from 'wagmi';
import { type BotremDirection, type TradeExecutionRecord } from '../utils/botrem';
import { Panel } from './ObsidianPrimitives';

export const TradePanel = ({
  cadence,
  onCadenceChange,
  onTradeSubmitted,
}: {
  cadence: 60 | 300;
  onCadenceChange: (cadence: 60 | 300) => void;
  onTradeSubmitted?: (record: TradeExecutionRecord) => void;
}) => {
  const { isConnected } = useAccount();
  const { openMarket, isPending, isConfirming, isConfirmed, hash } = useBotremTrade();

  const [stake, setStake] = useState('5');
  const [error, setError] = useState<string | null>(null);

  const numericStake = Number(stake || '0');
  const stakeValid = Number.isFinite(numericStake) && numericStake > 0;

  const handleTrade = async (direction: BotremDirection) => {
    if (!isConnected) {
      setError('Connect your wallet first.');
      return;
    }
    if (!stakeValid) {
      setError('Enter a valid stake amount.');
      return;
    }

    setError(null);
    const dirCode = direction === 'UP' ? 0 : 1;
    
    const base: TradeExecutionRecord = {
      id: `${Date.now()}-${direction}`,
      kind: 'OPEN',
      marketId: 'pending',
      direction,
      stake,
      timeframeSeconds: cadence,
      entryPrice: null,
      txHash: '',
      explorerUrl: '',
      status: 'submitted',
      submittedAt: new Date().toISOString(),
      timestamp: Date.now(),
      error: null,
    };
    onTradeSubmitted?.(base);

    try {
      const txHash = await openMarket(dirCode, stake, cadence);
      
      const confirmed: TradeExecutionRecord = {
        ...base,
        txHash: txHash,
        explorerUrl: `https://scan.bohr.life/tx/${txHash}`,
        status: 'confirmed',
      };
      onTradeSubmitted?.(confirmed);
    } catch (caughtError: unknown) {
      const message = caughtError instanceof Error ? caughtError.message : 'Trade execution failed';
      const failed: TradeExecutionRecord = { ...base, status: 'failed', error: message };
      onTradeSubmitted?.(failed);
      setError(message);
    }
  };

  return (
    <Panel className="surface-lift flex h-full flex-col p-5 sm:p-6">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="font-heading text-lg font-bold tracking-tight text-[var(--text-primary)]">Trade</h2>
        <div className="flex gap-2">
          <button
            onClick={() => onCadenceChange(60)}
            className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-widest transition-colors ${cadence === 60 ? 'border-[var(--accent-gold)] text-[var(--accent-gold)] bg-[rgba(245,185,66,0.1)]' : 'border-[var(--border-subtle)] text-[var(--text-muted)] hover:border-[var(--text-secondary)]'}`}
          >
            1m
          </button>
          <button
            onClick={() => onCadenceChange(300)}
            className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-widest transition-colors ${cadence === 300 ? 'border-[var(--accent-gold)] text-[var(--accent-gold)] bg-[rgba(245,185,66,0.1)]' : 'border-[var(--border-subtle)] text-[var(--text-muted)] hover:border-[var(--text-secondary)]'}`}
          >
            5m
          </button>
        </div>
      </div>

      <div className="flex-1 space-y-5">
        <div>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-widest text-[var(--text-secondary)]">Stake (BOT)</label>
          <div className="relative">
            <input
              type="number"
              value={stake}
              onChange={(e) => setStake(e.target.value)}
              className="w-full rounded-2xl border border-[var(--border-subtle)] bg-[rgba(255,255,255,0.03)] p-4 text-2xl font-mono font-bold text-[var(--text-primary)] outline-none transition focus:border-[var(--accent-gold)] focus:bg-[rgba(255,255,255,0.05)]"
              placeholder="0.0"
              disabled={isPending || isConfirming}
            />
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-[rgba(220,38,38,0.2)] bg-[rgba(220,38,38,0.1)] p-3 text-sm text-[var(--state-down)]">
            {error}
          </div>
        )}
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3">
        <button
          onClick={() => handleTrade('UP')}
          disabled={!stakeValid || isPending || isConfirming || !isConnected}
          className="group relative flex items-center justify-center gap-2 overflow-hidden rounded-2xl border border-[rgba(22,163,74,0.3)] bg-[rgba(22,163,74,0.1)] p-4 transition-all hover:bg-[rgba(22,163,74,0.2)] disabled:opacity-50"
        >
          {isPending ? <Loader2 className="h-5 w-5 animate-spin text-[var(--state-up)]" /> : <ArrowUpRight className="h-5 w-5 text-[var(--state-up)] transition-transform group-hover:-translate-y-1 group-hover:translate-x-1" />}
          <span className="font-heading text-lg font-bold text-[var(--state-up)]">UP</span>
        </button>
        
        <button
          onClick={() => handleTrade('DOWN')}
          disabled={!stakeValid || isPending || isConfirming || !isConnected}
          className="group relative flex items-center justify-center gap-2 overflow-hidden rounded-2xl border border-[rgba(220,38,38,0.3)] bg-[rgba(220,38,38,0.1)] p-4 transition-all hover:bg-[rgba(220,38,38,0.2)] disabled:opacity-50"
        >
          {isPending ? <Loader2 className="h-5 w-5 animate-spin text-[var(--state-down)]" /> : <ArrowDownRight className="h-5 w-5 text-[var(--state-down)] transition-transform group-hover:translate-x-1 group-hover:translate-y-1" />}
          <span className="font-heading text-lg font-bold text-[var(--state-down)]">DOWN</span>
        </button>
      </div>
      
      {!isConnected && (
        <div className="mt-4 flex justify-center">
          <p className="text-sm text-[var(--text-muted)] flex items-center gap-2"><Wallet className="w-4 h-4" /> Please connect wallet to trade</p>
        </div>
      )}
    </Panel>
  );
};
