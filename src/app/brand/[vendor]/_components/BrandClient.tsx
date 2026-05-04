'use client';
import React, { useState, useEffect, useRef } from 'react';
import type { Product } from '@/types';
import { ProductCard } from '@/components/ProductCard';

interface BrandClientProps {
  initialProducts: Product[];
  nextCursor: string | null;
  total: number;
  vendor: string;
}

export function BrandClient({ initialProducts, nextCursor, total, vendor }: BrandClientProps) {
  const [items, setItems] = useState<Product[]>(initialProducts);
  const [loading, setLoading] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<string | null>(nextCursor);
  const loadingRef = useRef(false);

  useEffect(() => {
    const navType = (performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined)?.type;
    if (navType === 'back_forward') {
      const raw = sessionStorage.getItem(`kicks:brand:${vendor}`);
      if (raw) {
        const { items: saved, cursor: savedCursor } = JSON.parse(raw) as { items: Product[]; cursor: string | null };
        setItems(saved);
        cursorRef.current = savedCursor;
      }
    } else {
      sessionStorage.removeItem(`kicks:brand:${vendor}`);
    }
  }, [vendor]);

  useEffect(() => {
    sessionStorage.setItem(`kicks:brand:${vendor}`, JSON.stringify({ items, cursor: cursorRef.current }));
  }, [items, vendor]);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting && cursorRef.current !== null && !loadingRef.current) {
        loadingRef.current = true;
        setLoading(true);
        fetch(`/api/products?vendor=${encodeURIComponent(vendor)}&cursor=${encodeURIComponent(cursorRef.current)}&limit=24`)
          .then((r) => r.json())
          .then((json: { data: Product[]; meta: { nextCursor: string | null } }) => {
            setItems((prev) => [...prev, ...json.data]);
            cursorRef.current = json.meta.nextCursor;
          })
          .finally(() => {
            loadingRef.current = false;
            setLoading(false);
          });
      }
    }, { rootMargin: '200px' });

    if (sentinelRef.current) observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  });

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' }}>
        {items.map((product) => (
          <ProductCard key={product.productCode} product={product} />
        ))}
      </div>

      <div ref={sentinelRef} style={{ height: '1px' }} />

      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '24px', color: 'var(--text3)', fontSize: '12px' }}>
          Loading…
        </div>
      )}

      {!loading && items.length < total && cursorRef.current === null && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '24px', color: 'var(--text3)', fontSize: '12px' }}>
          Showing {items.length} of {total}
        </div>
      )}
    </>
  );
}
