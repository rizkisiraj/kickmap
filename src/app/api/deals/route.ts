import { NextResponse } from 'next/server';
import { dealsService } from '@/services/deals.service';
import { rateLimit, getClientIp, isLoadTest } from '@/lib/rate-limit';
import { createLogger } from '@/lib/logger';
import { getTestRun } from '@/lib/test-run';
import type { Region } from '@/types';

const log = createLogger('api:deals');

export const dynamic = 'force-dynamic';

const VALID_REGIONS = new Set<string>(['MY', 'ID', 'SG', 'TH']);
const VALID_SORTS = new Set(['discount_desc', 'price_asc', 'recent']);

export async function GET(request: Request): Promise<NextResponse> {
  const startTime = Date.now();
  const url = new URL(request.url);
  const ip = getClientIp(request);
  const testRun = getTestRun(request);

  const rl = isLoadTest(request) ? { success: true, remaining: 60 } : await rateLimit(ip, 'rl:deals', 60, 60);
  if (!rl.success) {
    const duration = Date.now() - startTime;
    log.warn({ ip, retryAfter: rl.retryAfter, status: 429, duration, ...(testRun !== undefined ? { testRun } : {}) }, 'Rate limited');
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfter ?? 60) } },
    );
  }

  const regionParam = url.searchParams.get('region');
  if (regionParam !== null && !VALID_REGIONS.has(regionParam)) {
    const duration = Date.now() - startTime;
    log.warn({ ip, region: regionParam, status: 400, duration, ...(testRun !== undefined ? { testRun } : {}) }, 'Invalid region param');
    return NextResponse.json({ error: 'Invalid region' }, { status: 400 });
  }

  const sortParam = url.searchParams.get('sort');
  if (sortParam !== null && !VALID_SORTS.has(sortParam)) {
    const duration = Date.now() - startTime;
    log.warn({ ip, sort: sortParam, status: 400, duration, ...(testRun !== undefined ? { testRun } : {}) }, 'Invalid sort param');
    return NextResponse.json({ error: 'Invalid sort value' }, { status: 400 });
  }

  const limitParam = url.searchParams.get('limit');
  const limit = limitParam !== null ? Math.min(200, parseInt(limitParam, 10) || 50) : undefined;
  const cursor = url.searchParams.get('cursor') ?? undefined;

  const result = await dealsService.getDeals({
    ...(regionParam !== null ? { region: regionParam as Region } : {}),
    ...(sortParam !== null ? { sort: sortParam as 'discount_desc' | 'price_asc' | 'recent' } : {}),
    ...(limit !== undefined ? { limit } : {}),
    ...(cursor !== undefined ? { cursor } : {}),
  });

  if (!result.success) {
    log.error(
      { error: result.error.message, status: 500, duration: Date.now() - startTime, ...(testRun !== undefined ? { testRun } : {}) },
      'Deals API error',
    );
    return NextResponse.json({ error: result.error.message }, { status: 500 });
  }

  const duration = Date.now() - startTime;
  log.info(
    {
      duration,
      status: 200,
      resultCount: result.data.data.length,
      total: result.data.meta.total,
      ...(testRun !== undefined ? { testRun } : {}),
    },
    'Deals request completed',
  );

  return NextResponse.json(result.data, {
    headers: { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600' },
  });
}
