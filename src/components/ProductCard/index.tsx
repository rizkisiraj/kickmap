'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import type { Product, Region } from '@/types';
import { RegionDot } from '@/components/RegionDot';
import { SaleBadge } from '@/components/SaleBadge';
import { LowStockIndicator } from '@/components/LowStockIndicator';

interface ProductCardProps {
  product: Product;
  priority?: boolean;
}

const REGIONS: Region[] = ['MY', 'ID', 'SG'];
const CURRENCY_PREFIX: Record<string, string> = {
  MYR: 'RM', IDR: 'Rp', SGD: 'S$', USD: 'US$',
};

function formatPrice(amount: number, currency: string): string {
  const prefix = CURRENCY_PREFIX[currency] ?? currency;
  return `${prefix}${new Intl.NumberFormat('en', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount)}`;
}

export function ProductCard({ product, priority = false }: ProductCardProps) {
  const [hovered, setHovered] = useState(false);

  const regionStockMap = new Map(product.stock.map((s) => [s.region, s]));
  const inStockRegions = product.stock.filter((s) => s.inStock);
  const onSaleAnywhere = product.stock.some((s) => s.isOnSale);
  const totalStock = product.stock.filter((s) => s.inStock).reduce((sum, s) => sum + s.totalStock, 0);

  const sgdStock = inStockRegions.find((s) => s.region === 'SG');
  const lowestStock = sgdStock ?? inStockRegions[0];
  const lowestDiscountPct = product.stock.reduce((max, s) => {
    if (!s.isOnSale || s.originalPrice === null || s.originalPrice === 0) return max;
    const pct = Math.round(((s.originalPrice - s.price) / s.originalPrice) * 100);
    return pct > max ? pct : max;
  }, 0);

  return (
    <Link href={`/product/${product.productCode}`} style={{ textDecoration: 'none', display: 'block' }}>
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          background: hovered ? 'var(--surface2)' : 'var(--surface)',
          border: `1px solid ${hovered ? 'var(--border2)' : 'var(--border)'}`,
          borderRadius: '8px',
          overflow: 'hidden',
          transform: hovered ? 'translateY(-2px)' : 'translateY(0)',
          transition: 'background 0.15s, border-color 0.15s, transform 0.15s',
          cursor: 'pointer',
        }}
      >
        {/* Image */}
        <div style={{ position: 'relative', aspectRatio: '1/1', background: '#111' }}>
          <Image
            src={product.imageUrl}
            alt={product.title}
            fill
            sizes="(max-width: 768px) 50vw, 200px"
            style={{ objectFit: 'cover' }}
            priority={priority}
          />
          <div style={{ position: 'absolute', top: '8px', left: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {onSaleAnywhere && (
              <SaleBadge {...(lowestDiscountPct > 0 ? { pct: lowestDiscountPct } : {})} size="sm" />
            )}
            {totalStock > 0 && totalStock <= 10 && (
              <span style={{ display: 'inline-flex', alignItems: 'center', background: 'rgba(239,68,68,0.85)', color: '#fff', border: '1px solid rgba(239,68,68,0.9)', borderRadius: '99px', padding: '2px 7px', fontSize: '10px', fontWeight: 700, letterSpacing: '0.06em' }}>
                LOW STOCK
              </span>
            )}
          </div>
        </div>

        {/* Info */}
        <div style={{ padding: '10px 12px 12px' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text2)', marginBottom: '3px' }}>
            {product.vendor}
          </div>
          <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)', lineHeight: 1.3, marginBottom: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {product.title}
          </div>
          {product.colorway !== undefined && (
            <div style={{ fontSize: '11px', color: 'var(--text3)', marginBottom: '8px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {product.colorway}
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              {REGIONS.map((region) => (
                <RegionDot key={region} region={region} active={regionStockMap.get(region)?.inStock === true} />
              ))}
            </div>
            <span style={{ fontSize: '10px', color: 'var(--text3)', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'capitalize' }}>
              {product.gender}
            </span>
          </div>

          {totalStock > 0 && totalStock <= 10 && (
            <div style={{ marginBottom: '8px' }}>
              <LowStockIndicator stock={totalStock} />
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: '10px', color: 'var(--text3)', marginBottom: '2px', letterSpacing: '0.04em' }}>FROM</div>
              {lowestStock !== undefined ? (
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '16px', fontWeight: 700, color: lowestStock.isOnSale ? 'var(--accent)' : 'var(--text)' }}>
                  {formatPrice(lowestStock.price, lowestStock.currency)}
                </div>
              ) : (
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--text3)' }}>OUT OF STOCK</div>
              )}
            </div>
            <span style={{ fontSize: '10px', color: 'var(--accent)', fontWeight: 600, letterSpacing: '0.04em' }}>VIEW →</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
