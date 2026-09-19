import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = searchParams.get('limit') || '1';

  try {
    const res = await fetch(`https://fapi.binance.com/fapi/v1/klines?symbol=BTCUSDT&interval=1m&limit=${limit}`, {
      next: { revalidate: 1 }, 
    });
    
    if (!res.ok) {
      return NextResponse.json({ error: 'Failed to fetch from Binance' }, { status: 500 });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
