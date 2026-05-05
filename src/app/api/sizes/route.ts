import { NextResponse } from 'next/server';
import { withCache, CACHE_TTL } from '@/lib/cache';
import { connectDB } from '@/db/connection';
import { JDRegionStockModel } from '@/db/models/JDRegionStock';

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
  const sizes = await withCache('products:sizes', CACHE_TTL.PRODUCTS, fetchAvailableSizes);
  return NextResponse.json(sizes);
};
