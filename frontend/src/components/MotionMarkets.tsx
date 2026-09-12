'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const TICKERS = [
  { symbol: 'BTC/USD', price: 67841.22, change: 2.34 },
  { symbol: 'ETH/USD', price: 3492.11, change: -1.12 },
  { symbol: 'BOT/USD', price: 0.0842, change: 8.91 },
  { symbol: 'BNB/USD', price: 612.55, change: 0.77 },
  { symbol: 'SOL/USD', price: 184.22, change: -2.41 },
];

export function LivePriceTicker() {
  const [prices, setPrices] = useState(TICKERS);

  useEffect(() => {
    const interval = setInterval(() => {
      setPrices(prev => prev.map(t => ({
        ...t,
        price: t.price * (1 + (Math.random() - 0.5) * 0.002),
        change: t.change + (Math.random() - 0.5) * 0.1,
      })));
    }, 1200);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="ticker-wrapper overflow-hidden border-y border-white/5 py-3 bg-black/40 backdrop-blur-sm">
      <div className="ticker-track flex gap-16 animate-ticker whitespace-nowrap">
        {[...prices, ...prices, ...prices].map((t, i) => (
          <span key={i} className="inline-flex items-center gap-3 text-sm font-mono">
            <span className="text-white/40 text-xs tracking-widest">{t.symbol}</span>
            <span className="text-white font-bold">${t.price.toLocaleString('en-US', { maximumFractionDigits: 2 })}</span>
            <span className={`text-xs font-bold ${t.change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {t.change >= 0 ? '▲' : '▼'} {Math.abs(t.change).toFixed(2)}%
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

// Floating live market opens
const MOCK_MARKETS = [
  { id: 1, direction: 'UP', stake: '0.5', payout: '74%', expires: '1m', btcPrice: '$67,841' },
  { id: 2, direction: 'DOWN', stake: '1.2', payout: '68%', expires: '5m', btcPrice: '$67,839' },
  { id: 3, direction: 'UP', stake: '0.8', payout: '71%', expires: '1m', btcPrice: '$67,845' },
  { id: 4, direction: 'DOWN', stake: '2.0', payout: '65%', expires: '5m', btcPrice: '$67,836' },
  { id: 5, direction: 'UP', stake: '0.3', payout: '77%', expires: '1m', btcPrice: '$67,850' },
];

export function FloatingMarketCard({ market, delay }: { market: typeof MOCK_MARKETS[0]; delay: number }) {
  const isUp = market.direction === 'UP';

  return (
    <motion.div
      initial={{ opacity: 0, y: 60, scale: 0.85 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ scale: 1.06, y: -8, transition: { duration: 0.2 } }}
      className="market-card group relative overflow-hidden rounded-3xl border backdrop-blur-xl cursor-pointer"
      style={{
        borderColor: isUp ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)',
        background: isUp
          ? 'linear-gradient(135deg, rgba(16,185,129,0.08), rgba(6,78,59,0.12), rgba(0,0,0,0.6))'
          : 'linear-gradient(135deg, rgba(239,68,68,0.08), rgba(127,29,29,0.12), rgba(0,0,0,0.6))',
      }}
    >
      {/* Glow orb */}
      <div
        className="absolute -top-12 -right-12 w-32 h-32 rounded-full blur-3xl opacity-30 group-hover:opacity-50 transition-opacity"
        style={{ background: isUp ? '#10b981' : '#ef4444' }}
      />

      {/* Scan line animation */}
      <div className="absolute inset-0 scan-line pointer-events-none" />

      <div className="relative p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div
              className="w-2.5 h-2.5 rounded-full animate-pulse"
              style={{ background: isUp ? '#10b981' : '#ef4444', boxShadow: `0 0 8px ${isUp ? '#10b981' : '#ef4444'}` }}
            />
            <span className="text-[0.6rem] tracking-[0.3em] text-white/50 font-bold uppercase">Market Open</span>
          </div>
          <span className="text-[0.6rem] text-white/30 font-mono">{market.btcPrice}</span>
        </div>

        <div className="flex items-baseline gap-2 mb-3">
          <span
            className="font-black text-4xl tracking-tighter"
            style={{ color: isUp ? '#10b981' : '#ef4444', textShadow: `0 0 20px ${isUp ? '#10b981' : '#ef4444'}` }}
          >
            {market.direction}
          </span>
          {isUp
            ? <span className="text-emerald-400 text-2xl">↑</span>
            : <span className="text-red-400 text-2xl">↓</span>
          }
        </div>

        <div className="grid grid-cols-3 gap-2 mt-4">
          {[
            { label: 'Stake', val: `${market.stake} BOT` },
            { label: 'Payout', val: market.payout },
            { label: 'Window', val: market.expires },
          ].map(item => (
            <div key={item.label} className="rounded-xl bg-white/5 p-2 text-center">
              <p className="text-[0.5rem] text-white/30 uppercase tracking-widest mb-1">{item.label}</p>
              <p className="text-xs font-bold text-white/80">{item.val}</p>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

export function LiveMarketsScroll() {
  const [markets, setMarkets] = useState(MOCK_MARKETS);

  // Push a new market every few seconds
  useEffect(() => {
    const interval = setInterval(() => {
      const newMarket = {
        id: Date.now(),
        direction: Math.random() > 0.5 ? 'UP' : 'DOWN',
        stake: (Math.random() * 3 + 0.1).toFixed(1),
        payout: `${Math.floor(Math.random() * 30 + 60)}%`,
        expires: Math.random() > 0.5 ? '1m' : '5m',
        btcPrice: `$${(67000 + Math.random() * 1000).toLocaleString('en-US', { maximumFractionDigits: 0 })}`,
      };
      setMarkets(prev => [newMarket, ...prev].slice(0, 8));
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <AnimatePresence mode="popLayout">
        {markets.slice(0, 6).map((m, i) => (
          <FloatingMarketCard key={m.id} market={m} delay={i * 0.08} />
        ))}
      </AnimatePresence>
    </div>
  );
}
