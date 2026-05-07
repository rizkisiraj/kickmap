import { NextResponse } from 'next/server';
import { productService } from '@/services/product.service';
import { rateLimit, getClientIp } from '@/lib/rate-limit';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:product-detail');

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  context: { params: Promise<{ productCode: string }> },
): Promise<NextResponse> {
  const startTime = Date.now();
  const ip = getClientIp(request);

  const rl = await rateLimit(ip, 'rl:product-detail', 100, 60);
  if (!rl.success) {
    log.warn({ ip, retryAfter: rl.retryAfter }, 'Rate limited');
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfter ?? 60) } },
    );
  }

  const { productCode } = await context.params;

  if (!productCode) {
    return NextResponse.json({ error: 'Invalid product code' }, { status: 400 });
  }

  const result = await productService.getByCode(productCode);

  if (!result.success) {
    const status = result.error.code === 'NOT_FOUND' ? 404 : 400;
    if (status === 404) {
      log.debug({ productCode, duration: Date.now() - startTime }, 'Product not found');
    } else {
      log.error({ productCode, error: result.error.message, duration: Date.now() - startTime }, 'Product detail error');
    }
    return NextResponse.json({ error: result.error.message }, { status });
  }

  const duration = Date.now() - startTime;
  log.info({ productCode, duration }, 'Product detail request completed');

  return NextResponse.json(result.data, {
    headers: { 'Cache-Control': 'public, max-age=3600, stale-while-revalidate=43200' },
  });
}
