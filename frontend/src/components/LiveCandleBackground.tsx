'use client';

import { useEffect, useRef } from 'react';

interface CandleData {
  open: number;
  high: number;
  low: number;
  close: number;
  x: number;
  animated: number;
}

export function LiveCandleBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let frame = 0;
    const candles: CandleData[] = [];
    const numCandles = 60;
    const basePrice = 60000;

    // Generate flowing candlestick data
    let price = basePrice;
    for (let i = 0; i < numCandles; i++) {
      const change = (Math.random() - 0.48) * 800;
      const open = price;
      price += change;
      const close = price;
      const high = Math.max(open, close) + Math.random() * 400;
      const low = Math.min(open, close) - Math.random() * 400;
      candles.push({ open, high, low, close, x: i, animated: 0 });
    }

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      frame++;

      const w = canvas.width;
      const h = canvas.height;
      const candleW = w / numCandles;
      const allPrices = candles.flatMap(c => [c.high, c.low]);
      const minP = Math.min(...allPrices);
      const maxP = Math.max(...allPrices);
      const priceRange = maxP - minP;
      const padding = h * 0.15;

      const toY = (price: number) =>
        padding + ((maxP - price) / priceRange) * (h - padding * 2);

      candles.forEach((c, i) => {
        c.animated = Math.min(1, c.animated + 0.02);
        const x = i * candleW + candleW * 0.5;
        const bodyTop = toY(Math.max(c.open, c.close));
        const bodyBot = toY(Math.min(c.open, c.close));
        const isUp = c.close >= c.open;
        const color = isUp ? '#10b981' : '#ef4444';
        const glowColor = isUp ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)';

        // Animate in with wave effect
        const wave = Math.sin(frame * 0.02 + i * 0.3) * 0.05 + 0.95;
        const alpha = 0.25 * c.animated * wave;

        // Glow behind candle
        const grd = ctx.createLinearGradient(x - candleW, bodyTop, x + candleW, bodyBot);
        grd.addColorStop(0, 'transparent');
        grd.addColorStop(0.5, glowColor);
        grd.addColorStop(1, 'transparent');
        ctx.fillStyle = grd;
        ctx.globalAlpha = alpha;
        ctx.fillRect(x - candleW * 1.5, bodyTop - 10, candleW * 3, bodyBot - bodyTop + 20);

        // Wick
        ctx.globalAlpha = alpha * 1.4;
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, toY(c.high));
        ctx.lineTo(x, toY(c.low));
        ctx.stroke();

        // Body
        const bodyH = Math.max(2, bodyBot - bodyTop);
        ctx.fillStyle = color;
        ctx.globalAlpha = alpha * 1.6;
        ctx.fillRect(x - candleW * 0.32, bodyTop, candleW * 0.64, bodyH);
      });

      ctx.globalAlpha = 1;
      animId = requestAnimationFrame(draw);
    };

    draw();
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-0"
    />
  );
}
