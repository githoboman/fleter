'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutGrid, Radar, Wallet } from 'lucide-react';
import { BrandMark, Eyebrow, Panel } from './ObsidianPrimitives';
import { useBitdrumWallet } from './BitdrumWalletProvider';
import { shortAddress } from '../utils/bitdrum';
import { useCollateralBalance } from '../hooks/useCollateralBalance';
import { COLLATERAL_SYMBOL } from '../lib/dreamdex/client';

const navItems = [
  { href: '/arena', label: 'Arena', icon: LayoutGrid },
  { href: '/signals', label: 'Edge', icon: Radar },
  { href: '/portfolio', label: 'Portfolio', icon: Wallet },
];

export function AppShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { authenticated, address, connect, connecting, error: walletError } = useBitdrumWallet();
  const { balance } = useCollateralBalance(address);

  return (
    <div className="mx-auto max-w-[1520px] px-4 py-8 sm:px-6 lg:px-8">
      <div className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="min-w-0 xl:sticky xl:top-6 xl:h-fit">
          <Panel className="surface-lift p-5 sm:p-6">
            <Link href="/">
              <BrandMark />
            </Link>

            <div className="mt-10 space-y-3">
              {navItems.map((item) => {
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 rounded-[1.35rem] border px-4 py-3 transition ${
                      active
                        ? 'border-[rgba(245,185,66,0.2)] bg-[rgba(245,185,66,0.08)] text-[var(--text-primary)]'
                        : 'border-[color:var(--border-subtle)] bg-[rgba(255,255,255,0.03)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    <item.icon className="h-4 w-4" />
                    <span className="text-sm">{item.label}</span>
                  </Link>
                );
              })}
            </div>

            <Panel className="mt-8 p-5">
              <Eyebrow accent="gold">Session</Eyebrow>
              <p className="mt-4 text-sm leading-7 text-[var(--text-secondary)]">
                {authenticated ? shortAddress(address || '') : 'Connect your Somnia wallet to trade DreamDEX windows, redeem, and track your edge.'}
              </p>
              {authenticated && balance !== null && (
                <div className="mt-2 text-sm font-semibold text-[var(--accent-gold)]">
                  {balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {COLLATERAL_SYMBOL}
                </div>
              )}
              {walletError && !authenticated ? (
                <p className="mt-3 text-[0.75rem] leading-5 text-[var(--state-down)] break-words">{walletError}</p>
              ) : null}
              {!authenticated ? (
                <button
                  onClick={() => void connect().catch(() => {})}
                  disabled={connecting}
                  className="cta-press mt-5 rounded-full bg-[linear-gradient(135deg,var(--accent-gold),#d97706)] px-4 py-2 text-sm text-[#140c00] disabled:opacity-60"
                >
                  {connecting ? 'Connecting...' : 'Connect Wallet'}
                </button>
              ) : null}
            </Panel>
          </Panel>
        </aside>

        <main className="min-w-0">
          <Panel className="mb-6 p-5 sm:p-6">
            <Eyebrow accent="gold">BitDrum App</Eyebrow>
            <h1 className="mt-3 font-heading text-[clamp(2.2rem,4vw,4.2rem)] font-semibold leading-[0.92] tracking-[-0.06em] text-[var(--text-primary)]">
              {title}
            </h1>
            <p className="mt-4 max-w-3xl text-[1rem] leading-8 text-[var(--text-secondary)]">{description}</p>
          </Panel>

          {children}
        </main>
      </div>
    </div>
  );
}
