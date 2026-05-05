'use client';
import React, { useState, useMemo, useEffect, useRef } from 'react';
import type { Product, RegionMapData, ProductFilters, StockLevel, PaginatedResponse } from '@/types';
import { RegionMap } from '@/components/RegionMap';
import { HeatmapFilterBar } from '@/components/HeatmapFilterBar';
import { AnnouncementBanner } from '@/components/AnnouncementBanner';

interface HomepageClientProps {
  initialRegionData: RegionMapData[];
  allProducts: Product[];
  brands: string[];
  topDeal: Product | null;
}

function buildQueryString(filters: ProductFilters): string {
  const params = new URLSearchParams();
  if (filters.vendor !== undefined) params.set('vendor', filters.vendor);
  if (filters.size !== undefined) params.set('size', filters.size);
  if (filters.model !== undefined) params.set('model', filters.model);
  if (filters.gender !== undefined) params.set('gender', filters.gender);
  if (filters.onSaleOnly === true) params.set('onSaleOnly', 'true');
  params.set('limit', '500');
  return params.toString();
}

export function HomepageClient({ initialRegionData, allProducts, brands, topDeal }: HomepageClientProps) {
  const [filters, setFilters] = useState<ProductFilters>({});
  const [fetchedProducts, setFetchedProducts] = useState<Product[] | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hasActiveFilters =
    filters.vendor !== undefined ||
    filters.size !== undefined ||
    filters.model !== undefined ||
    filters.gender !== undefined ||
    filters.onSaleOnly === true;

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!hasActiveFilters) {
      setFetchedProducts(null);
      return;
    }

    debounceRef.current = setTimeout(() => {
      const qs = buildQueryString(filters);
      fetch(`/api/products?${qs}`)
        .then((res) => res.json() as Promise<PaginatedResponse<Product>>)
        .then((json) => { setFetchedProducts(json.data); })
        .catch(() => { setFetchedProducts(null); });
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [filters, hasActiveFilters]);

  const displayProducts = fetchedProducts ?? allProducts;

  const regionData: RegionMapData[] = useMemo(() => {
    if (!hasActiveFilters) return initialRegionData;
    return initialRegionData.map((rd) => {
      const matched = displayProducts.filter((p) =>
        p.stock.some((s) => s.region === rd.region && s.inStock),
      ).length;
      const onSaleCount = displayProducts.filter((p) =>
        p.stock.some((s) => s.region === rd.region && s.isOnSale && s.inStock),
      ).length;
      const stockLevel: StockLevel =
        matched > 200 ? 'high' : matched > 60 ? 'medium' : matched > 0 ? 'low' : 'none';
      return { ...rd, matchedCount: matched, onSaleCount, stockLevel };
    });
  }, [initialRegionData, displayProducts, hasActiveFilters]);

  const totalOnSale = displayProducts.filter((p) => p.stock.some((s) => s.isOnSale)).length;

  return (
    <>
    <AnnouncementBanner product={topDeal} />
    <div className="page-wrap">
      {/* Hero */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '32px 0 24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--text)', lineHeight: 1.2, margin: 0 }}>
            Find your size.{' '}
            <span style={{ color: 'var(--accent)' }}>Find the best price.</span>
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text2)', marginTop: '6px' }}>
            Live JD Sports stock · MY · ID · SG
            {hasActiveFilters && (
              <span style={{ color: 'var(--accent)', marginLeft: '8px' }}>
                · {displayProducts.length} products matched
              </span>
            )}
          </p>
        </div>
        <div className="hero-stats" style={{ gap: '16px' }}>
          <StatPill value={displayProducts.length} label="Matched" />
          <StatPill value={totalOnSale} label="On Sale" />
          <StatPill value={3} label="Regions" />
        </div>
      </div>

      {/* Filter bar */}
      <div style={{ marginBottom: '16px' }}>
        <HeatmapFilterBar filters={filters} onFiltersChange={setFilters} brands={brands} allProducts={allProducts} />
      </div>

      {/* Map + sidebar */}
      <RegionMap
        regionData={regionData}
        hasActiveFilters={hasActiveFilters}
        filters={filters}
      />
    </div>
    </>
  );
}

function StatPill({ value, label }: { value: number; label: string }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '20px', fontWeight: 800, color: 'var(--text)', lineHeight: 1 }}>
        {value}
      </div>
      <div style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text3)', marginTop: '3px' }}>
        {label}
      </div>
    </div>
  );
}
