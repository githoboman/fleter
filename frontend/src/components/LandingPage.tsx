'use client';

import { ArrowRight, Bot, BrainCircuit, ChevronDown, Radar, Trophy, Waves, Zap } from 'lucide-react';
import { AppLink, BrandMark, Panel, SectionTitle, StatPill } from './ObsidianPrimitives';

const venueFacts = [
  { name: 'Liquidity', detail: 'DreamDEX Up/Down order books', score: 'CLOB', accent: 'gold' as const },
  { name: 'Settlement', detail: 'Somnia oracle, 1 USDC per winning share', score: 'On-chain', accent: 'core' as const },
  { name: 'Revenue', detail: 'Builder fee on every order BitDrum routes', score: 'Per order', accent: 'success' as const },
];

export function LandingPage() {
  return (
    <div className="relative overflow-hidden border-b border-[color:var(--border-subtle)]">
      <div className="landing-grid pointer-events-none absolute inset-0 opacity-60" />
      <div className="pointer-events-none absolute inset-x-0 top-[-10rem] h-[28rem] bg-[radial-gradient(circle_at_top,rgba(245,185,66,0.18),transparent_52%)]" />
      <div className="pointer-events-none absolute right-0 top-[18%] h-[24rem] w-[24rem] rounded-full bg-[radial-gradient(circle,rgba(34,211,238,0.12),transparent_62%)] blur-3xl" />

      <section className="mx-auto grid min-h-[100svh] max-w-[1400px] gap-12 px-6 pb-28 pt-8 lg:grid-cols-[1.1fr_0.9fr] lg:px-10 lg:pt-12">
        <div className="flex flex-col justify-center">
          <BrandMark className="mb-12" />
          <div className="max-w-3xl">
            <p className="mb-5 text-[0.72rem] uppercase tracking-[0.34em] text-[var(--accent-gold)]">
              Signal layer for DreamDEX Event Contracts
            </p>
            <h1 className="font-heading text-[clamp(3.1rem,6vw,6.4rem)] font-semibold leading-[0.9] tracking-[-0.08em] text-[var(--text-primary)]">
              Make the Call.
              <br />
              Beat the Market.
            </h1>
            <p className="mt-7 max-w-2xl text-[1.08rem] leading-8 text-[var(--text-secondary)]">
              One-tap Bitcoin Up/Down calls on DreamDEX, with a fair-value model that tells you when the book is mispriced.
            </p>
            <div className="mt-10 flex flex-wrap gap-4">
              <AppLink href="/arena">Enter App</AppLink>
              <AppLink href="/arena" variant="secondary">
                View Live Markets
              </AppLink>
            </div>
            <div className="mt-10 flex flex-wrap gap-3">
              <StatPill label="Venue" value="DreamDEX" accent="gold" />
              <StatPill label="Signal Layer" value="BitDrum Edge" accent="core" />
              <StatPill label="Windows" value="1m / 5m" />
            </div>
          </div>
        </div>

        <div className="relative flex items-center justify-center">
          <Panel tone="core" className="relative w-full max-w-[36rem] overflow-hidden p-8 lg:p-10">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_34%,rgba(59,130,246,0.18),transparent_38%),radial-gradient(circle_at_50%_80%,rgba(245,185,66,0.1),transparent_46%)]" />
            <div className="pointer-events-none absolute inset-x-8 top-9 h-px bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.16),transparent)]" />
            <div className="relative">
              <div className="mb-8 flex items-center justify-between">
                <div>
                  <p className="text-[0.6rem] font-medium uppercase tracking-[0.2em] text-[var(--accent-core)]">Live Core Pulse</p>
                  <h3 className="mt-3 font-heading text-4xl font-semibold tracking-[-0.05em] text-[var(--text-primary)]">
                    The Core
                  </h3>
                </div>
                <div className="inline-flex items-center gap-2 rounded-full border border-[rgba(34,211,238,0.18)] bg-[rgba(34,211,238,0.08)] px-3 py-1.5 text-[0.68rem] uppercase tracking-[0.26em] text-[var(--accent-cyan)]">
                  <Waves className="h-3.5 w-3.5" />
                  Streaming
                </div>
              </div>

              <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
                <div className="flex items-center justify-center">
                  <div className="core-ring">
                    <div className="core-ring__inner">
                      <span className="text-[0.62rem] font-bold uppercase tracking-[0.24em] text-[var(--accent-cyan)] opacity-80">Bullish</span>
                      <strong className="mt-2.5 font-heading text-6xl font-bold tracking-[-0.04em] text-[var(--text-primary)]">82%</strong>
                      <div className="mt-4 flex gap-1">
                        {Array.from({ length: 3 }).map((_, i) => (
                          <div key={i} className="h-1 w-1 rounded-full bg-[var(--accent-cyan)] opacity-40" />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="space-y-5">
                  <div className="relative overflow-hidden rounded-[2.2rem] border border-[rgba(59,130,246,0.14)] bg-[rgba(59,130,246,0.04)] p-7">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_0%_0%,rgba(59,130,246,0.06),transparent_40%)]" />
                    <div className="relative flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-2 w-2 animate-pulse rounded-full bg-[var(--state-up)] shadow-[0_0_10px_var(--state-up)]" />
                        <span className="text-[0.62rem] font-bold uppercase tracking-[0.28em] text-[var(--accent-core)]">Core Telemetry</span>
                      </div>
                      <span className="text-[0.68rem] font-black uppercase tracking-[0.16em] text-[var(--state-up)]">Bullish Signal</span>
                    </div>
                    <p className="relative mt-6 text-[0.98rem] font-medium leading-[1.7] text-[var(--text-secondary)]">
                      The Core engine is currently detecting a <span className="text-[var(--text-primary)]">dominant long bias</span> fueled by aggressive spot buying and sustained oracle alignment.
                    </p>
                  </div>
                  <div className="metrics-panel flex-row">
                    <div className="metrics-panel__item">
                      <div className="glow-aura" style={{ '--aura-color': 'var(--accent-core)' } as React.CSSProperties} />
                      <div className="relative flex items-center gap-2.5">
                        <Bot className="h-3.5 w-3.5 text-[var(--accent-core)]" />
                        <span className="text-[0.58rem] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">Bias</span>
                      </div>
                      <p className="relative mt-4 font-heading text-2xl font-bold tracking-tight text-[var(--text-primary)]">UP</p>
                      <div className="meter-bar">
                        <div className="meter-bar__fill bg-[var(--accent-core)]" style={{ width: '100%' }} />
                      </div>
                    </div>

                    <div className="metrics-panel__divider" />

                    <div className="metrics-panel__item">
                      <div className="glow-aura" style={{ '--aura-color': 'var(--accent-cyan)' } as React.CSSProperties} />
                      <div className="relative flex items-center gap-2.5">
                        <Radar className="h-3.5 w-3.5 text-[var(--accent-cyan)]" />
                        <span className="text-[0.58rem] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">Conf</span>
                      </div>
                      <p className="relative mt-4 font-heading text-2xl font-bold tracking-tight text-[var(--text-primary)]">82%</p>
                      <div className="meter-bar">
                        <div className="meter-bar__fill bg-[var(--accent-cyan)] shadow-[0_0_8px_var(--accent-cyan)]" style={{ width: '82%' }} />
                      </div>
                    </div>

                    <div className="metrics-panel__divider" />

                    <div className="metrics-panel__item">
                      <div className="glow-aura" style={{ '--aura-color': 'var(--accent-gold)' } as React.CSSProperties} />
                      <div className="relative flex items-center gap-2.5">
                        <Zap className="h-3.5 w-3.5 text-[var(--accent-gold)]" />
                        <span className="text-[0.58rem] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">Edge</span>
                      </div>
                      <p className="relative mt-4 font-heading text-2xl font-bold tracking-tight text-[var(--text-primary)]">+48%</p>
                      <div className="meter-bar">
                        <div className="meter-bar__fill bg-[var(--accent-gold)] shadow-[0_0_8px_var(--accent-gold)]" style={{ width: '48%' }} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Panel>
        </div>

        <a
          href="#how-it-works"
          className="absolute bottom-8 left-1/2 inline-flex -translate-x-1/2 items-center gap-2 rounded-full border border-[rgba(255,255,255,0.1)] bg-[rgba(10,10,10,0.55)] px-4 py-2 text-[0.62rem] uppercase tracking-[0.28em] text-[var(--text-secondary)] backdrop-blur-md transition hover:border-[rgba(245,185,66,0.22)] hover:text-[var(--accent-gold)]"
        >
          Scroll Down
          <ChevronDown className="h-3.5 w-3.5 animate-bounce" />
        </a>
      </section>

      <section id="how-it-works" className="mx-auto max-w-[1400px] scroll-mt-10 px-6 py-24 lg:px-10">
        <SectionTitle
          eyebrow="How It Works"
          title="Three fast decisions. One sharp outcome."
          description="BitDrum is built for traders who want speed, clarity, and conviction without noise."
        />

        <div className="mt-12 grid gap-5 lg:grid-cols-3">
          {[
            { icon: BrainCircuit, title: 'Read the Edge', body: 'BitDrum prices the live window itself and shows you where the DreamDEX book disagrees.' },
            { icon: Zap, title: 'Tap UP or DOWN', body: 'Your stake becomes a market order sized against the live book — payout and max loss shown before you sign.' },
            { icon: Trophy, title: 'Settle and Redeem', body: 'When the window closes the oracle resolves it; winning shares redeem for collateral in one tap.' },
          ].map((item, index) => (
            <Panel key={item.title} className="relative overflow-hidden p-7">
              <div className="absolute right-6 top-5 text-[4rem] font-heading leading-none tracking-[-0.1em] text-white/5">
                0{index + 1}
              </div>
              <item.icon className="h-6 w-6 text-[var(--accent-gold)]" />
              <h3 className="mt-10 font-heading text-[1.45rem] font-semibold tracking-[-0.04em] text-[var(--text-primary)]">
                {item.title}
              </h3>
              <p className="mt-4 max-w-sm text-sm leading-7 text-[var(--text-secondary)]">{item.body}</p>
            </Panel>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-[1400px] px-6 py-24 lg:px-10">
        <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <Panel tone="core" className="p-8 lg:p-10">
            <SectionTitle
              eyebrow="BitDrum Edge"
              accent="core"
              title="Model probability vs. what the book is charging."
              description="Distance from the open, time left, and realized volatility give a fair P(UP). The call only fires when the gap clears the spread."
            />
            <div className="mt-10 grid gap-4 sm:grid-cols-2">
              <div className="group relative overflow-hidden rounded-[1.6rem] border border-[rgba(59,130,246,0.18)] bg-[rgba(59,130,246,0.08)] p-6 transition-all duration-300 hover:border-[rgba(59,130,246,0.28)]">
                <div className="absolute -right-6 -top-6 h-24 w-24 bg-[var(--accent-core)] opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-10" />
                <p className="relative text-[0.62rem] font-medium uppercase tracking-[0.22em] text-[var(--accent-cyan)]">Current Call</p>
                <div className="relative mt-5 flex items-end gap-3">
                  <span className="font-heading text-5xl font-bold tracking-[-0.06em] text-[var(--text-primary)]">UP</span>
                  <span className="font-mono text-xl font-medium text-[var(--accent-core)]">82%</span>
                </div>
              </div>
              <div className="group relative overflow-hidden rounded-[1.6rem] border border-[color:var(--border-subtle)] bg-[rgba(255,255,255,0.025)] p-6 transition-all duration-300 hover:border-[color:var(--border-strong)]">
                <p className="relative text-[0.62rem] font-medium uppercase tracking-[0.22em] text-[var(--text-muted)]">Pulse State</p>
                <div className="relative mt-6 flex gap-2.5">
                  {Array.from({ length: 10 }).map((_, index) => (
                    <span
                      key={index}
                      className="pulse-bar"
                      style={{ animationDelay: `${index * 90}ms`, opacity: 0.25 + index * 0.08 }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </Panel>

          <Panel className="p-8">
            <SectionTitle
              eyebrow="Built on DreamDEX"
              title="A front end with a business model."
              description="BitDrum keeps the UX and the signal; DreamDEX Event Contracts supply liquidity and settlement."
              accent="gold"
            />
            <div className="mt-8 flex flex-col gap-3">
              {venueFacts.map((trader, index) => (
                <div
                  key={trader.name}
                  className="flex flex-col gap-4 rounded-[1.4rem] border border-[color:var(--border-subtle)] bg-[rgba(255,255,255,0.03)] px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex min-w-0 items-center gap-4">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0d0d0d] font-mono text-sm text-[var(--text-secondary)]">
                      #{index + 1}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-heading text-xl tracking-[-0.04em] text-[var(--text-primary)]">{trader.name}</p>
                      <p className="text-[0.68rem] uppercase tracking-[0.3em] text-[var(--text-muted)]">{trader.detail}</p>
                    </div>
                  </div>
                  <StatPill label="How" value={trader.score} accent={trader.accent} />
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </section>

      <section className="mx-auto max-w-[1400px] px-6 pb-28 pt-10 lg:px-10">
        <Panel tone="gold" className="flex flex-col items-start justify-between gap-8 px-8 py-10 lg:flex-row lg:items-center">
          <div>
            <p className="text-[0.68rem] uppercase tracking-[0.34em] text-[var(--accent-gold)]">Final Call</p>
            <h3 className="mt-4 font-heading text-[clamp(2.1rem,4vw,4rem)] font-semibold leading-[0.95] tracking-[-0.06em] text-[var(--text-primary)]">
              Ready to make your call?
            </h3>
          </div>
          <AppLink href="/arena" className="group">
            Enter Trading Arena
            <ArrowRight className="ml-2 h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
          </AppLink>
        </Panel>
      </section>
    </div>
  );
}
