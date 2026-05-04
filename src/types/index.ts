export type Region = 'MY' | 'ID' | 'SG';
export type Currency = 'MYR' | 'IDR' | 'SGD' | 'USD';
export type StockLevel = 'high' | 'medium' | 'low' | 'none'; // 4 levels

export interface RegionStock {
  region: Region;
  sizesAvailable: string[];
  sizesTotal: string[];
  inStock: boolean;
  totalStock: number;
  price: number;
  originalPrice: number | null;
  isOnSale: boolean;
  currency: Currency;
  scrapedAt: string;
}

export interface Product {
  productCode: string;
  title: string;
  vendor: string;
  imageUrl: string;
  gender: string;
  productType: string;
  colorway?: string;
  stock: RegionStock[];
}

export interface RegionMapData {
  region: Region;
  totalProducts: number;
  inStockCount: number;
  onSaleCount: number;
  stockLevel: StockLevel;
  topBrands: string[];  // top 3 vendor names
  matchedCount?: number; // for filtered heatmap coloring
}

export interface Deal {
  productCode: string;
  title: string;
  colorway?: string;
  imageUrl: string;
  vendor: string;
  region: Region;
  price: number;
  originalPrice: number;
  discountPercent: number;
  currency: Currency;
  totalStock: number;
  scrapedAt: string;
}

export interface CursorMeta {
  nextCursor: string | null;
  hasMore: boolean;
  total: number;
  limit: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: CursorMeta;
}

export interface ExchangeRates {
  base: Currency;
  rates: Record<Currency, number>;
  updatedAt: string;
}

export interface ProductFilters {
  region?: Region;
  vendor?: string;
  inStock?: boolean;
  size?: string;
  gender?: string;
  onSaleOnly?: boolean;
  model?: string;
  q?: string;            // cross-field search: title OR vendor OR colorway
  multiRegion?: boolean; // only products with stock in 2+ distinct regions
}

export type SortOrder = 'discount_desc' | 'price_asc' | 'recent' | 'name' | 'price';

export type AppError =
  | { code: 'NOT_FOUND'; message: string }
  | { code: 'VALIDATION_ERROR'; message: string; fields?: Record<string, string> }
  | { code: 'UPSTREAM_ERROR'; message: string }
  | { code: 'RATE_LIMITED'; message: string; retryAfter: number };

export type Result<T, E = AppError> =
  | { success: true; data: T }
  | { success: false; error: E };
