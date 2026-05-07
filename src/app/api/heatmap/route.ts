import { NextResponse } from 'next/server';
import { heatmapService } from '@/services/heatmap.service';
import { rateLimit, getClientIp } from '@/lib/rate-limit';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:heatmap');

export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<NextResponse> {
  const startTime = Date.now();
  const ip = getClientIp(request);

  const rl = await rateLimit(ip, 'rl:heatmap', 60, 60);
  if (!rl.success) {
    log.warn({ ip, retryAfter: rl.retryAfter }, 'Rate limited');
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfter ?? 60) } },
    );
  }

  const result = await heatmapService.getHeatmapData();

  if (!result.success) {
    log.error({ error: result.error.message, duration: Date.now() - startTime }, 'Heatmap API error');
    return NextResponse.json({ error: result.error.message }, { status: 500 });
  }

  const duration = Date.now() - startTime;
  log.info({ duration }, 'Heatmap request completed');

  return NextResponse.json({ data: result.data }, {
    headers: { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=1800' },
  });
}
