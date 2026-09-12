'use client';

import { useBitdrumWallet } from './BitdrumWalletProvider';
import { useDreamPositions } from '../hooks/useDreamPositions';
import { useCollateralBalance } from '../hooks/useCollateralBalance';
import { COLLATERAL_SYMBOL } from '../lib/dreamdex/client';
import { DreamPositionsList } from './DreamPositions';
import { Eyebrow, Panel, StatPill } from './ObsidianPrimitives';

const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function PortfolioBoard() {
  const { address, authenticated } = useBitdrumWallet();
  const { positions } = useDreamPositions(address);
  const { balance } = useCollateralBalance(address);

  const settled = positions.filter((p) => p.status === 'WIN' || p.status === 'LOSS');
  const wins = settled.filter((p) => p.status === 'WIN').length;
  const winRate = settled.length ? wins / settled.length : 0;
  const resolvedPnl = settled.reduce(
    (s, p) => s + (p.status === 'WIN' ? (p.claimable?.estPayout ?? p.shares) - p.costBasis : -p.costBasis),
    0,
  );
  const redeemable = positions.reduce((s, p) => s + (p.claimable?.estPayout ?? 0), 0);
  const live = positions.filter((p) => p.status === 'LIVE' || p.status === 'SETTLING').length;

  return (
    <div className="grid gap-6">
      <Panel className="surface-lift p-5 sm:p-6">
        <div className="flex flex-wrap gap-2">
          <StatPill label="Resolved PnL" value={`${resolvedPnl >= 0 ? '+' : ''}${fmt(resolvedPnl)} ${COLLATERAL_SYMBOL}`} accent={resolvedPnl >= 0 ? 'success' : 'danger'} />
          <StatPill label="Win Rate" value={`${(winRate * 100).toFixed(1)}%`} accent="gold" />
          <StatPill label="Live" value={String(live)} accent="core" />
          <StatPill label="Redeemable" value={`${fmt(redeemable)} ${COLLATERAL_SYMBOL}`} accent={redeemable > 0 ? 'success' : 'neutral'} />
          {authenticated && balance !== null ? <StatPill label="Balance" value={`${fmt(balance)} ${COLLATERAL_SYMBOL}`} accent="gold" /> : null}
        </div>
      </Panel>

      <Panel className="surface-lift p-5 sm:p-6">
        <Eyebrow accent="gold">Positions</Eyebrow>
        <h2 className="mt-3 font-heading text-[2rem] font-semibold tracking-[-0.05em] text-[var(--text-primary)]">
          Every call, settlement, and redeem
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--text-secondary)]">
          Holdings are read straight from DreamDEX. Winning shares pay 1 {COLLATERAL_SYMBOL} each once the window resolves — redeem them here.
        </p>
        <div className="mt-6">
          <DreamPositionsList />
        </div>
      </Panel>
    </div>
  );
}
