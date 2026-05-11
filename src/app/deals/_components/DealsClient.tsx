'use client';
import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import type { Deal, Currency } from '@/types';
import { RegionBadge } from '@/components/RegionBadge';
import { SaleBadge } from '@/components/SaleBadge';
import { LowStockIndicator } from '@/components/LowStockIndicator';

const CURRENCY_SYMBOL: Record<Currency, string> = {
  MYR: 'RM', IDR: 'Rp', SGD: 'S$', THB: '฿', USD: 'US$',
};

function formatPrice(amount: number, currency: Currency): string {
  const symbol = CURRENCY_SYMBOL[currency];
  return `${symbol}${new Intl.NumberFormat('en', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount)}`;
}

interface DealsClientProps {
  initialDeals: Deal[];
  nextCursor: string | null;
  total: number;
}

export function DealsClient({ initialDeals, nextCursor: initialCursor, total }: DealsClientProps) {
  const [items, setItems] = useState<Deal[]>(initialDeals);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const navType = (performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined)?.type;
    if (navType === 'back_forward') {
      const raw = sessionStorage.getItem('kicks:deals');
      if (raw) {
        const { items: saved, cursor: savedCursor } = JSON.parse(raw) as { items: Deal[]; cursor: string | null };
        setItems(saved);
        setCursor(savedCursor);
      }
    } else {
      sessionStorage.removeItem('kicks:deals');
    }
  }, []);

  useEffect(() => {
    sessionStorage.setItem('kicks:deals', JSON.stringify({ items, cursor }));
  }, [items, cursor]);

  const loadMore = async () => {
    if (cursor === null || loading) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/deals?cursor=${encodeURIComponent(cursor)}&limit=20&sort=discount_desc`);
      const json = await res.json() as { data: Deal[]; meta: { nextCursor: string | null; hasMore: boolean } };
      setItems((prev) => [...prev, ...json.data]);
      setCursor(json.meta.nextCursor);
    } finally {
      setLoading(false);
    }
  };

  if (items.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 24px', gap: '8px' }}>
        <span style={{ fontSize: '28px', opacity: 0.4, color: 'var(--text2)' }}>◎</span>
        <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text2)' }}>No deals right now</span>
        <span style={{ fontSize: '12px', color: 'var(--text3)' }}>Check back after the next scrape run</span>
      </div>
    );
  }

  return (
    <>
      {/* Deal list — single column on desktop, 2-column grid on mobile */}
      <div className="deals-grid">
        {items.map((deal, i) => {
          const rank = i + 1;
          const isFirst = rank === 1;
          const savings = deal.originalPrice - deal.price;

          return (
            <Link
              key={`${deal.productCode}-${deal.region}`}
              href={`/product/${deal.productCode}`}
              className="deal-card"
              style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden', transition: 'border-color 0.15s' }}
            >
              {/* Rank */}
              <div className="deal-rank" style={{ width: '44px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', alignSelf: 'stretch', background: isFirst ? 'var(--accent-dim)' : 'var(--surface2)', borderRight: '1px solid var(--border)' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: 800, color: isFirst ? 'var(--accent)' : 'var(--text3)' }}>
                  #{rank}
                </span>
              </div>

              {/* Image */}
              <div className="deal-img" style={{ width: '88px', height: '88px', flexShrink: 0, position: 'relative', background: '#111' }}>
                {/* Rank badge — shown only in grid (mobile) mode, overlaid on image */}
                <div className="deal-rank-badge" style={{ position: 'absolute', top: '6px', left: '6px', zIndex: 1, fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 800, background: isFirst ? 'var(--accent)' : 'rgba(0,0,0,0.7)', color: isFirst ? 'var(--bg)' : 'var(--text2)', borderRadius: '4px', padding: '2px 5px', lineHeight: 1 }}>
                  #{rank}
                </div>
                {deal.imageUrl ? <Image src={deal.imageUrl} alt={deal.title} fill sizes="(max-width: 640px) 50vw, 88px" style={{ objectFit: 'cover' }} /> : null}
              </div>

              {/* Content */}
              <div className="deal-content" style={{ flex: 1, minWidth: 0, padding: '10px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text2)' }}>{deal.vendor}</span>
                  <RegionBadge region={deal.region} size="sm" />
                </div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: '2px' }} className="deal-title">
                  {deal.title}
                </div>
                {deal.colorway !== undefined && (
                  <div style={{ fontSize: '11px', color: 'var(--text3)', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {deal.colorway}
                  </div>
                )}
                {/* Price — shown inline in grid mode */}
                <div className="deal-price-inline">
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text3)', textDecoration: 'line-through' }}>
                    {formatPrice(deal.originalPrice, deal.currency)}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', fontWeight: 800, color: 'var(--accent)' }}>
                      {formatPrice(deal.price, deal.currency)}
                    </span>
                    <SaleBadge pct={deal.discountPercent} size="sm" />
                  </div>
                </div>
                <LowStockIndicator stock={deal.totalStock} />
              </div>

              {/* Price column — shown only in list (desktop) mode */}
              <div className="deal-price-col" style={{ flexShrink: 0, padding: '10px 12px', textAlign: 'right' }}>
                <div className="deal-price-extras" style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text3)', textDecoration: 'line-through', marginBottom: '2px' }}>
                  {formatPrice(deal.originalPrice, deal.currency)}
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '16px', fontWeight: 800, color: 'var(--accent)', marginBottom: '4px' }}>
                  {formatPrice(deal.price, deal.currency)}
                </div>
                <SaleBadge pct={deal.discountPercent} size="sm" />
                <div className="deal-price-extras" style={{ fontSize: '10px', color: 'var(--text2)', fontFamily: 'var(--font-mono)', marginTop: '3px' }}>
                  SAVE {formatPrice(savings, deal.currency)}
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {cursor !== null && (
        <button
          onClick={() => { void loadMore(); }}
          disabled={loading}
          style={{ display: 'block', margin: '24px auto 0', padding: '10px 24px', fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', background: 'var(--surface)', color: 'var(--text2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.5 : 1 }}
        >
          {loading ? 'Loading…' : `LOAD MORE  (showing ${items.length} of ${total})`}
        </button>
      )}
    </>
  );
}
