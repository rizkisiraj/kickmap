import { NextResponse } from 'next/server';
import { productService } from '@/services/product.service';
import { rateLimit, getClientIp } from '@/lib/rate-limit';
import { createLogger } from '@/lib/logger';
import type { Region } from '@/types';

const log = createLogger('api:products');

export const dynamic = 'force-dynamic';

const VALID_REGIONS = new Set<string>(['MY', 'ID', 'SG', 'TH']);

export async function GET(request: Request): Promise<NextResponse> {
  const startTime = Date.now();
  const url = new URL(request.url);
  const ip = getClientIp(request);

  const rl = await rateLimit(ip, 'rl:products', 100, 60);
  if (!rl.success) {
    log.warn({ ip, retryAfter: rl.retryAfter }, 'Rate limited');
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfter ?? 60), 'X-RateLimit-Remaining': '0' } },
    );
  }

  const regionParam = url.searchParams.get('region');
  if (regionParam !== null && !VALID_REGIONS.has(regionParam)) {
    log.warn({ ip, region: regionParam }, 'Invalid region param');
    return NextResponse.json({ error: 'Invalid region' }, { status: 400 });
  }

  const vendor = url.searchParams.get('vendor') ?? undefined;
  const inStockParam = url.searchParams.get('inStock');
  const size = url.searchParams.get('size') ?? undefined;
  const gender = url.searchParams.get('gender') ?? undefined;
  const onSaleOnly = url.searchParams.get('onSaleOnly') === 'true' ? true : undefined;
  const model = url.searchParams.get('model') ?? undefined;
  const q = url.searchParams.get('q') ?? undefined;
  const multiRegion = url.searchParams.get('multiRegion') === 'true' ? true : undefined;
  const cursor = url.searchParams.get('cursor') ?? undefined;
  const limitRaw = Math.min(500, parseInt(url.searchParams.get('limit') ?? '24', 10) || 24);

  const filters = {
    ...(regionParam !== null ? { region: regionParam as Region } : {}),
    ...(vendor !== undefined ? { vendor } : {}),
    ...(inStockParam !== null ? { inStock: inStockParam === 'true' } : {}),
    ...(size !== undefined ? { size } : {}),
    ...(gender !== undefined ? { gender } : {}),
    ...(onSaleOnly !== undefined ? { onSaleOnly } : {}),
    ...(model !== undefined ? { model } : {}),
    ...(q !== undefined ? { q } : {}),
    ...(multiRegion !== undefined ? { multiRegion } : {}),
  };

  const result = await productService.getProducts(filters, { ...(cursor !== undefined ? { cursor } : {}), limit: limitRaw });

  if (!result.success) {
    log.error({ error: result.error.message, duration: Date.now() - startTime }, 'Products API error');
    return NextResponse.json({ error: result.error.message }, { status: 500 });
  }

  const duration = Date.now() - startTime;
  log.info(
    { duration, resultCount: result.data.data.length, total: result.data.meta.total, filters: Object.keys(filters).join(',') },
    'Products request completed',
  );

  return NextResponse.json(result.data, {
    headers: {
      'X-RateLimit-Remaining': String(rl.remaining),
      'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600',
    },
  });
}
