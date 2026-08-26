import type { Product, ProductFilters, PaginatedResponse, Result } from '@/types';
import { withCache, CACHE_TTL } from '@/lib/cache';
import { CACHE_KEYS } from '@/lib/cache-keys';
import { productRepository } from '@/repositories/product.repository';

interface CursorPaginationParams {
  cursor?: string;
  limit: number;
}

// Page sizes the app itself requests: 20 (deals), 24 (grids/size-finder),
// and 500 (the clamp ceiling that /compare's limit=10000 lands on). Any
// other value bypasses the cache — see the comment in getProducts.
const CACHEABLE_LIMITS = new Set([20, 24, 500]);

export function buildCacheKey(filters: ProductFilters): string {
  const entries = Object.entries(filters)
    .filter(([, v]) => v !== undefined && v !== null)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}:${String(v)}`);

  if (entries.length === 0) return CACHE_KEYS.productsAll();

  if (entries.length === 1) {
    const entry = entries[0];
    if (entry !== undefined) {
      if (entry.startsWith('region:') && filters.region !== undefined) return CACHE_KEYS.productsByRegion(filters.region);
      if (entry.startsWith('vendor:') && filters.vendor !== undefined) return CACHE_KEYS.productsByVendor(filters.vendor);
      if (entry.startsWith('size:') && filters.size !== undefined) return CACHE_KEYS.productsBySize(filters.size);
    }
  }

  return `products:filtered:${entries.join('|')}`;
}

function decodeCursor(cursor: string | undefined): string | null {
  if (!cursor) return null;
  try {
    return Buffer.from(cursor, 'base64').toString('utf8');
  } catch {
    return null;
  }
}

function encodeCursor(productCode: string): string {
  return Buffer.from(productCode, 'utf8').toString('base64');
}

export const productService = {
  async getProducts(
    filters: ProductFilters,
    pagination: CursorPaginationParams = { limit: 24 },
  ): Promise<Result<PaginatedResponse<Product>>> {
    const { cursor, limit } = pagination;
    const afterCode = decodeCursor(cursor);

    // The repository now returns only the requested page (via a $facet
    // pipeline), not the full result set. That means the cache key MUST
    // encode pagination params (cursor + limit) — otherwise every page
    // would collide on the same filter-only key and every request would
    // be served page 1's cached payload regardless of which page was
    // actually requested. We derive the base key from filters (unchanged
    // behaviour/naming for the unfiltered/common cases) and append the
    // pagination params as an extra segment.
    const baseCacheKey = buildCacheKey(filters);
    const cacheKey = `${baseCacheKey}|cursor:${cursor ?? ''}|limit:${limit}`;
    const ttl = (filters.model !== undefined || filters.q !== undefined) ? CACHE_TTL.AUTOCOMPLETE : CACHE_TTL.PRODUCTS;

    // Cache bypass rules — both exist to stop Redis key explosion:
    //  - `q` is free-text, so its key space is unbounded by construction.
    //  - `limit` is caller-controlled (the route clamps it to 500 but
    //    otherwise passes it through). Since it is now part of the cache
    //    key, an arbitrary limit would let one client mint up to 500
    //    distinct entries per filter combination, each pinned for
    //    CACHE_TTL.PRODUCTS (6h). Only the page sizes the UI actually
    //    requests are cacheable; anything else goes straight to Mongo,
    //    which is cheap now that the pipeline pages server-side.
    const shouldCache = filters.q === undefined && CACHEABLE_LIMITS.has(limit);

    const page = shouldCache
      ? await withCache(cacheKey, ttl, () => productRepository.findPage(filters, { afterProductCode: afterCode, limit }))
      : await productRepository.findPage(filters, { afterProductCode: afterCode, limit });

    const { total } = page;
    const hasMore = page.data.length > limit;
    const data = hasMore ? page.data.slice(0, limit) : page.data;
    const nextCursor = hasMore && data.length > 0
      ? encodeCursor(data[data.length - 1]!.productCode)
      : null;

    return {
      success: true,
      data: { data, meta: { nextCursor, hasMore, total, limit } },
    };
  },

  async getByCode(code: string): Promise<Result<Product>> {
    if (!code || !/^[\w-]+$/.test(code)) {
      return {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid product code format' },
      };
    }

    const product = await withCache(
      CACHE_KEYS.productDetail(code),
      CACHE_TTL.PRODUCT_DETAIL,
      () => productRepository.findByCode(code),
    );

    if (!product) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: `Product ${code} not found` },
      };
    }

    return { success: true, data: product };
  },
};
