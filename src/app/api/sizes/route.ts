import { NextResponse } from 'next/server';
import { withCache, CACHE_TTL } from '@/lib/cache';
import { connectDB } from '@/db/connection';
import { JDRegionStockModel } from '@/db/models/JDRegionStock';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:sizes');

async function fetchAvailableSizes(): Promise<string[]> {
  await connectDB();
  const result = await JDRegionStockModel.aggregate<{ sizes: string[] }>([
    { $match: { inStock: true } },
    { $unwind: '$sizesAvailable' },
    { $group: { _id: null, sizes: { $addToSet: '$sizesAvailable' } } },
  ]);
  return result[0]?.sizes ?? [];
}

export const GET = async (): Promise<NextResponse> => {
  const startTime = Date.now();
  try {
    const sizes = await withCache('products:sizes', CACHE_TTL.PRODUCTS, fetchAvailableSizes);
    const duration = Date.now() - startTime;
    log.info({ duration, sizeCount: sizes.length }, 'Sizes request completed');
    return NextResponse.json(sizes);
  } catch (err) {
    const duration = Date.now() - startTime;
    log.error({ duration, error: err instanceof Error ? err.message : String(err) }, 'Sizes API error');
    return NextResponse.json({ error: 'Failed to fetch sizes' }, { status: 500 });
  }
};
