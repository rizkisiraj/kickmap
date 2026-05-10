'use client';
import React, { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import type { Product, Region } from '@/types';
import { RegionBadge } from '@/components/RegionBadge';
import { getColorForStockLevel } from './useRegionColor';

interface SlidePanelProps {
  region: { id: Region; label: string };
  products: Product[];
  loading?: boolean;
  hasMore?: boolean;
  loadingMore?: boolean;
  total?: number;
  onLoadMore?: () => void;
  onClose: () => void;
  onNavigate: (path: string) => void;
}

const REGION_FLAGS: Record<Region, string> = { MY: '🇲🇾', ID: '🇮🇩', SG: '🇸🇬', TH: '🇹🇭' };
const REGION_NAMES: Record<Region, string> = { MY: 'Malaysia', ID: 'Indonesia', SG: 'Singapore', TH: 'Thailand' };
const CURRENCY_PREFIX: Record<string, string> = { MYR: 'RM', IDR: 'Rp', SGD: 'S$', THB: '฿', USD: 'US$' };

function formatPrice(amount: number, currency: string): string {
  const prefix = CURRENCY_PREFIX[currency] ?? currency;
  return `${prefix}${new Intl.NumberFormat('en', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount)}`;
}

export function SlidePanel({ region, products, loading = false, hasMore = false, loadingMore = false, total, onLoadMore, onClose, onNavigate }: SlidePanelProps) {
  const [visible, setVisible] = useState(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
    return () => { if (closeTimerRef.current) clearTimeout(closeTimerRef.current); };
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting && hasMore && !loadingMore) onLoadMore?.();
    }, { threshold: 0.1 });
    if (sentinelRef.current) observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, onLoadMore]);

  const handleClose = () => {
    setVisible(false);
    closeTimerRef.current = setTimeout(onClose, 280);
  };

  const regionStocks = products.flatMap((p) => p.stock.filter((s) => s.region === region.id));
  const inStockCount = regionStocks.filter((s) => s.inStock).length;
  const onSaleCount = regionStocks.filter((s) => s.isOnSale).length;

  const vendorCounts = new Map<string, number>();
  products.forEach((p) => {
    const stock = p.stock.find((s) => s.region === region.id && s.inStock);
    if (stock !== undefined) vendorCounts.set(p.vendor, (vendorCounts.get(p.vendor) ?? 0) + 1);
  });
  const topBrand = [...vendorCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—';

  const stockLevel =
    inStockCount > 200 ? ('high' as const) :
    inStockCount > 60  ? ('medium' as const) :
    inStockCount > 0   ? ('low' as const) :
    ('none' as const);
  const glowColor = getColorForStockLevel(stockLevel);

  const statCards = [
    { label: 'IN STOCK', value: String(inStockCount) },
    { label: 'ON SALE', value: String(onSaleCount) },
    { label: 'TOP BRAND', value: topBrand },
  ] as const;

  return (
    <>
      <div onClick={handleClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 300, opacity: visible ? 1 : 0, transition: 'opacity 0.28s' }} />

      <div className="slide-panel-inner" style={{ position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 400, background: 'var(--surface)', borderLeft: '1px solid var(--border)', transform: visible ? 'translateX(0)' : 'translateX(100%)', transition: 'transform 0.28s cubic-bezier(0.32,0,0.16,1)', boxShadow: '-24px 0 60px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ fontSize: '18px', fontWeight: 800 }}>{REGION_FLAGS[region.id]} {REGION_NAMES[region.id]}</span>
            <button onClick={handleClose} style={{ fontSize: '18px', color: 'var(--text2)', padding: '4px 8px', borderRadius: '4px' }} aria-label="Close panel">✕</button>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text2)' }}>
            <span style={{ fontFamily: 'var(--font-mono)', color: glowColor, fontWeight: 700 }}>{loading ? '…' : (total ?? products.length)}</span>{' '}sneakers matched · JD Sports
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginTop: '12px' }}>
            {statCards.map(({ label, value }) => (
              <div key={label} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '6px', padding: '8px 10px', textAlign: 'center' }}>
                <div style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text3)', textTransform: 'uppercase', marginBottom: '4px' }}>{label}</div>
                <div style={{ fontSize: '14px', fontWeight: 800, color: glowColor }}>{value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Product list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 24px', gap: '8px' }}>
              <span style={{ fontSize: '13px', color: 'var(--text2)', fontWeight: 600 }}>Loading…</span>
            </div>
          ) : products.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 24px', gap: '8px' }}>
              <span style={{ fontSize: '28px', opacity: 0.4, color: 'var(--text2)' }}>◎</span>
              <span style={{ fontSize: '13px', color: 'var(--text2)', fontWeight: 600 }}>No matches in {REGION_NAMES[region.id]}</span>
              <span style={{ fontSize: '11px', color: 'var(--text3)' }}>Try adjusting your filters</span>
            </div>
          ) : (
            <>
              {products.map((product) => {
                const regionStock = product.stock.find((s) => s.region === region.id);
                return (
                  <button
                    key={product.productCode}
                    onClick={() => { setVisible(false); setTimeout(() => onNavigate(`/product/${product.productCode}`), 300); }}
                    style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%', padding: '10px 20px', textAlign: 'left', transition: 'opacity 0.15s', borderBottom: '1px solid var(--border)' }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.7'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = '1'; }}
                  >
                    <div style={{ width: '62px', height: '62px', flexShrink: 0, position: 'relative', background: '#111', borderRadius: '6px', overflow: 'hidden' }}>
                      <Image src={product.imageUrl} alt={product.title} fill sizes="62px" style={{ objectFit: 'cover' }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: '2px' }}>{product.vendor}</div>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: '4px' }}>{product.title}</div>
                      {regionStock !== undefined && (
                        <div style={{ fontSize: '11px', color: regionStock.isOnSale ? 'var(--accent)' : 'var(--text2)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                          {formatPrice(regionStock.price, regionStock.currency)}
                          {regionStock.sizesAvailable.length > 0 && (
                            <span style={{ color: 'var(--text3)', fontWeight: 400, marginLeft: '6px' }}>· {regionStock.sizesAvailable.length} sizes</span>
                          )}
                        </div>
                      )}
                    </div>
                    <RegionBadge region={region.id} size="sm" />
                  </button>
                );
              })}

              {hasMore && (
                <div
                  ref={sentinelRef}
                  style={{ height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  {loadingMore
                    ? <span style={{ fontSize: '11px', color: 'var(--text3)' }}>Loading…</span>
                    : <span style={{ fontSize: '11px', color: 'var(--text3)' }}>Scroll for more</span>
                  }
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
          <Link href="/compare" onClick={handleClose} style={{ display: 'block', width: '100%', padding: '10px', textAlign: 'center', fontSize: '12px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', background: 'var(--accent-dim)', color: 'var(--accent)', border: '1px solid rgba(0,255,135,0.25)', borderRadius: '6px', textDecoration: 'none', transition: 'all 0.15s' }}>
            COMPARE ALL REGIONS →
          </Link>
        </div>
      </div>
    </>
  );
}
