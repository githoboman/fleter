import { NextResponse } from 'next/server';

const COINGECKO_BASE = 'https://api.coingecko.com/api/v3';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit') || '1', 10);

  try {
    if (limit <= 1) {
      // Live price polling — simple price endpoint, no auth needed
      const res = await fetch(
        `${COINGECKO_BASE}/simple/price?ids=bitcoin&vs_currencies=usd`,
        { next: { revalidate: 5 } }
      );
      if (!res.ok) throw new Error(`CoinGecko ${res.status}`);
      const json = await res.json();
      const price: number = json?.bitcoin?.usd;
      if (!price) throw new Error('No price in response');
      const now = Date.now();
      return NextResponse.json([[now, String(price), String(price), String(price), String(price)]]);
    }

    // Historical chart — use market_chart WITHOUT interval (free tier friendly)
    // days=1 => ~5-min granularity automatically; days=7 => hourly
    const days = limit > 200 ? 1 : 1;
    const res = await fetch(
      `${COINGECKO_BASE}/coins/bitcoin/market_chart?vs_currency=usd&days=${days}`,
      { next: { revalidate: 60 } }
    );
    if (!res.ok) throw new Error(`CoinGecko ${res.status}`);
    const json = await res.json();
    const prices: [number, number][] = json?.prices;
    if (!Array.isArray(prices) || prices.length === 0) throw new Error('Empty prices');

    // Convert [timestamp, price] → Binance-compatible [ts, open, high, low, close]
    const candles = prices.slice(-limit).map(([ts, price]) => [
      ts,
      String(price),
      String(price),
      String(price),
      String(price),
    ]);

    return NextResponse.json(candles);
  } catch (err) {
    console.error('[/api/price] error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
