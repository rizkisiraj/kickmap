'use client';
import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import type { RegionMapData, Product, Region, ProductFilters } from '@/types';
import { MapTooltip } from './MapTooltip';
import { SlidePanel } from './SlidePanel';
import { RegionStatCard } from './RegionStatCard';
import { STOCK_LEVEL_LEGEND } from './useRegionColor';

async function fetchRegionProducts(
  region: Region,
  filters: ProductFilters,
  cursor?: string,
): Promise<{ data: Product[]; meta: { nextCursor: string | null; hasMore: boolean; total: number } }> {
  const params = new URLSearchParams({ region, inStock: 'true', limit: '20' });
  if (cursor) params.set('cursor', cursor);
  if (filters.vendor !== undefined) params.set('vendor', filters.vendor);
  if (filters.size !== undefined) params.set('size', filters.size);
  if (filters.model !== undefined) params.set('model', filters.model);
  if (filters.gender !== undefined) params.set('gender', filters.gender);
  if (filters.onSaleOnly === true) params.set('onSaleOnly', 'true');
  const res = await fetch(`/api/products?${params.toString()}`);
  if (!res.ok) return { data: [], meta: { nextCursor: null, hasMore: false, total: 0 } };
  return res.json() as Promise<{ data: Product[]; meta: { nextCursor: string | null; hasMore: boolean; total: number } }>;
}

const MapInner = dynamic(() => import('./MapInner'), {
  ssr: false,
  loading: () => (
    <div style={{ aspectRatio: '420/310', background: '#0d1117', borderRadius: '10px', border: '1px solid var(--border)', animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' }} />
  ),
});

interface RegionInfo {
  id: Region;
  label: string;
}

interface RegionMapProps {
  regionData: RegionMapData[];
  hasActiveFilters: boolean;
  filters: ProductFilters;
}

const REGION_NAMES: Record<Region, string> = { MY: 'Malaysia', ID: 'Indonesia', SG: 'Singapore', TH: 'Thailand' };
const REGIONS: Region[] = ['MY', 'ID', 'SG', 'TH'];

export function RegionMap({ regionData, hasActiveFilters, filters }: RegionMapProps) {
  const [tooltip, setTooltip] = useState<{ region: RegionInfo; pos: { x: number; y: number } } | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<RegionInfo | null>(null);
  const [slideProducts, setSlideProducts] = useState<Product[]>([]);
  const [slideLoading, setSlideLoading] = useState(false);
  const [slideCursor, setSlideCursor] = useState<string | null>(null);
  const [slideHasMore, setSlideHasMore] = useState(false);
  const [slideTotal, setSlideTotal] = useState(0);
  const [slideLoadingMore, setSlideLoadingMore] = useState(false);

  const handleRegionHover = (region: RegionInfo | null, pos: { x: number; y: number } | null) => {
    if (region && pos) {
      setTooltip({ region, pos });
    } else {
      setTooltip(null);
    }
  };

  const handleRegionClick = (region: RegionInfo) => {
    setSelectedRegion(region);
    setSlideProducts([]);
    setSlideCursor(null);
    setSlideHasMore(false);
    setSlideLoading(true);
    fetchRegionProducts(region.id, filters)
      .then((json) => {
        setSlideProducts(json.data);
        setSlideCursor(json.meta.nextCursor);
        setSlideHasMore(json.meta.hasMore);
        setSlideTotal(json.meta.total);
      })
      .finally(() => { setSlideLoading(false); });
  };

  const handleLoadMore = () => {
    if (!selectedRegion || slideCursor === null || slideLoadingMore) return;
    setSlideLoadingMore(true);
    fetchRegionProducts(selectedRegion.id, filters, slideCursor)
      .then((json) => {
        setSlideProducts((prev) => [...prev, ...json.data]);
        setSlideCursor(json.meta.nextCursor);
        setSlideHasMore(json.meta.hasMore);
      })
      .finally(() => { setSlideLoadingMore(false); });
  };

  const tooltipRegionData = tooltip
    ? regionData.find((d) => d.region === tooltip.region.id)
    : undefined;

  return (
    <div className="map-section">
      {/* Map */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <MapInner
          regionData={regionData}
          onRegionClick={handleRegionClick}
          onRegionHover={handleRegionHover}
        />
      </div>

      {/* Sidebar */}
      <div className="map-sidebar">
        {/* Legend */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 12px' }}>
          <div style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text3)', textTransform: 'uppercase', marginBottom: '8px' }}>
            STOCK LEVEL
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            {STOCK_LEVEL_LEGEND.map(({ color, label }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: color, flexShrink: 0 }} />
                <span style={{ fontSize: '10px', color: 'var(--text2)' }}>{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Region stat cards */}
        {REGIONS.map((region) => {
          const data = regionData.find((d) => d.region === region);
          if (!data) return null;
          return (
            <RegionStatCard
              key={region}
              data={data}
              onClick={() => handleRegionClick({ id: region, label: REGION_NAMES[region] })}
              hasActiveFilters={hasActiveFilters}
            />
          );
        })}

        {/* Compare button */}
        <Link
          href="/compare"
          style={{ display: 'block', padding: '9px', textAlign: 'center', fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', background: 'var(--surface)', color: 'var(--text2)', border: '1px solid var(--border)', borderRadius: '8px', textDecoration: 'none', transition: 'all 0.15s' }}
        >
          COMPARE PRICES →
        </Link>
      </div>

      {/* Tooltip (cursor-following) */}
      {tooltip !== null && tooltipRegionData !== undefined && (
        <MapTooltip
          region={tooltip.region}
          pos={tooltip.pos}
          stats={{
            total: tooltipRegionData.matchedCount ?? tooltipRegionData.inStockCount,
            onSale: tooltipRegionData.onSaleCount,
            topBrand: tooltipRegionData.topBrands[0] ?? '—',
          }}
          stockLevel={tooltipRegionData.stockLevel}
          matchedCount={tooltipRegionData.matchedCount ?? tooltipRegionData.inStockCount}
          totalCount={tooltipRegionData.totalProducts}
        />
      )}

      {/* Slide panel */}
      {selectedRegion !== null && (
        <SlidePanel
          region={selectedRegion}
          products={slideProducts}
          loading={slideLoading}
          hasMore={slideHasMore}
          loadingMore={slideLoadingMore}
          total={slideTotal}
          onLoadMore={handleLoadMore}
          onClose={() => setSelectedRegion(null)}
          onNavigate={(path) => { window.location.href = path; }}
        />
      )}
    </div>
  );
}
