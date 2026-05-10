import { NextResponse } from 'next/server';
import { dealsService } from '@/services/deals.service';
import { rateLimit, getClientIp } from '@/lib/rate-limit';
import { createLogger } from '@/lib/logger';
import type { Region } from '@/types';

const log = createLogger('api:deals');

export const dynamic = 'force-dynamic';

const VALID_REGIONS = new Set<string>(['MY', 'ID', 'SG', 'TH']);
const VALID_SORTS = new Set(['discount_desc', 'price_asc', 'recent']);

export async function GET(request: Request): Promise<NextResponse> {
  const startTime = Date.now();
  const url = new URL(request.url);
  const ip = getClientIp(request);

  const rl = await rateLimit(ip, 'rl:deals', 60, 60);
  if (!rl.success) {
    log.warn({ ip, retryAfter: rl.retryAfter }, 'Rate limited');
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfter ?? 60) } },
    );
  }

  const regionParam = url.searchParams.get('region');
  if (regionParam !== null && !VALID_REGIONS.has(regionParam)) {
    log.warn({ ip, region: regionParam }, 'Invalid region param');
    return NextResponse.json({ error: 'Invalid region' }, { status: 400 });
  }

  const sortParam = url.searchParams.get('sort');
  if (sortParam !== null && !VALID_SORTS.has(sortParam)) {
    log.warn({ ip, sort: sortParam }, 'Invalid sort param');
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
    log.error({ error: result.error.message, duration: Date.now() - startTime }, 'Deals API error');
    return NextResponse.json({ error: result.error.message }, { status: 500 });
  }

  const duration = Date.now() - startTime;
  log.info({ duration, resultCount: result.data.data.length, total: result.data.meta.total }, 'Deals request completed');

  return NextResponse.json(result.data, {
    headers: { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600' },
  });
}
