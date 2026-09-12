'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AreaSeries, CandlestickSeries, ColorType, IChartApi, ISeriesApi, LineStyle, createChart, createSeriesMarkers } from 'lightweight-charts';
import { ArrowDownRight, ArrowUpRight, ExternalLink, LayoutPanelLeft, LineChart, Loader2, Waves } from 'lucide-react';
import { Panel, StatPill } from './ObsidianPrimitives';
import { type TradeExecutionRecord } from '../utils/bitdrum';
import { fetchLivePrice, fetchMinuteCandles, type Asset } from '../lib/dreamdex/markets';
import { COLLATERAL_SYMBOL } from '../lib/dreamdex/client';

const ExecutionCard: React.FC<{ execution: TradeExecutionRecord }> = ({ execution }) => {
  const [progress, setProgress] = useState(0);
  const [timeLeft, setTimeLeft] = useState<number>(execution.timeframeSeconds);
  const isUp = execution.direction === 'UP';
  const isPending = execution.status === 'submitted';
  const isFailed = execution.status === 'failed';
  const isExpired = timeLeft <= 0 && execution.status === 'confirmed';

  useEffect(() => {
    // Start countdown immediately from submission — not waiting for confirmation.
    const startTime = execution.timestamp;

    const tick = () => {
      const elapsed = (Date.now() - startTime) / 1000;
      const p = Math.min((elapsed / execution.timeframeSeconds) * 100, 100);
      setProgress(p);
      setTimeLeft(Math.max(execution.timeframeSeconds - elapsed, 0));
    };

    tick();
    const id = setInterval(tick, 200);
    return () => clearInterval(id);
  }, [execution.timestamp, execution.timeframeSeconds]);

  const urgency = timeLeft < 10 && timeLeft > 0;
  const dirColor = isUp ? 'var(--state-up)' : 'var(--state-down)';
  const progressColor = urgency
    ? 'var(--state-down)'
    : progress > 60
      ? '#f5b942'
      : dirColor;

  const mins = Math.floor(timeLeft / 60);
  const secs = Math.floor(timeLeft % 60);
  const timeDisplay = mins > 0 ? `${mins}:${secs.toString().padStart(2, '0')}` : `${secs}s`;

  return (
    <div
      className="group relative overflow-hidden rounded-[1.65rem] border transition-all duration-300"
      style={{
        borderColor: isPending
          ? 'rgba(245,185,66,0.2)'
          : isFailed
            ? 'rgba(220,38,38,0.2)'
            : `color-mix(in srgb, ${dirColor} 18%, transparent)`,
        background: isPending
          ? 'radial-gradient(circle at top, rgba(245,185,66,0.05), transparent 60%), rgba(255,255,255,0.02)'
          : `radial-gradient(circle at top left, color-mix(in srgb, ${dirColor} 8%, transparent), transparent 55%), rgba(255,255,255,0.025)`,
        boxShadow: isPending
          ? '0 0 0 1px rgba(245,185,66,0.08)'
          : isExpired
            ? `0 0 20px color-mix(in srgb, ${dirColor} 12%, transparent)`
            : 'none',
      }}
    >
      {/* Animated glow border while pending */}
      {isPending && (
        <div className="absolute inset-0 rounded-[1.65rem] animate-pulse" style={{ boxShadow: 'inset 0 0 0 1px rgba(245,185,66,0.15)' }} />
      )}

      {/* Progress fill background */}
      <div
        className="absolute inset-0 rounded-[1.65rem] transition-all duration-300"
        style={{
          background: `linear-gradient(90deg, color-mix(in srgb, ${progressColor} 6%, transparent) ${progress}%, transparent ${progress}%)`,
          opacity: isPending ? 0.4 : 1,
        }}
      />

      {/* Bottom progress bar */}
      <div className="absolute bottom-0 left-0 h-[2px] w-full overflow-hidden rounded-b-[1.65rem] bg-[rgba(255,255,255,0.04)]">
        <div
          className="h-full rounded-full transition-all duration-200"
          style={{
            width: `${progress}%`,
            background: `linear-gradient(90deg, ${progressColor}, color-mix(in srgb, ${progressColor} 60%, white))`,
            boxShadow: `0 0 8px ${progressColor}`,
          }}
        />
      </div>

      <div className="relative p-5">
        {/* Header row */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-full"
              style={{
                background: `color-mix(in srgb, ${dirColor} 12%, transparent)`,
                boxShadow: `0 0 12px color-mix(in srgb, ${dirColor} 20%, transparent)`,
              }}
            >
              {isUp
                ? <ArrowUpRight className="h-4 w-4" style={{ color: dirColor }} />
                : <ArrowDownRight className="h-4 w-4" style={{ color: dirColor }} />}
            </div>
            <div>
              <div className="text-[0.58rem] uppercase tracking-[0.28em] text-[var(--text-muted)]">
                {execution.kind === 'OPEN' ? 'Primary Call' : 'Joined'}
              </div>
              <div className="font-heading text-base font-bold tracking-tight" style={{ color: dirColor }}>
                {execution.direction}
              </div>
            </div>
          </div>

          <span
            className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.55rem] font-bold uppercase tracking-[0.22em] ${
              execution.status === 'confirmed'
                ? 'border-[rgba(22,163,74,0.2)] bg-[rgba(22,163,74,0.08)] text-[var(--state-up)]'
                : isFailed
                  ? 'border-[rgba(220,38,38,0.22)] bg-[rgba(220,38,38,0.08)] text-[var(--state-down)]'
                  : 'border-[rgba(245,185,66,0.2)] bg-[rgba(245,185,66,0.06)] text-[var(--accent-gold)] animate-pulse'
            }`}
          >
            {isPending ? (
              'Pending'
            ) : isFailed ? (
              'Failed'
            ) : isExpired ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                Settling
              </>
            ) : (
              'Active'
            )}
          </span>
        </div>

        {/* Middle stats */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div>
            <div className="text-[0.55rem] uppercase tracking-[0.24em] text-[var(--text-muted)]">Stake</div>
            <div className="mt-1 font-mono text-lg font-semibold text-[var(--text-primary)]">
              {execution.stake}
              <span className="ml-1 text-[0.6rem] font-normal opacity-50">{COLLATERAL_SYMBOL}</span>
            </div>
          </div>
          {execution.entryPrice ? (
            <div>
              <div className="text-[0.55rem] uppercase tracking-[0.24em] text-[var(--text-muted)]">Entry</div>
              <div className="mt-1 font-mono text-lg font-semibold text-[var(--text-primary)]">
                ${execution.entryPrice.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </div>
            </div>
          ) : (
            <div>
              <div className="text-[0.55rem] uppercase tracking-[0.24em] text-[var(--text-muted)]">Period</div>
              <div className="mt-1 font-mono text-lg font-semibold text-[var(--text-primary)]">
                {execution.timeframeSeconds >= 60 ? `${execution.timeframeSeconds / 60}m` : `${execution.timeframeSeconds}s`}
              </div>
            </div>
          )}
        </div>

        {/* Countdown */}
        {!isFailed && (
          <div className="mt-4 flex items-center justify-between">
            <div className="text-[0.55rem] uppercase tracking-[0.24em] text-[var(--text-muted)]">
              {isExpired ? 'Awaiting settlement' : isPending ? 'Confirming…' : 'Time left'}
            </div>
            <div
              className={`font-mono text-xl font-bold tabular-nums ${urgency ? 'animate-pulse' : ''}`}
              style={{ color: isExpired ? 'var(--text-muted)' : urgency ? 'var(--state-down)' : 'var(--text-primary)' }}
            >
              {isExpired ? '—' : timeDisplay}
            </div>
          </div>
        )}

        {/* Tx link */}
        {execution.txHash && (
          <a
            href={execution.explorerUrl || '#'}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 flex items-center gap-1.5 text-[0.55rem] uppercase tracking-[0.22em] text-[var(--text-muted)] transition hover:text-[var(--text-secondary)]"
          >
            <ExternalLink className="h-3 w-3" />
            {execution.txHash.slice(0, 8)}…{execution.txHash.slice(-6)}
          </a>
        )}
      </div>
    </div>
  );
};

/** Same index the DreamDEX markets resolve against (Somnia price feed). */
const LIVE_POLL_MS = 2000;
const HISTORY_MINUTES = 240;

export interface TradeMarker {
  time: number;
  price: number;
  direction: 'UP' | 'DOWN';
  label: string;
}

interface PriceChartProps {
  asset?: Asset;
  /** The live window's threshold; drawn as a dashed line so the call is legible at a glance. */
  openingPrice?: number | null;
  tradeMarkers?: TradeMarker[];
  recentExecutions?: TradeExecutionRecord[];
  onPriceUpdate?: (price: number | null) => void;
}



export const PriceChart: React.FC<PriceChartProps> = ({
  asset = 'BTC',
  openingPrice = null,
  tradeMarkers = [],
  recentExecutions = [],
  onPriceUpdate,
}) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Area'> | ISeriesApi<'Candlestick'> | null>(null);
  const strikeLineRef = useRef<ReturnType<ISeriesApi<'Area'>['createPriceLine']> | null>(null);
  const markersPluginRef = useRef<any>(null);
 
  const [chartMode, setChartMode] = useState<'basic' | 'advanced'>('basic');

  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [priceChange, setPriceChange] = useState<number>(0);
  const [isLive, setIsLive] = useState(false);
  const [chartReady, setChartReady] = useState(false);
  const visibleExecutions = useMemo(() => recentExecutions.slice(0, 3), [recentExecutions]);
  const latestStrike = openingPrice;
  const onPriceUpdateRef = useRef(onPriceUpdate);
  useEffect(() => {
    onPriceUpdateRef.current = onPriceUpdate;
  }, [onPriceUpdate]);

  useEffect(() => {
    if (!chartContainerRef.current) return;
    let active = true;
    const currentMode = chartMode;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#9ca3af',
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.03)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.04)' },
      },
      width: chartContainerRef.current.clientWidth,
      height: 390,
      crosshair: {
        vertLine: { color: 'rgba(245, 185, 66, 0.18)', width: 1, style: LineStyle.Solid },
        horzLine: { color: 'rgba(245, 185, 66, 0.18)', width: 1, style: LineStyle.Solid },
      },
      timeScale: {
        borderColor: 'rgba(255, 255, 255, 0.06)',
        timeVisible: true,
        secondsVisible: false,
      },
      rightPriceScale: {
        borderColor: 'rgba(255, 255, 255, 0.06)',
      },
    });

    const series = currentMode === 'basic' 
      ? chart.addSeries(AreaSeries, {
          lineColor: '#f5b942',
          topColor: 'rgba(245, 185, 66, 0.28)',
          bottomColor: 'rgba(59, 130, 246, 0.03)',
          lineWidth: 2,
          priceLineVisible: false,
          lastValueVisible: false,
        })
      : chart.addSeries(CandlestickSeries, {
          upColor: '#16a34a',
          downColor: '#dc2626',
          borderVisible: false,
          wickUpColor: '#16a34a',
          wickDownColor: '#dc2626',
        });

    seriesRef.current = series;
    chartRef.current = chart;
    setChartReady(true);

    const loadHistory = async () => {
      try {
        const candles = await fetchMinuteCandles(asset, HISTORY_MINUTES);
        if (!active || !candles.length) return;
        const formatted = candles.map(([ms, open, high, low, close]) =>
          currentMode === 'advanced'
            ? { time: (ms / 1000) as any, open, high, low, close }
            : { time: (ms / 1000) as any, value: close },
        );
        series.setData(formatted as any);
        const nextPrice = candles[candles.length - 1][4] ?? null;
        setCurrentPrice(nextPrice);
        onPriceUpdateRef.current?.(nextPrice);
        chart.timeScale().fitContent();
      } catch (error) {
        if (active) console.error('Failed to fetch price history:', error);
      }
    };

    void loadHistory();

    const interval = setInterval(async () => {
      if (!active) return;
      try {
        const nextPrice = await fetchLivePrice(asset);
        if (!active || nextPrice === null) return;
        const nextTime = Math.floor(Date.now() / 1000) as any;

        if (currentMode === 'basic') {
          (series as ISeriesApi<'Area'>).update({ time: nextTime, value: nextPrice });
        } else {
          (series as unknown as ISeriesApi<'Candlestick'>).update({
            time: nextTime,
            open: nextPrice,
            high: nextPrice,
            low: nextPrice,
            close: nextPrice,
          });
        }

        setCurrentPrice((previous) => {
          if (previous) setPriceChange(((nextPrice - previous) / previous) * 100);
          return nextPrice;
        });
        onPriceUpdateRef.current?.(nextPrice);
        setIsLive(true);
      } catch (error) {
        console.error('Price feed error:', error);
        if (active) setIsLive(false);
      }
    }, LIVE_POLL_MS);

    const resizeObserver = new ResizeObserver(() => {
      if (chartContainerRef.current) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    });

    resizeObserver.observe(chartContainerRef.current);

    return () => {
      active = false;
      resizeObserver.disconnect();
      clearInterval(interval);
      chart.remove();
      seriesRef.current = null;
      chartRef.current = null;
      setChartReady(false);
    };
  }, [chartMode, asset]);

  // Secondary effect to sync overlays without destroying the whole chart/canvas
  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;

    // Strike Line
    if (strikeLineRef.current) {
      try { (series as any).removePriceLine(strikeLineRef.current); } catch (e) {}
      strikeLineRef.current = null;
    }
    if (latestStrike) {
      strikeLineRef.current = series.createPriceLine({
        price: latestStrike,
        color: '#22d3ee',
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: 'Open',
      });
    }

    // Markers
    if (markersPluginRef.current) {
      try { markersPluginRef.current.detach?.(); } catch (e) {}
      markersPluginRef.current = null;
    }
    if (chartReady && tradeMarkers.length) {
      const markers = tradeMarkers.map((marker) => ({
        time: marker.time as any,
        position: marker.direction === 'UP' ? 'belowBar' : 'aboveBar',
        color: marker.direction === 'UP' ? '#16a34a' : '#dc2626',
        shape: marker.direction === 'UP' ? 'arrowUp' : 'arrowDown',
        text: marker.label,
      })) as any[];
      markersPluginRef.current = createSeriesMarkers(series as any, markers);
    }
  }, [chartReady, latestStrike, tradeMarkers]);

  return (
    <Panel className="surface-lift p-5 sm:p-6">
      <div className="flex flex-col gap-5">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
          <div>
            <div className="text-[0.68rem] uppercase tracking-[0.34em] text-[var(--accent-gold)]">
              DreamDEX Index Pulse
            </div>
            <div className="mt-3 flex items-end gap-3">
              <h2 className="font-heading text-[clamp(2rem,3vw,3.5rem)] font-semibold tracking-[-0.06em] text-[var(--text-primary)]">
                {asset} / USD
              </h2>
              {isLive ? (
                <div className="inline-flex items-center gap-2 rounded-full border border-[rgba(245,185,66,0.16)] bg-[rgba(245,185,66,0.08)] px-3 py-1 text-[0.66rem] uppercase tracking-[0.26em] text-[var(--accent-gold)]">
                  <Waves className="h-3.5 w-3.5" />
                  Live
                </div>
              ) : null}
            </div>
          </div>

          <div className="flex flex-col gap-4 lg:items-end">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setChartMode(chartMode === 'basic' ? 'advanced' : 'basic')}
                className="inline-flex items-center gap-2 rounded-full border border-[color:var(--border-subtle)] bg-[rgba(255,255,255,0.03)] px-4 py-2 text-[0.62rem] uppercase tracking-[0.24em] text-[var(--text-secondary)] transition hover:border-[rgba(245,185,66,0.18)] hover:text-[var(--text-primary)]"
              >
                {chartMode === 'basic' ? <LayoutPanelLeft className="h-3.5 w-3.5" /> : <LineChart className="h-3.5 w-3.5" />}
                {chartMode === 'basic' ? 'Advanced' : 'Basic'}
              </button>
              <a
                href="https://dreamdex.somnia.network"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[color:var(--border-subtle)] bg-[rgba(255,255,255,0.03)] text-[var(--text-secondary)] transition hover:border-[rgba(59,130,246,0.18)] hover:text-[var(--text-primary)]"
                title="Open DreamDEX"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
 
            <div className="mt-2 text-right">
              <div className="font-mono text-[clamp(1.6rem,2vw,2.5rem)] font-semibold tracking-[-0.05em] text-[var(--text-primary)]">
                {currentPrice
                  ? `$${currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                  : '--'}
              </div>
              <div className="mt-3 flex flex-wrap justify-end gap-2">
                <StatPill
                  label="Move"
                  value={`${priceChange >= 0 ? '+' : '-'}${Math.abs(priceChange).toFixed(3)}%`}
                  accent={priceChange >= 0 ? 'success' : 'danger'}
                />
                {latestStrike ? <StatPill label="Open" value={`$${latestStrike.toFixed(2)}`} accent="core" /> : null}
                {latestStrike && currentPrice ? (
                  <StatPill
                    label="vs Open"
                    value={`${currentPrice >= latestStrike ? '+' : '-'}${Math.abs((currentPrice / latestStrike - 1) * 100).toFixed(3)}%`}
                    accent={currentPrice >= latestStrike ? 'success' : 'danger'}
                  />
                ) : null}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-[1.75rem] border border-[color:var(--border-subtle)] bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.015))] p-3 sm:p-4">
          <div ref={chartContainerRef} className="w-full" />
        </div>

        {visibleExecutions.length ? (
          <div className="grid gap-3 lg:grid-cols-3 sm:grid-cols-2">
            {visibleExecutions.map((execution) => (
              <ExecutionCard key={execution.id} execution={execution} />
            ))}
          </div>
        ) : null}
      </div>
    </Panel>
  );
};
