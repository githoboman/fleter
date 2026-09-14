'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, useScroll, useTransform, useSpring, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Zap, Trophy, ShieldCheck, Activity, TrendingUp, TrendingDown } from 'lucide-react';
import { LivePriceTicker, LiveMarketsScroll } from './MotionMarkets';

// Glitch text animation
function GlitchText({ children, className }: { children: string; className?: string }) {
  const [glitching, setGlitching] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setGlitching(true);
      setTimeout(() => setGlitching(false), 200);
    }, 3500);
    return () => clearInterval(interval);
  }, []);

  return (
    <span className={`relative inline-block ${className}`}>
      <span className={glitching ? 'glitch-effect' : ''}>{children}</span>
      {glitching && (
        <>
          <span className="glitch-layer-1 absolute inset-0" aria-hidden>{children}</span>
          <span className="glitch-layer-2 absolute inset-0" aria-hidden>{children}</span>
        </>
      )}
    </span>
  );
}

// Animated counter
function AnimatedNumber({ target, prefix = '', suffix = '' }: { target: number; prefix?: string; suffix?: string }) {
  const [current, setCurrent] = useState(0);
  const ref = useRef(false);

  useEffect(() => {
    if (ref.current) return;
    ref.current = true;
    const duration = 2000;
    const steps = 60;
    const step = target / steps;
    let val = 0;
    const interval = setInterval(() => {
      val += step;
      if (val >= target) {
        setCurrent(target);
        clearInterval(interval);
      } else {
        setCurrent(Math.floor(val));
      }
    }, duration / steps);
    return () => clearInterval(interval);
  }, [target]);

  return <span>{prefix}{current.toLocaleString()}{suffix}</span>;
}

// Orbital ring animation
function OrbitalRing({ size, duration, color }: { size: number; duration: number; color: string }) {
  return (
    <motion.div
      className="absolute rounded-full border pointer-events-none"
      style={{
        width: size,
        height: size,
        borderColor: color,
        borderStyle: 'dashed',
        opacity: 0.15,
        top: '50%',
        left: '50%',
        marginTop: -size / 2,
        marginLeft: -size / 2,
      }}
      animate={{ rotate: 360 }}
      transition={{ duration, repeat: Infinity, ease: 'linear' }}
    />
  );
}

// Stats bar that animates like a live market
function MarketStatBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = (value / max) * 100;
  return (
    <div>
      <div className="flex justify-between text-xs mb-1.5">
        <span className="text-white/40 tracking-widest uppercase text-[0.6rem]">{label}</span>
        <span className="font-mono font-bold" style={{ color }}>{value.toLocaleString()}</span>
      </div>
      <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ background: `linear-gradient(90deg, ${color}88, ${color})` }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 1.5, ease: 'easeOut', delay: 0.3 }}
        />
      </div>
    </div>
  );
}

