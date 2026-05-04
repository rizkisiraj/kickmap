import { NextResponse } from 'next/server';
import { productService } from '@/services/product.service';
import { rateLimit, getClientIp } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  context: { params: Promise<{ productCode: string }> },
): Promise<NextResponse> {
  const ip = getClientIp(request);
  const rl = await rateLimit(ip, 'rl:product-detail', 100, 60);
  if (!rl.success) {
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
    return NextResponse.json({ error: result.error.message }, { status });
  }

  return NextResponse.json(result.data);
}
