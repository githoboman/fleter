import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit') || '1', 10);

  // --- Latest single price (used by polling fallback) ---
  if (limit <= 1) {
    try {
      const res = await fetch(
        'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd',
        { next: { revalidate: 5 } }
      );
      if (!res.ok) throw new Error(`CoinGecko status ${res.status}`);
      const json = await res.json();
      const price = json?.bitcoin?.usd;
      if (!price) throw new Error('Missing price in response');
      const now = Date.now();
      return NextResponse.json([[now, String(price), String(price), String(price), String(price)]]);
    } catch (err) {
      console.error('[/api/price] single price error:', err);
      return NextResponse.json({ error: 'Failed to fetch price' }, { status: 500 });
    }
  }

  // --- Historical candles (used by initial chart load) ---
  // Use CoinGecko market_chart which returns [{timestamp, price}] array — very reliable
  try {
    // days=1 gives ~minute-level data points
    const days = Math.min(Math.ceil(limit / 60), 7);
    const res = await fetch(
      `https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=${days}&interval=minutely`,
      { next: { revalidate: 60 } }
    );

    if (!res.ok) throw new Error(`CoinGecko market_chart status ${res.status}`);
    const json = await res.json();
    const prices: [number, number][] = json?.prices;

    if (!Array.isArray(prices) || prices.length === 0) {
      throw new Error('Empty or invalid prices array from CoinGecko');
    }

    // Convert to Binance-compatible [openTime, open, high, low, close] format
    // Since we only have price points (no OHLC), use each price for all OHLC fields
    const candles = prices.slice(-limit).map(([ts, price]) => [
      ts,
      String(price),
      String(price),
      String(price),
      String(price),
    ]);

    return NextResponse.json(candles);
  } catch (err) {
    console.error('[/api/price] history error:', err);
    return NextResponse.json({ error: 'Failed to fetch price history' }, { status: 500 });
  }
}
