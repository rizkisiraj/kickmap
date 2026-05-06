import useSWR from 'swr';
import type { Product, ProductFilters, PaginatedResponse } from '@/types';

async function fetcher<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Fetch failed: ${res.status} ${body}`);
  }
  return res.json() as Promise<T>;
}

function buildProductsUrl(filters: ProductFilters): string {
  const params = new URLSearchParams();
  const entries = Object.entries(filters).sort(([a], [b]) => a.localeCompare(b));
  for (const [key, value] of entries) {
    if (value !== undefined && value !== null && value !== '') {
      params.set(key, String(value));
    }
  }
  const qs = params.toString();
  return `/api/products${qs ? `?${qs}` : ''}`;
}

export function useProducts(filters: ProductFilters = {}) {
  const url = buildProductsUrl(filters);
  const { data, error, isLoading, isValidating } = useSWR<PaginatedResponse<Product>>(url, fetcher, {
    keepPreviousData: true,
    revalidateOnFocus: false,
    dedupingInterval: 5 * 60 * 1000,
    onError: (err) => {
      console.error('[useProducts] SWR error:', err.message, 'url:', url);
    },
  });

  return {
    products: data?.data ?? [],
    nextCursor: data?.meta.nextCursor ?? null,
    hasMore: data?.meta.hasMore ?? false,
    total: data?.meta.total ?? 0,
    isLoading,
    isValidating,
    error: error as Error | undefined,
  };
}
