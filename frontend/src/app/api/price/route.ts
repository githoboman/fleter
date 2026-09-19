import { NextResponse } from 'next/server';

// CoinGecko public API - no IP restrictions, works from Vercel servers globally
const COINGECKO_BASE = 'https://api.coingecko.com/api/v3';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit') || '1', 10);

  try {
    // For history (limit > 1): fetch OHLC data
    // For latest price (limit === 1): fetch simple price
    if (limit > 1) {
      // Fetch OHLC candles — CoinGecko returns [timestamp, open, high, low, close]
      // days=1 gives minute-level granularity
      const days = Math.ceil(limit / 60) || 1;
      const res = await fetch(
        `${COINGECKO_BASE}/coins/bitcoin/ohlc?vs_currency=usd&days=${days}`,
        { next: { revalidate: 60 } }
      );

      if (!res.ok) {
        const err = await res.text();
        console.error('CoinGecko OHLC error:', err);
        return NextResponse.json({ error: 'Failed to fetch OHLC from CoinGecko' }, { status: 500 });
      }

      const raw: number[][] = await res.json();
      // Convert CoinGecko format [ts, open, high, low, close]
      // to Binance-compatible format [openTime, open, high, low, close, ...]
      const compatible = raw.slice(-limit).map((d) => [
        d[0],        // openTime
        String(d[1]), // open
        String(d[2]), // high
        String(d[3]), // low
        String(d[4]), // close
      ]);

      return NextResponse.json(compatible);
    } else {
      // Single latest price fetch
      const res = await fetch(
        `${COINGECKO_BASE}/simple/price?ids=bitcoin&vs_currencies=usd`,
        { next: { revalidate: 5 } }
      );

      if (!res.ok) {
        return NextResponse.json({ error: 'Failed to fetch price from CoinGecko' }, { status: 500 });
      }

      const data = await res.json();
      const price = data?.bitcoin?.usd;
      if (!price) {
        return NextResponse.json({ error: 'Invalid response from CoinGecko' }, { status: 500 });
      }

      const now = Date.now();
      // Return in Binance-compatible single-candle array format
      const compatible = [[now, String(price), String(price), String(price), String(price)]];
      return NextResponse.json(compatible);
    }
  } catch (error) {
    console.error('Price proxy error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
