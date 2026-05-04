import type { Deal, Region, Result, PaginatedResponse } from '@/types';
import { withCache, CACHE_TTL } from '@/lib/cache';
import { CACHE_KEYS } from '@/lib/cache-keys';
import { dealsRepository } from '@/repositories/deals.repository';

type DealsSortOrder = 'discount_desc' | 'price_asc' | 'recent';

interface DealsParams {
  region?: Region;
  sort?: DealsSortOrder;
  limit?: number;
  cursor?: string;
}

function decodeDealsCursor(cursor: string | undefined): { productCode: string; region: string } | null {
  if (!cursor) return null;
  try {
    const decoded = Buffer.from(cursor, 'base64').toString('utf8');
    const pipeIdx = decoded.indexOf('|');
    if (pipeIdx === -1) return null;
    const productCode = decoded.slice(0, pipeIdx);
    const region = decoded.slice(pipeIdx + 1);
    if (!productCode || !region) return null;
    return { productCode, region };
  } catch {
    return null;
  }
}

function encodeDealsCursor(productCode: string, region: string): string {
  return Buffer.from(`${productCode}|${region}`, 'utf8').toString('base64');
}

export const dealsService = {
  async getDeals(params: DealsParams = {}): Promise<Result<PaginatedResponse<Deal>>> {
    const allDeals = await withCache(
      CACHE_KEYS.deals(),
      CACHE_TTL.DEALS,
      () => dealsRepository.findOnSale(),
    );

    let result = params.region !== undefined
      ? allDeals.filter((d) => d.region === params.region)
      : allDeals;

    const sort = params.sort ?? 'discount_desc';
    if (sort === 'discount_desc') {
      result = [...result].sort((a, b) => b.discountPercent - a.discountPercent);
    } else if (sort === 'price_asc') {
      result = [...result].sort((a, b) => a.price - b.price);
    } else {
      result = [...result].sort(
        (a, b) => new Date(b.scrapedAt).getTime() - new Date(a.scrapedAt).getTime(),
      );
    }

    const limit = params.limit ?? 20;
    const afterCursor = decodeDealsCursor(params.cursor);
    let startIndex = 0;

    if (afterCursor !== null) {
      const pos = result.findIndex(
        (d) => d.productCode === afterCursor.productCode && d.region === afterCursor.region,
      );
      startIndex = pos === -1 ? 0 : pos + 1;
    }

    const page = result.slice(startIndex, startIndex + limit);
    const lastItem = page[page.length - 1];
    const hasMore = startIndex + limit < result.length;
    const nextCursor = hasMore && lastItem !== undefined
      ? encodeDealsCursor(lastItem.productCode, lastItem.region)
      : null;

    return {
      success: true,
      data: {
        data: page,
        meta: { nextCursor, hasMore, total: result.length, limit },
      },
    };
  },
};
