import { NextResponse } from 'next/server';
import { productService } from '@/services/product.service';
import { rateLimit, getClientIp } from '@/lib/rate-limit';
import type { Region } from '@/types';

export const dynamic = 'force-dynamic';

const VALID_REGIONS = new Set<string>(['MY', 'ID', 'SG']);

export async function GET(request: Request): Promise<NextResponse> {
  const ip = getClientIp(request);
  const rl = await rateLimit(ip, 'rl:products', 100, 60);
  if (!rl.success) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfter ?? 60), 'X-RateLimit-Remaining': '0' } },
    );
  }

  const { searchParams } = new URL(request.url);
  const regionParam = searchParams.get('region');
  if (regionParam !== null && !VALID_REGIONS.has(regionParam)) {
    return NextResponse.json({ error: 'Invalid region' }, { status: 400 });
  }

  const vendor = searchParams.get('vendor') ?? undefined;
  const inStockParam = searchParams.get('inStock');
  const size = searchParams.get('size') ?? undefined;
  const gender = searchParams.get('gender') ?? undefined;
  const onSaleOnly = searchParams.get('onSaleOnly') === 'true' ? true : undefined;
  const model = searchParams.get('model') ?? undefined;
  const q = searchParams.get('q') ?? undefined;
  const multiRegion = searchParams.get('multiRegion') === 'true' ? true : undefined;
  const cursor = searchParams.get('cursor') ?? undefined;
  const limitRaw = Math.min(500, parseInt(searchParams.get('limit') ?? '24', 10) || 24);

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
    return NextResponse.json({ error: result.error.message }, { status: 500 });
  }

  return NextResponse.json(result.data, {
    headers: { 'X-RateLimit-Remaining': String(rl.remaining) },
  });
}
