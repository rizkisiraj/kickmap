import { NextResponse } from 'next/server';
import { redis } from '@/lib/redis';
import { env } from '@/env';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:revalidate');

// Called by the scraper after each run to bust product/heatmap caches.
// POST /api/revalidate
// Header: Authorization: Bearer <SCRAPER_SECRET>
export async function POST(request: Request): Promise<NextResponse> {
  const startTime = Date.now();
  const auth = request.headers.get('authorization');
  if (auth !== `Bearer ${env.SCRAPER_SECRET}`) {
    log.warn({ ip: request.headers.get('x-forwarded-for') }, 'Revalidate unauthorized');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Delete all product lists, deals, and heatmap — keep product details and exchange rates
    const patterns = ['products:*', 'heatmap:*'];
    let deletedCount = 0;

    for (const pattern of patterns) {
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(...keys);
        deletedCount += keys.length;
      }
    }

    const duration = Date.now() - startTime;
    log.info({ duration, deletedCount, patterns }, 'Revalidate completed');

    return NextResponse.json({ ok: true, deleted: deletedCount });
  } catch (err) {
    log.error({ err: (err as Error).message, duration: Date.now() - startTime }, 'Revalidate failed');
    return NextResponse.json({ error: 'Revalidation failed' }, { status: 500 });
  }
}
