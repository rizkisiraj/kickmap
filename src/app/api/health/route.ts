import { NextResponse } from 'next/server';
import { connectDB } from '@/db/connection';
import { redis } from '@/lib/redis';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:health');

export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  const [mongoResult, redisResult] = await Promise.allSettled([
    connectDB().then(() => 'up' as const),
    redis.ping().then(() => 'up' as const),
  ]);

  const mongodb = mongoResult.status === 'fulfilled' ? mongoResult.value : ('down' as const);
  const redisStatus = redisResult.status === 'fulfilled' ? redisResult.value : ('down' as const);

  let status: 'ok' | 'degraded' | 'down';
  if (mongodb === 'up' && redisStatus === 'up') {
    status = 'ok';
  } else if (mongodb === 'down' && redisStatus === 'down') {
    status = 'down';
    log.error({ mongodb, redis: redisStatus }, 'Health check: all services down');
  } else {
    status = 'degraded';
    log.warn({ mongodb, redis: redisStatus }, 'Health check: degraded');
  }

  return NextResponse.json(
    {
      status,
      timestamp: new Date().toISOString(),
      services: { mongodb, redis: redisStatus },
      version: process.env['npm_package_version'] ?? '0.0.0',
      uptime: process.uptime(),
    },
    { status: status === 'down' ? 503 : 200 },
  );
}
