import { NextResponse } from 'next/server';
import { exchangeService } from '@/services/exchange.service';
import { rateLimit, getClientIp } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<NextResponse> {
  const ip = getClientIp(request);
  const rl = await rateLimit(ip, 'rl:exchange', 500, 60);
  if (!rl.success) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfter ?? 60) } },
    );
  }

  const result = await exchangeService.getExchangeRates();

  if (!result.success) {
    return NextResponse.json(
      { error: result.error.message },
      { status: 503, headers: { 'X-Cache-Status': result.cacheStatus } },
    );
  }

  return NextResponse.json(result.data, {
    headers: { 'X-Cache-Status': result.cacheStatus },
  });
}
