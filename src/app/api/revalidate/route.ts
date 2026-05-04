import { NextResponse } from 'next/server';
import { redis } from '@/lib/redis';
import { env } from '@/env';

// Called by the scraper after each run to bust product/heatmap caches.
// POST /api/revalidate
// Header: Authorization: Bearer <SCRAPER_SECRET>
export async function POST(request: Request): Promise<NextResponse> {
  const auth = request.headers.get('authorization');
  if (auth !== `Bearer ${env.SCRAPER_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Delete all product lists, deals, and heatmap — keep product details and exchange rates
  const patterns = ['products:*', 'heatmap:*'];
  const deleted: string[] = [];

  for (const pattern of patterns) {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
      deleted.push(...keys);
    }
  }

  return NextResponse.json({ ok: true, deleted: deleted.length, keys: deleted });
}
