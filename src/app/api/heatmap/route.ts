import { NextResponse } from 'next/server';
import { heatmapService } from '@/services/heatmap.service';
import { rateLimit, getClientIp, isLoadTest } from '@/lib/rate-limit';
import { createLogger } from '@/lib/logger';
import { getTestRun } from '@/lib/test-run';

const log = createLogger('api:heatmap');

export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<NextResponse> {
  const startTime = Date.now();
  const ip = getClientIp(request);
  const testRun = getTestRun(request);

  const rl = isLoadTest(request) ? { success: true, remaining: 60 } : await rateLimit(ip, 'rl:heatmap', 60, 60);
  if (!rl.success) {
    const duration = Date.now() - startTime;
    log.warn({ ip, retryAfter: rl.retryAfter, status: 429, duration, ...(testRun !== undefined ? { testRun } : {}) }, 'Rate limited');
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfter ?? 60) } },
    );
  }

  const result = await heatmapService.getHeatmapData();

  if (!result.success) {
    log.error(
      { error: result.error.message, status: 500, duration: Date.now() - startTime, ...(testRun !== undefined ? { testRun } : {}) },
      'Heatmap API error',
    );
    return NextResponse.json({ error: result.error.message }, { status: 500 });
  }

  const duration = Date.now() - startTime;
  log.info({ duration, status: 200, ...(testRun !== undefined ? { testRun } : {}) }, 'Heatmap request completed');

  return NextResponse.json({ data: result.data }, {
    headers: { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=1800' },
  });
}
