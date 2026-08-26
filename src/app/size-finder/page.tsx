'use client';
import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import { SizeGrid } from '@/components/SizeGrid';
import { RegionBadge } from '@/components/RegionBadge';
import type { Region, Currency, Product } from '@/types';

const CURRENCY_SYMBOL: Record<Currency, string> = {
  MYR: 'RM', IDR: 'Rp', SGD: 'S$', THB: '฿', USD: 'US$',
};

function formatPrice(amount: number, currency: Currency): string {
  return `${CURRENCY_SYMBOL[currency]}${new Intl.NumberFormat('en', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount)}`;
}

export default function SizeFinderPage() {
  const searchParams = useSearchParams();
  const selectedSize = searchParams.get('size') ?? undefined;

  const { data: availableSizes } = useSWR<string[]>('/api/sizes', (url: string) => fetch(url).then((r) => r.json()));

  const [items, setItems] = useState<Product[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const loadingRef = useRef(false);
  const sentinelRef = useRef<HTMLDivElement>(null);


  useEffect(() => {
    if (!selectedSize) {
      setItems([]);
      setCursor(null);
      setHasMore(false);
      setTotalCount(0);
      return;
    }
    const navType = (performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined)?.type;
    if (navType === 'back_forward') {
      const raw = sessionStorage.getItem(`kicks:size-finder:${selectedSize}`);
      if (raw) {
        const { items: saved, cursor: savedCursor, hasMore: savedHasMore, total: savedTotal } = JSON.parse(raw) as { items: Product[]; cursor: string | null; hasMore: boolean; total: number };
        setItems(saved);
        setCursor(savedCursor);
        setHasMore(savedHasMore);
        setTotalCount(savedTotal);
        return;
      }
    } else {
      sessionStorage.removeItem(`kicks:size-finder:${selectedSize}`);
    }
    setItems([]);
    setCursor(null);
    setLoadingProducts(true);
    fetch(`/api/products?size=${encodeURIComponent(selectedSize)}&inStock=true&limit=24`)
      .then((r) => r.json())
      .then((json: { data: Product[]; meta: { nextCursor: string | null; hasMore: boolean; total: number } }) => {
        setItems(json.data);
        setCursor(json.meta.nextCursor);
        setHasMore(json.meta.hasMore);
        setTotalCount(json.meta.total);
      })
      .finally(() => setLoadingProducts(false));
  }, [selectedSize]);

  useEffect(() => {
    if (!selectedSize || items.length === 0) return;
    sessionStorage.setItem(`kicks:size-finder:${selectedSize}`, JSON.stringify({ items, cursor, hasMore, total: totalCount }));
  }, [items, cursor, hasMore, totalCount, selectedSize]);

  useEffect(() => {
    if (!selectedSize) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting && cursor !== null && !loadingRef.current) {
        loadingRef.current = true;
        setLoadingProducts(true);
        fetch(`/api/products?size=${encodeURIComponent(selectedSize)}&inStock=true&cursor=${encodeURIComponent(cursor)}&limit=24`)
          .then((r) => r.json())
          .then((json: { data: Product[]; meta: { nextCursor: string | null; hasMore: boolean; total: number } }) => {
            setItems((prev) => [...prev, ...json.data]);
            setCursor(json.meta.nextCursor);
            setHasMore(json.meta.hasMore);
          })
          .finally(() => {
            loadingRef.current = false;
            setLoadingProducts(false);
          });
      }
    }, { rootMargin: '200px' });

    if (sentinelRef.current) observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [selectedSize, cursor]);

  return (
    <div className="page-wrap">
      <div style={{ padding: '24px 0 20px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text)', margin: '0 0 6px' }}>Size Finder</h1>
        <p style={{ fontSize: '13px', color: 'var(--text2)', margin: 0 }}>
          Pick your UK size — see what&apos;s available across MY · ID · SG
        </p>
      </div>

      {/* Size selector panel */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '16px', marginBottom: '24px' }}>
        <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text2)', marginBottom: '10px' }}>
          UK SIZE
        </div>
        <SizeGrid availableSizes={availableSizes} />
      </div>

      {/* Results */}
      {selectedSize === undefined ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 24px', gap: '10px' }}>
          <span style={{ fontSize: '32px', opacity: 0.4, color: 'var(--text2)' }}>↑</span>
          <span style={{ fontSize: '14px', color: 'var(--text2)', fontWeight: 500 }}>Select a size above to see available shoes</span>
        </div>
      ) : loadingProducts && items.length === 0 ? (
        <div className="size-finder-grid">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} style={{ height: '120px', background: 'var(--surface)', borderRadius: '8px', animation: 'pulse 2s infinite' }} />
          ))}
        </div>
      ) : !loadingProducts && items.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 24px', gap: '10px' }}>
          <span style={{ fontSize: '32px', opacity: 0.4, color: 'var(--text2)' }}>◎</span>
          <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text2)' }}>No shoes found in UK {selectedSize} across MY, ID, SG</span>
          <span style={{ fontSize: '12px', color: 'var(--text3)' }}>Try an adjacent size</span>
        </div>
      ) : (
        <>
          <div style={{ fontSize: '13px', color: 'var(--text2)', marginBottom: '12px' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '16px', fontWeight: 800, color: 'var(--accent)' }}>{totalCount}</span>
            {' '}shoes available in UK <strong>{selectedSize}</strong>
          </div>
          <div className="size-finder-grid">
            {items.map((product) => {
              const stockByRegion = (['MY', 'ID', 'SG', 'TH'] as Region[]).flatMap((r) => {
                const s = product.stock.find((st) => st.region === r && st.sizesAvailable.includes(selectedSize));
                return s ? [{ region: r, stock: s }] : [];
              });

              return (
                <Link
                  key={product.productCode}
                  href={`/product/${product.productCode}`}
                  style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '12px', textDecoration: 'none', transition: 'border-color 0.15s' }}
                >
                  <div style={{ width: '96px', height: '96px', flexShrink: 0, position: 'relative', background: '#111', borderRadius: '6px', overflow: 'hidden' }}>
                    <Image src={product.imageUrl} alt={product.title} fill sizes="96px" style={{ objectFit: 'cover' }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: '3px' }}>{product.vendor}</div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: '8px' }}>{product.title}</div>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {stockByRegion.map(({ region, stock: s }) => (
                        <div key={region} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <RegionBadge region={region} size="sm" />
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 600, color: s.isOnSale ? 'var(--accent)' : 'var(--text2)' }}>
                            {formatPrice(s.price, s.currency)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>

          {hasMore && <div ref={sentinelRef} style={{ height: '1px' }} />}

          {loadingProducts && items.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '24px', color: 'var(--text3)', fontSize: '12px' }}>
              Loading…
            </div>
          )}
        </>
      )}
    </div>
  );
}
