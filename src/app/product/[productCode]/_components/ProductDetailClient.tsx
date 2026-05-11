'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import type { Product, Region, Currency } from '@/types';
import { RegionBadge } from '@/components/RegionBadge';
import { SaleBadge } from '@/components/SaleBadge';
import { PriceDisplay } from '@/components/PriceDisplay';
import { LowStockIndicator } from '@/components/LowStockIndicator';
import { formatDate } from '@/lib/format';
import { getColorForStockLevel } from '@/components/RegionMap/useRegionColor';

const REGION_FLAGS: Record<Region, string> = { MY: '🇲🇾', ID: '🇮🇩', SG: '🇸🇬', TH: '🇹🇭' };
const REGION_NAMES: Record<Region, string> = { MY: 'Malaysia', ID: 'Indonesia', SG: 'Singapore', TH: 'Thailand' };
const REGION_COLORS: Record<Region, string> = { MY: '#3b82f6', ID: '#ef4444', SG: '#f59e0b', TH: '#8b5cf6' };

interface ProductDetailClientProps {
  product: Product;
  regions: Region[];
  cheapestRegion: Region | null;
  savings: number;
  latestScrapedAt: string | null;
}

export function ProductDetailClient({ product, regions, cheapestRegion, savings, latestScrapedAt }: ProductDetailClientProps) {
  const firstInStock = regions.find((r) => product.stock.some((s) => s.region === r && s.inStock));
  const [selectedRegion, setSelectedRegion] = useState<Region>(firstInStock ?? regions[0] ?? 'SG');

  const isOnSaleAnywhere = product.stock.some((s) => s.isOnSale);
  const selectedStock = product.stock.find((s) => s.region === selectedRegion);

  return (
    <div>
      {/* Breadcrumb row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px', flexWrap: 'wrap' }}>
        <Link href={`/brand/${encodeURIComponent(product.vendor)}`} style={{ textDecoration: 'none' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text2)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '99px', padding: '3px 10px', cursor: 'pointer' }}>
            {product.vendor}
          </span>
        </Link>
        <span style={{ fontSize: '11px', color: 'var(--text3)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '99px', padding: '3px 10px', textTransform: 'capitalize' }}>
          {product.gender}
        </span>
        {isOnSaleAnywhere && <SaleBadge />}
      </div>

      {/* Title */}
      <h1 style={{ fontSize: '28px', fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--text)', margin: '0 0 6px', lineHeight: 1.15 }}>
        {product.title}
      </h1>
      {product.colorway !== undefined && (
        <p style={{ fontSize: '13px', color: 'var(--text2)', margin: '0 0 20px' }}>{product.colorway}</p>
      )}

      {/* BEST DEAL callout */}
      {cheapestRegion !== null && savings > 1 && (
        <div style={{ background: 'var(--accent-dim)', border: '1px solid rgba(0,255,135,0.25)', borderRadius: '8px', padding: '12px 16px', marginBottom: '20px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--accent)', marginBottom: '4px' }}>BEST DEAL</div>
          <div style={{ fontSize: '13px', color: 'var(--text2)' }}>
            Cheapest in <span style={{ color: REGION_COLORS[cheapestRegion], fontWeight: 700 }}>{REGION_NAMES[cheapestRegion]}</span>
            {' '}— save <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent)', fontWeight: 700 }}>S${Math.round(savings)}</span> vs other regions
          </div>
        </div>
      )}

      {/* Availability by region */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: '10px' }}>
          AVAILABILITY BY REGION
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
          {regions.map((region) => {
            const s = product.stock.find((st) => st.region === region);
            const isAvailable = s?.inStock === true;
            const isCheapest = region === cheapestRegion;
            const isSelected = region === selectedRegion;

            return (
              <button
                key={region}
                onClick={() => { if (isAvailable) setSelectedRegion(region); }}
                style={{
                  padding: '14px',
                  borderRadius: '8px',
                  textAlign: 'left',
                  cursor: isAvailable ? 'pointer' : 'default',
                  opacity: isAvailable ? 1 : 0.5,
                  background: isSelected ? 'var(--surface2)' : 'var(--surface)',
                  border: isCheapest
                    ? '1px solid rgba(0,255,135,0.3)'
                    : isSelected
                      ? '1px solid var(--border2)'
                      : '1px solid var(--border)',
                  transition: 'all 0.15s',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: REGION_COLORS[region] }}>
                    {REGION_FLAGS[region]} {region}
                  </span>
                  {isCheapest && (
                    <span style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.06em', color: 'var(--accent)' }}>CHEAPEST</span>
                  )}
                </div>
                {isAvailable && s !== undefined ? (
                  <>
                    <PriceDisplay original={s.originalPrice ?? s.price} current={s.price} currency={s.currency} />
                    <LowStockIndicator stock={s.totalStock} />
                  </>
                ) : (
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text3)' }}>OUT OF STOCK</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Sizes for selected region */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span>SIZES —</span>
          <span>{REGION_FLAGS[selectedRegion]} {selectedRegion}</span>
          {selectedStock?.inStock !== true && (
            <span style={{ fontWeight: 400, color: 'var(--text3)', textTransform: 'none', fontSize: '10px' }}>(not available)</span>
          )}
        </div>
        {selectedStock?.inStock === true && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {selectedStock.sizesTotal.map((size) => {
              const available = selectedStock.sizesAvailable.includes(size);
              return (
                <div
                  key={size}
                  style={{
                    width: '38px',
                    height: '28px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '11px',
                    fontWeight: 600,
                    fontFamily: 'var(--font-mono)',
                    borderRadius: '5px',
                    background: available ? 'var(--surface2)' : 'transparent',
                    border: `1px solid ${available ? 'var(--border2)' : 'var(--border)'}`,
                    color: available ? 'var(--text)' : 'var(--text3)',
                    opacity: available ? 1 : 0.4,
                  }}
                >
                  {size}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ paddingTop: '16px', borderTop: '1px solid var(--border)', fontSize: '11px', color: 'var(--text3)', fontFamily: 'var(--font-mono)' }}>
        Last scraped · {latestScrapedAt !== null ? formatDate(latestScrapedAt) : '—'} · JD Sports MY, ID, SG, TH
      </div>
    </div>
  );
}