export function EpicLandingPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollY } = useScroll();
  const heroParallax = useTransform(scrollY, [0, 800], [0, -200]);
  const heroOpacity = useTransform(scrollY, [0, 500], [1, 0]);
  const characterY = useTransform(scrollY, [0, 600], [0, 80]);
  const springHeroY = useSpring(heroParallax, { stiffness: 100, damping: 30 });

  return (
    <div ref={containerRef} className="relative min-h-screen overflow-x-hidden">

      {/* ═══════════════════════════════════════
          SECTION 1: HERO
      ═══════════════════════════════════════ */}
      <section className="relative min-h-screen flex flex-col overflow-hidden">

        {/* Deep space background layers */}
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_20%_50%,rgba(88,28,255,0.15),transparent_60%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_80%_20%,rgba(6,182,212,0.12),transparent_50%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_100%,rgba(245,185,66,0.08),transparent_60%)]" />
        </div>

        {/* Top ticker */}
        <div className="relative z-20">
          <LivePriceTicker />
        </div>

        {/* Nav */}
        <motion.nav
          className="relative z-20 flex items-center justify-between px-6 py-5 lg:px-14"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 via-cyan-400 to-amber-400 flex items-center justify-center shadow-[0_0_24px_rgba(59,130,246,0.6)]">
              <span className="text-black font-black text-sm">B</span>
            </div>
            <span className="font-black text-xl tracking-tight text-white">Bit<span className="text-cyan-400">Drum</span></span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-[0.75rem] tracking-widest text-white/40 uppercase">
            <Link href="/arena" className="hover:text-white transition-colors">Markets</Link>
            <Link href="/signals" className="hover:text-white transition-colors">Signals</Link>
            <Link href="/portfolio" className="hover:text-white transition-colors">Portfolio</Link>
          </div>
          <Link
            href="/arena"
            className="relative group flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-bold text-black overflow-hidden"
            style={{ background: 'linear-gradient(135deg, #f5b942, #ff9500)' }}
          >
            <div className="absolute inset-0 bg-white/0 group-hover:bg-white/20 transition-colors duration-200" />
            <Zap className="w-4 h-4" />
            <span>Enter App</span>
          </Link>
        </motion.nav>

        {/* Hero main */}
        <div className="relative z-10 flex-1 grid lg:grid-cols-[1fr_auto] gap-0 items-center max-w-[1600px] mx-auto w-full px-6 lg:px-14 pb-10">
          {/* Left: Text */}
          <motion.div style={{ y: springHeroY, opacity: heroOpacity }}>
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
            >
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-4 py-1.5 mb-8">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                <span className="text-[0.65rem] tracking-[0.3em] text-cyan-400 uppercase font-bold">Live on Bot Chain Testnet · Chain ID 968</span>
              </div>

              <h1 className="font-black text-[clamp(4rem,9vw,9rem)] leading-[0.85] tracking-[-0.06em] mb-8">
                <GlitchText className="text-white">Make</GlitchText>
                <br />
                <span className="bg-gradient-to-r from-amber-400 via-orange-400 to-yellow-300 bg-clip-text text-transparent drop-shadow-[0_0_60px_rgba(245,185,66,0.4)]">
                  The Call.
                </span>
                <br />
                <GlitchText className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">Beat</GlitchText>
                <span className="text-white"> the</span>
                <br />
                <span className="text-white">Market.</span>
              </h1>

              <p className="text-white/50 text-lg max-w-xl leading-relaxed mb-10">
                Ultra-fast Bitcoin Up/Down prediction markets on Bot Chain. Oracle-settled on-chain. 
                <span className="text-white/80"> 1-minute and 5-minute windows.</span> The edge is yours.
              </p>

              <div className="flex flex-wrap gap-4 mb-14">
                <Link
                  href="/arena"
                  className="group relative flex items-center gap-3 rounded-full px-8 py-4 font-bold text-black overflow-hidden shadow-[0_0_60px_rgba(245,185,66,0.3)] hover:shadow-[0_0_80px_rgba(245,185,66,0.5)] transition-shadow"
                  style={{ background: 'linear-gradient(135deg, #f5b942 0%, #ff8c00 50%, #f5b942 100%)', backgroundSize: '200%' }}
                >
                  <ArrowRight className="w-5 h-5" />
                  <span className="text-base">Enter Trading Arena</span>
                </Link>
                <Link
                  href="#markets"
                  className="flex items-center gap-3 rounded-full px-8 py-4 font-bold text-white border border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20 transition-all backdrop-blur-sm"
                >
                  <Activity className="w-5 h-5 text-cyan-400" />
                  <span>View Live Markets</span>
                </Link>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-6 max-w-md">
                {[
                  { label: 'Markets Settled', val: 1247, suffix: '+', color: '#22d3ee' },
                  { label: 'BOT in Vault', val: 51, suffix: '', color: '#f5b942' },
                  { label: 'Avg Payout', val: 73, suffix: '%', color: '#10b981' },
                ].map((s, i) => (
                  <motion.div
                    key={s.label}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 + i * 0.1 }}
                    className="group"
                  >
                    <p className="font-black text-3xl tracking-tight" style={{ color: s.color, textShadow: `0 0 20px ${s.color}60` }}>
                      <AnimatedNumber target={s.val} suffix={s.suffix} />
                    </p>
                    <p className="text-[0.6rem] text-white/30 uppercase tracking-widest mt-1">{s.label}</p>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </motion.div>

          {/* Right: Character */}
          <motion.div
            className="relative hidden lg:flex items-center justify-center"
            style={{ y: characterY }}
            initial={{ opacity: 0, scale: 0.8, x: 60 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            transition={{ duration: 1.2, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* Orbital rings */}
            <OrbitalRing size={540} duration={20} color="#3b82f6" />
            <OrbitalRing size={420} duration={14} color="#f5b942" />
            <OrbitalRing size={300} duration={9} color="#22d3ee" />

            {/* Character glow base */}
            <div className="absolute w-96 h-96 rounded-full blur-[80px] opacity-40"
              style={{ background: 'radial-gradient(circle, #3b82f6, #581cff, transparent 70%)' }} />

            {/* Character image */}
            <motion.div
              animate={{ y: [-12, 12, -12] }}
              transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
              className="relative z-10"
            >
              <Image
                src="/hero-character.jpg"
                alt="Botrem Oracle Character"
                width={480}
                height={580}
                className="object-contain drop-shadow-[0_0_60px_rgba(59,130,246,0.5)]"
                priority
                style={{ maskImage: 'radial-gradient(ellipse 90% 90% at center, black 60%, transparent 100%)' }}
              />
            </motion.div>

            {/* Floating data chips around character */}
            {[
              { label: 'BTC/USD', val: '$67,841', color: '#f5b942', pos: '-left-16 top-24' },
              { label: 'UP 82%', val: 'Bull Signal', color: '#10b981', pos: '-right-10 top-32' },
              { label: 'Markets', val: '12 Live', color: '#22d3ee', pos: '-left-8 bottom-36' },
              { label: 'Settled', val: '1.2K+', color: '#a855f7', pos: '-right-8 bottom-24' },
            ].map((chip, i) => (
              <motion.div
                key={chip.label}
                className={`absolute ${chip.pos} rounded-2xl border backdrop-blur-xl px-4 py-3 z-20`}
                style={{ borderColor: `${chip.color}40`, background: `linear-gradient(135deg, ${chip.color}10, rgba(0,0,0,0.7))` }}
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 1 + i * 0.15, type: 'spring' }}
                whileHover={{ scale: 1.1 }}
              >
                <p className="text-[0.55rem] tracking-[0.25em] uppercase mb-0.5" style={{ color: chip.color }}>{chip.label}</p>
                <p className="text-white font-bold text-sm">{chip.val}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>

        {/* Scroll indicator */}
        <motion.div
          className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-white/20 z-20"
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <span className="text-[0.55rem] tracking-[0.4em] uppercase">Scroll</span>
          <div className="w-px h-12 bg-gradient-to-b from-white/20 to-transparent" />
        </motion.div>
      </section>

      {/* ═══════════════════════════════════════
          SECTION 2: LIVE MARKETS
      ═══════════════════════════════════════ */}
      <section id="markets" className="relative py-28 px-6 lg:px-14 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(59,130,246,0.05),transparent_70%)]" />

        <div className="max-w-[1400px] mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="mb-16"
          >
            <p className="text-[0.65rem] tracking-[0.4em] text-cyan-400 uppercase mb-4">● Live Now</p>
            <h2 className="font-black text-[clamp(2.5rem,5vw,5rem)] leading-[0.9] tracking-tight text-white mb-4">
              Open Markets
              <span className="block text-blue-500">Streaming.</span>
            </h2>
            <p className="text-white/40 text-lg max-w-lg">Real-time predictions opening every second. Pick your direction. Stake BOT. Beat the oracle.</p>
          </motion.div>

          <LiveMarketsScroll />

          {/* Market activity chart-like visualizer */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="mt-16 rounded-3xl border border-white/8 bg-white/3 backdrop-blur-xl p-8 overflow-hidden relative"
          >
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(59,130,246,0.07),transparent_60%)]" />
            <div className="relative">
              <p className="text-[0.6rem] tracking-[0.35em] text-white/30 uppercase mb-6">Protocol Stats · Bot Chain Testnet</p>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-5">
                  <MarketStatBar label="Markets Opened" value={1247} max={2000} color="#3b82f6" />
                  <MarketStatBar label="BOT Volume" value={842} max={1000} color="#f5b942" />
                  <MarketStatBar label="Winners Paid Out" value={623} max={1247} color="#10b981" />
                </div>
                <div className="space-y-5">
                  <MarketStatBar label="1m Markets" value={891} max={1247} color="#22d3ee" />
                  <MarketStatBar label="5m Markets" value={356} max={1247} color="#a855f7" />
                  <MarketStatBar label="Avg Payout Rate" value={73} max={100} color="#f59e0b" />
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ═══════════════════════════════════════
          SECTION 3: HOW IT WORKS (animated)
      ═══════════════════════════════════════ */}
      <section className="relative py-28 px-6 lg:px-14">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_80%_50%,rgba(168,85,247,0.06),transparent_60%)]" />

        <div className="max-w-[1400px] mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-20"
          >
            <p className="text-[0.65rem] tracking-[0.4em] text-amber-400 uppercase mb-4">Simple. Fast. Ruthless.</p>
            <h2 className="font-black text-[clamp(2.5rem,5vw,5.5rem)] leading-[0.9] tracking-tight text-white">
              Three Steps.<br />
              <span className="bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">Infinite Edge.</span>
            </h2>
          </motion.div>

          <div className="grid lg:grid-cols-3 gap-6">
            {[
              {
                num: '01',
                icon: TrendingUp,
                title: 'Read the Signal',
                body: 'The Botrem oracle reads BTC price momentum, adapter freshness, and vault depth to compute a real-time directional edge.',
                color: '#22d3ee',
                gradient: 'rgba(34,211,238,0.08)',
              },
              {
                num: '02',
                icon: Zap,
                title: 'Stake Your Call',
                body: 'Tap UP or DOWN. Stake native BOT. Your position is immediately matched 1:1 by the Liquidity Vault on-chain.',
                color: '#f5b942',
                gradient: 'rgba(245,185,66,0.08)',
              },
              {
                num: '03',
                icon: Trophy,
                title: 'Collect Your Win',
                body: 'Oracle settles at expiry. Winners claim stake + profit directly from the vault. No counterparties. Pure protocol.',
                color: '#10b981',
                gradient: 'rgba(16,185,129,0.08)',
              },
            ].map((step, i) => (
              <motion.div
                key={step.num}
                initial={{ opacity: 0, y: 60 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                whileHover={{ y: -12, transition: { duration: 0.3 } }}
                className="group relative rounded-3xl border overflow-hidden p-8 cursor-default"
                style={{
                  borderColor: `${step.color}25`,
                  background: `linear-gradient(135deg, ${step.gradient}, rgba(0,0,0,0.6))`,
                }}
              >
                {/* Step number watermark */}
                <span className="absolute right-6 top-4 font-black text-[5rem] leading-none tracking-tighter opacity-[0.04] text-white select-none">
                  {step.num}
                </span>

                {/* Glow on hover */}
                <div
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                  style={{ background: `radial-gradient(circle at 30% 30%, ${step.color}15, transparent 60%)` }}
                />

                <div
                  className="relative mb-8 w-14 h-14 rounded-2xl flex items-center justify-center"
                  style={{ background: `${step.color}18`, border: `1px solid ${step.color}30` }}
                >
                  <step.icon className="w-7 h-7" style={{ color: step.color }} />
                </div>

                <h3 className="font-black text-2xl text-white mb-4 tracking-tight">{step.title}</h3>
                <p className="text-white/40 leading-relaxed text-sm">{step.body}</p>

                <div className="mt-8 flex items-center gap-2 text-xs font-bold" style={{ color: step.color }}>
                  <span>Learn more</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-2 transition-transform" />
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════
          SECTION 4: SECURITY + CONTRACTS
      ═══════════════════════════════════════ */}
      <section className="relative py-28 px-6 lg:px-14 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_10%_50%,rgba(16,185,129,0.05),transparent_50%)]" />

        <div className="max-w-[1400px] mx-auto grid lg:grid-cols-2 gap-12 items-center">
          <motion.div
            initial={{ opacity: 0, x: -60 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          >
            <p className="text-[0.65rem] tracking-[0.4em] text-emerald-400 uppercase mb-4">On-Chain. Trustless. Yours.</p>
            <h2 className="font-black text-[clamp(2.5rem,4.5vw,4.5rem)] leading-[0.9] tracking-tight text-white mb-8">
              Contracts live<br />
              <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">on Bot Chain.</span>
            </h2>
            <p className="text-white/40 leading-relaxed mb-10 text-lg">
              Every prediction, every settlement, every payout — fully verifiable on-chain. 
              No centralized oracle. No rug. The vault and market contracts are immutable.
            </p>
            <div className="space-y-4">
              {[
                { label: 'PredictionMarketV2', addr: '0x0478E0bF...43BAB', color: '#3b82f6' },
                { label: 'LiquidityVaultV2', addr: '0x042D0fb5...AAF8', color: '#f5b942' },
                { label: 'SettlementEngineV2', addr: '0x7afd0A03...398A', color: '#a855f7' },
              ].map(c => (
                <motion.a
                  key={c.label}
                  href={`https://scan.bohr.life/address/${c.addr}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between rounded-2xl border px-5 py-4 backdrop-blur-sm hover:bg-white/5 transition-colors group"
                  style={{ borderColor: `${c.color}25` }}
                  whileHover={{ x: 4 }}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full" style={{ background: c.color, boxShadow: `0 0 8px ${c.color}` }} />
                    <span className="text-white/70 text-sm">{c.label}</span>
                  </div>
                  <span className="font-mono text-xs" style={{ color: c.color }}>{c.addr}</span>
                </motion.a>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 60 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
            className="grid grid-cols-2 gap-4"
          >
            {[
              { icon: ShieldCheck, title: 'Non-Custodial', desc: 'Your funds never leave the vault contract. Claim directly on-chain.', color: '#10b981' },
              { icon: Activity, title: 'Oracle-Settled', desc: 'Price adapter posts BTC/USD snapshots every 15s. Trustless resolution.', color: '#22d3ee' },
              { icon: Zap, title: 'Instant Payout', desc: 'Winners claim within seconds of settlement. No waiting. No queue.', color: '#f5b942' },
              { icon: Trophy, title: 'Vault-Backed', desc: 'Every position backed 1:1 by the liquidity vault. Always solvent.', color: '#a855f7' },
            ].map((feat, i) => (
              <motion.div
                key={feat.title}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                whileHover={{ y: -6 }}
                className="rounded-3xl border border-white/6 bg-white/3 p-6 backdrop-blur-sm"
              >
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center mb-5"
                  style={{ background: `${feat.color}15` }}
                >
                  <feat.icon className="w-6 h-6" style={{ color: feat.color }} />
                </div>
                <h4 className="font-bold text-white text-base mb-2">{feat.title}</h4>
                <p className="text-white/35 text-xs leading-relaxed">{feat.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ═══════════════════════════════════════
          SECTION 5: FINAL CTA
      ═══════════════════════════════════════ */}
      <section className="relative py-32 px-6 lg:px-14 overflow-hidden">
        {/* Dramatic gold explosion */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-[800px] h-[800px] rounded-full blur-[120px] opacity-20"
            style={{ background: 'radial-gradient(circle, #f5b942 0%, #ff6b00 40%, transparent 70%)' }} />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 60 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 1 }}
          className="relative max-w-[1000px] mx-auto text-center"
        >
          <p className="text-[0.65rem] tracking-[0.5em] text-amber-400/80 uppercase mb-6">Are You Ready?</p>
          <h2 className="font-black text-[clamp(3.5rem,8vw,8rem)] leading-[0.85] tracking-tight mb-8">
            <span className="text-white">Your </span>
            <span className="bg-gradient-to-r from-amber-400 via-orange-400 to-yellow-300 bg-clip-text text-transparent drop-shadow-[0_0_80px_rgba(245,185,66,0.4)]">
              Call.
            </span>
            <br />
            <span className="text-white">Their </span>
            <GlitchText className="bg-gradient-to-r from-red-400 to-red-600 bg-clip-text text-transparent">Loss.</GlitchText>
          </h2>
          <p className="text-white/40 text-xl leading-relaxed mb-12 max-w-xl mx-auto">
            Join the first prediction market running live on Bot Chain. 
            Every second counts. Every call matters.
          </p>
          <div className="flex flex-wrap justify-center gap-5">
            <Link
              href="/arena"
              className="group relative flex items-center gap-3 rounded-full px-10 py-5 font-black text-black text-lg overflow-hidden shadow-[0_0_80px_rgba(245,185,66,0.35)] hover:shadow-[0_0_120px_rgba(245,185,66,0.55)] transition-all duration-300"
              style={{ background: 'linear-gradient(135deg, #f5b942, #ff8c00, #f5b942)', backgroundSize: '200%' }}
            >
              <Zap className="w-6 h-6" />
              <span>Enter the Arena</span>
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>

          {/* Chain badge */}
          <motion.div
            className="mt-14 inline-flex items-center gap-3 rounded-full border border-white/8 bg-white/4 backdrop-blur-sm px-6 py-3"
            animate={{ y: [0, -4, 0] }}
            transition={{ duration: 3, repeat: Infinity }}
          >
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-white/40 text-xs tracking-widest uppercase">Bot Chain Testnet · Chain 968 · <span className="text-emerald-400">Live</span></span>
          </motion.div>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-10 px-6 lg:px-14">
        <div className="max-w-[1400px] mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center">
              <span className="text-black font-black text-xs">B</span>
            </div>
            <span className="text-white/30 text-sm">Botrem · Bot Chain Prediction Protocol</span>
          </div>
          <p className="text-white/20 text-xs">Trading involves risk. This is a testnet. Funds have no real value.</p>
        </div>
      </footer>
    </div>
  );
}
