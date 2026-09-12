'use client';
/**
 * Live DreamDEX Up/Down market + BitDrum Edge signal for one asset/cadence.
 * Refreshes every `refreshMs`, and rolls to the next market in the series
 * automatically when the current one expires.
 */
import { useEffect, useRef, useState } from 'react';
import {
  fetchMinuteCandles,
  getCurrentUpDownMarket,
  snapshotUpDown,
  type Asset,
  type CadenceSec,
  type UpDownSnapshot,
} from '../lib/dreamdex/markets';
import { computeEdge, type EdgeSignal, type Candle } from '../lib/signal/fairValue';

export function useUpDownMarket(asset: Asset, cadence: CadenceSec, refreshMs = 2000) {
  const [snap, setSnap] = useState<UpDownSnapshot | null>(null);
  const [signal, setSignal] = useState<EdgeSignal | null>(null);
  const [error, setError] = useState<string | null>(null);
  const candles = useRef<{ at: number; rows: Candle[] }>({ at: 0, rows: [] });

  useEffect(() => {
    let cancelled = false;
    let marketId: string | null = null;
    let market: Awaited<ReturnType<typeof getCurrentUpDownMarket>> = null;

    const tick = async () => {
      try {
        if (!market || Number(market.expiry) * 1000 <= Date.now() + 3000) {
          market = await getCurrentUpDownMarket(asset, cadence);
          marketId = market?.marketId ?? null;
        }
        if (!market) {
          // Window handoff: keep the expiring snapshot on screen (the panel shows
          // it as LOCKING) rather than flashing back to "searching" for a tick.
          if (!cancelled) {
            setSnap((prev) => (prev && Number(prev.market.expiry) * 1000 > Date.now() - 5000 ? prev : null));
            setSignal(null);
          }
          return;
        }
        if (Date.now() - candles.current.at > 30_000) {
          candles.current = { at: Date.now(), rows: await fetchMinuteCandles(asset, 60) };
        }
        const s = await snapshotUpDown(market);
        if (cancelled || s.market.marketId !== marketId) return;
        setSnap(s);
        setSignal(
          s.livePrice && s.openingPrice
            ? computeEdge({
                livePrice: s.livePrice,
                openingPrice: s.openingPrice,
                secondsLeft: s.secondsLeft,
                windowSec: s.windowSec,
                impliedUp: s.impliedUp,
                spread: s.spread,
                candles: candles.current.rows,
              })
            : null,
        );
        setError(null);
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    };

    tick();
    const id = setInterval(tick, refreshMs);
    return () => { cancelled = true; clearInterval(id); };
  }, [asset, cadence, refreshMs]);

  return { snap, signal, error };
}
