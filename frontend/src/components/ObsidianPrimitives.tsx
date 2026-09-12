'use client';

import Image from 'next/image';
import Link from 'next/link';
import { cn } from '@/utils/cn';

export function BrandMark({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <div className="relative flex h-14 w-14 items-center justify-center overflow-hidden rounded-[1.2rem] border border-[color:var(--border-strong)] bg-[radial-gradient(circle_at_30%_30%,rgba(245,185,66,0.12),transparent_45%),linear-gradient(145deg,#0f0f0f,#050505)] shadow-[0_18px_46px_rgba(0,0,0,0.45)]">
        <Image
          src="/logo.png"
          alt="BitDrum logo"
          fill
          sizes="56px"
          className="object-cover"
          priority
        />
      </div>
      {!compact ? (
        <div className="min-w-0">
          <div className="font-heading text-[1.1rem] font-semibold tracking-[-0.04em] text-[var(--text-primary)]">
            BitDrum
          </div>
          <div className="text-[0.68rem] uppercase tracking-[0.34em] text-[var(--text-muted)]">
            Obsidian Core
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function Panel({
  className,
  tone = 'default',
  children,
}: {
  className?: string;
  tone?: 'default' | 'gold' | 'core';
  children: React.ReactNode;
}) {
  const toneClass =
    tone === 'gold'
      ? 'panel-gold'
      : tone === 'core'
        ? 'panel-core'
        : 'panel-surface';

  return <section className={cn('panel-shell', toneClass, className)}>{children}</section>;
}

export function Eyebrow({
  children,
  accent = 'gold',
  className,
}: {
  children: React.ReactNode;
  accent?: 'gold' | 'core' | 'neutral' | 'success' | 'danger';
  className?: string;
}) {
  const tone =
    accent === 'core'
      ? 'text-[var(--accent-core)]'
      : accent === 'neutral'
        ? 'text-[var(--text-muted)]'
        : accent === 'success'
          ? 'text-[var(--state-up)]'
          : accent === 'danger'
            ? 'text-[var(--state-down)]'
            : 'text-[var(--accent-gold)]';

  return (
    <div className={cn('text-[0.68rem] uppercase tracking-[0.34em]', tone, className)}>
      {children}
    </div>
  );
}

export function StatPill({
  label,
  value,
  accent = 'neutral',
}: {
  label: string;
  value: string;
  accent?: 'neutral' | 'gold' | 'core' | 'success' | 'danger';
}) {
  const tone =
    accent === 'gold'
      ? 'border-[rgba(245,185,66,0.18)] bg-[rgba(245,185,66,0.08)] text-[var(--accent-gold)]'
      : accent === 'core'
        ? 'border-[rgba(59,130,246,0.18)] bg-[rgba(59,130,246,0.1)] text-[var(--accent-core)]'
        : accent === 'success'
          ? 'border-[rgba(22,163,74,0.22)] bg-[rgba(22,163,74,0.12)] text-[var(--state-up)]'
          : accent === 'danger'
            ? 'border-[rgba(220,38,38,0.22)] bg-[rgba(220,38,38,0.12)] text-[var(--state-down)]'
            : 'border-[color:var(--border-subtle)] bg-[rgba(255,255,255,0.03)] text-[var(--text-secondary)]';

  return (
    <div className={cn('flex items-center rounded-full border px-3 py-1.5', tone)}>
      <span className="text-[0.6rem] uppercase tracking-[0.16em]">{label}</span>
      <span className="ml-2.5 font-mono text-[0.76rem] font-semibold tracking-tight">{value}</span>
    </div>
  );
}

export function SectionTitle({
  eyebrow,
  title,
  description,
  accent = 'gold',
  className,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  accent?: 'gold' | 'core' | 'neutral';
  className?: string;
}) {
  return (
    <div className={className}>
      <Eyebrow accent={accent}>{eyebrow}</Eyebrow>
      <h2 className="mt-3 font-heading text-[clamp(1.7rem,2vw+1rem,3rem)] font-semibold leading-[0.95] tracking-[-0.05em] text-[var(--text-primary)]">
        {title}
      </h2>
      {description ? (
        <p className="mt-4 max-w-2xl text-[0.98rem] leading-7 text-[var(--text-secondary)]">{description}</p>
      ) : null}
    </div>
  );
}

export function AppLink({
  href,
  children,
  variant = 'primary',
  className,
}: {
  href: string;
  children: React.ReactNode;
  variant?: 'primary' | 'secondary';
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        'inline-flex items-center justify-center rounded-full px-5 py-3 text-sm font-medium tracking-[0.02em] transition duration-300',
        variant === 'primary'
          ? 'bg-[linear-gradient(135deg,var(--accent-gold),#d97706)] text-[#140c00] shadow-[0_0_38px_rgba(245,185,66,0.28)] hover:-translate-y-0.5 hover:shadow-[0_12px_42px_rgba(245,185,66,0.22)]'
          : 'border border-[color:var(--border-strong)] bg-[rgba(255,255,255,0.02)] text-[var(--text-primary)] hover:border-[rgba(245,185,66,0.22)] hover:bg-[rgba(255,255,255,0.05)]',
        className,
      )}
    >
      {children}
    </Link>
  );
}
