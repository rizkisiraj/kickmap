import type { Product, ProductFilters, PaginatedResponse, Result } from '@/types';
import { withCache, CACHE_TTL } from '@/lib/cache';
import { CACHE_KEYS } from '@/lib/cache-keys';
import { productRepository } from '@/repositories/product.repository';

interface CursorPaginationParams {
  cursor?: string;
  limit: number;
}

function buildCacheKey(filters: ProductFilters): string {
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
    const cacheKey = buildCacheKey(filters);
    const ttl = (filters.model !== undefined || filters.q !== undefined) ? CACHE_TTL.AUTOCOMPLETE : CACHE_TTL.PRODUCTS;
    const allProducts = await withCache(cacheKey, ttl, () =>
      productRepository.findMany(filters),
    );

    const { cursor, limit } = pagination;
    const total = allProducts.length;

    const afterCode = decodeCursor(cursor);
    let startIndex = 0;
    if (afterCode !== null) {
      const pos = allProducts.findIndex((p) => p.productCode === afterCode);
      startIndex = pos === -1 ? 0 : pos + 1;
    }

    const data = allProducts.slice(startIndex, startIndex + limit);
    const hasMore = startIndex + limit < total;
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
