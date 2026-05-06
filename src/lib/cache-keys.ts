import type { Region } from '@/types';

export const CACHE_KEYS = {
  productsAll: () => 'products:all',
  productsByRegion: (region: Region) => `products:region:${region}`,
  productsByVendor: (vendor: string) => `products:vendor:${vendor.toLowerCase()}`,
  productsBySize: (size: string) => `products:size:${size}`,
  productDetail: (code: string) => `product:${code}`,
  deals: () => 'products:deals',
  heatmap: () => 'heatmap:regions',
  exchangeRates: () => 'exchange:rates',
  exchangeRatesStale: () => 'exchange:rates:stale',
  searchQuery: (q: string) => `products:search:${q.toLowerCase().trim()}`,
} as const;
