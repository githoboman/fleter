'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutGrid, Radar, Wallet } from 'lucide-react';
import { BrandMark, Eyebrow, Panel } from './ObsidianPrimitives';
import { useAccount, useConnect, useDisconnect, useBalance } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { formatUnits } from 'viem';
import { shortAddress } from '../utils/botrem';

const COLLATERAL_SYMBOL = 'BOT';

const navItems = [
  { href: '/arena', label: 'Arena', icon: LayoutGrid },
  { href: '/signals', label: 'Edge', icon: Radar },
  { href: '/portfolio', label: 'Portfolio', icon: Wallet },
];

import dynamic from 'next/dynamic';

const LiveCandleBackground = dynamic(
  () => import('./LiveCandleBackground').then(m => m.LiveCandleBackground),
  { ssr: false }
);
const ParticleField = dynamic(
  () => import('./ParticleField').then(m => m.ParticleField),
  { ssr: false }
);

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
  const { address, isConnected } = useAccount();
  const { connect, isPending } = useConnect();
  const [isConnecting, setIsConnecting] = useState(false);

  const handleConnect = async () => {
    if (isConnecting || isPending) return;
    setIsConnecting(true);
    try {
      await connect({ connector: injected() });
    } catch (e) {
      console.warn('Wallet connect error:', e);
    } finally {
      setIsConnecting(false);
    }
  };
  
  const { data: balanceData } = useBalance({
    address,
  });

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[var(--bg-primary)]">
      <LiveCandleBackground />
      <ParticleField />
      
      <div className="relative z-10 mx-auto max-w-[1520px] px-4 py-8 sm:px-6 lg:px-8">
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
                {isConnected ? shortAddress(address || '') : 'Connect your Bot Chain wallet to trade Botrem windows, redeem, and track your edge.'}
              </p>
              {isConnected && balanceData && (
                <div className="mt-2 text-sm font-semibold text-[var(--accent-gold)]">
                  {Number(formatUnits(balanceData.value, balanceData.decimals)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {COLLATERAL_SYMBOL}
                </div>
              )}
              {!isConnected ? (
                <button
                  onClick={handleConnect}
                  disabled={isPending || isConnecting}
                  className="cta-press mt-5 rounded-full bg-[linear-gradient(135deg,var(--accent-gold),#d97706)] px-4 py-2 text-sm text-[#140c00] disabled:opacity-60"
                >
                  {isPending || isConnecting ? 'Connecting...' : 'Connect Wallet'}
                </button>
              ) : null}
            </Panel>
          </Panel>
        </aside>

        <main className="min-w-0">
          <Panel className="mb-6 p-5 sm:p-6">
            <Eyebrow accent="gold">Botrem App</Eyebrow>
            <h1 className="mt-3 font-heading text-[clamp(2.2rem,4vw,4.2rem)] font-semibold leading-[0.92] tracking-[-0.06em] text-[var(--text-primary)]">
              {title}
            </h1>
            <p className="mt-4 max-w-3xl text-[1rem] leading-8 text-[var(--text-secondary)]">{description}</p>
          </Panel>

          {children}
        </main>
      </div>
      </div>
    </div>
  );
}
