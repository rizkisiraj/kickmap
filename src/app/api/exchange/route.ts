import { NextResponse } from 'next/server';
import { exchangeService } from '@/services/exchange.service';
import { rateLimit, getClientIp, isLoadTest } from '@/lib/rate-limit';
import { createLogger } from '@/lib/logger';
import { getTestRun } from '@/lib/test-run';

const log = createLogger('api:exchange');

export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<NextResponse> {
  const startTime = Date.now();
  const ip = getClientIp(request);
  const testRun = getTestRun(request);

  const rl = isLoadTest(request) ? { success: true, remaining: 30 } : await rateLimit(ip, 'rl:exchange', 30, 60);
  if (!rl.success) {
    const duration = Date.now() - startTime;
    log.warn({ ip, retryAfter: rl.retryAfter, status: 429, duration, ...(testRun !== undefined ? { testRun } : {}) }, 'Rate limited');
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfter ?? 60) } },
    );
  }

  const result = await exchangeService.getExchangeRates();

  if (!result.success) {
    log.error(
      {
        error: result.error.message,
        status: 503,
        duration: Date.now() - startTime,
        cacheStatus: result.cacheStatus,
        ...(testRun !== undefined ? { testRun } : {}),
      },
      'Exchange API error',
    );
    return NextResponse.json(
      { error: result.error.message },
      { status: 503, headers: { 'X-Cache-Status': result.cacheStatus } },
    );
  }

  const duration = Date.now() - startTime;
  log.info(
    { duration, status: 200, cacheStatus: result.cacheStatus, ...(testRun !== undefined ? { testRun } : {}) },
    'Exchange request completed',
  );

  return NextResponse.json(result.data, {
    headers: {
      'X-Cache-Status': result.cacheStatus,
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=7200',
    },
  });
}
