import { NextResponse } from 'next/server';
import { dealsService } from '@/services/deals.service';
import { rateLimit, getClientIp } from '@/lib/rate-limit';
import type { Region } from '@/types';

export const dynamic = 'force-dynamic';

const VALID_REGIONS = new Set<string>(['MY', 'ID', 'SG']);
const VALID_SORTS = new Set(['discount_desc', 'price_asc', 'recent']);

export async function GET(request: Request): Promise<NextResponse> {
  const ip = getClientIp(request);
  const rl = await rateLimit(ip, 'rl:deals', 60, 60);
  if (!rl.success) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfter ?? 60) } },
    );
  }

  const { searchParams } = new URL(request.url);
  const regionParam = searchParams.get('region');
  if (regionParam !== null && !VALID_REGIONS.has(regionParam)) {
    return NextResponse.json({ error: 'Invalid region' }, { status: 400 });
  }

  const sortParam = searchParams.get('sort');
  if (sortParam !== null && !VALID_SORTS.has(sortParam)) {
    return NextResponse.json({ error: 'Invalid sort value' }, { status: 400 });
  }

  const limitParam = searchParams.get('limit');
  const limit = limitParam !== null ? Math.min(200, parseInt(limitParam, 10) || 50) : undefined;
  const cursor = searchParams.get('cursor') ?? undefined;

  const result = await dealsService.getDeals({
    ...(regionParam !== null ? { region: regionParam as Region } : {}),
    ...(sortParam !== null ? { sort: sortParam as 'discount_desc' | 'price_asc' | 'recent' } : {}),
    ...(limit !== undefined ? { limit } : {}),
    ...(cursor !== undefined ? { cursor } : {}),
  });

  if (!result.success) {
    return NextResponse.json({ error: result.error.message }, { status: 500 });
  }

  return NextResponse.json(result.data);
}
