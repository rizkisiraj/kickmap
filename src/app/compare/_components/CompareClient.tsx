'use client';
import React, { useState, useMemo, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import useSWR from 'swr';
import type { Product, Currency, Region, ExchangeRates } from '@/types';
import { SaleBadge } from '@/components/SaleBadge';
import { CurrencyToggle } from '@/components/CurrencyToggle';
import { SortControl } from '@/components/SortControl';

const REGIONS: Region[] = ['MY', 'ID', 'SG'];
const REGION_FLAGS: Record<Region, string> = { MY: '🇲🇾', ID: '🇮🇩', SG: '🇸🇬' };
const REGION_CURRENCY: Record<Region, Currency> = { MY: 'MYR', ID: 'IDR', SG: 'SGD' };
const REGION_COLORS: Record<Region, string> = { MY: '#3b82f6', ID: '#ef4444', SG: '#f59e0b' };

const CURRENCY_SYMBOL: Record<Currency, string> = {
  MYR: 'RM', IDR: 'Rp', SGD: 'S$', USD: 'US$',
};

// Fallback rates (1 SGD = X currency) used until live rates load
const FALLBACK_RATES: Record<Currency, number> = { SGD: 1, MYR: 3.3, IDR: 11000, USD: 0.75 };

const fetcher = (url: string) => fetch(url).then((r) => r.json()) as Promise<ExchangeRates>;

// rates are "1 SGD = X currency", so: price_in_currency / rates[currency] = price_in_SGD
function toSGD(amount: number, currency: Currency, rates: Record<Currency, number>): number {
  return amount / (rates[currency] ?? 1);
}

function formatPrice(amount: number, currency: Currency): string {
  return `${CURRENCY_SYMBOL[currency]}${new Intl.NumberFormat('en', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount)}`;
}

interface CompareClientProps {
  products: Product[];
  total: number;
  initialQuery?: string;
}

export function CompareClient({ products, total, initialQuery = '' }: CompareClientProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [inputValue, setInputValue] = useState(initialQuery);
  const [visibleCount, setVisibleCount] = useState(30);

  useEffect(() => {
    setInputValue(initialQuery);
  }, [initialQuery]);

  const { data: exchangeData } = useSWR<ExchangeRates>('/api/exchange', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 3600_000,
  });
  const rates = exchangeData?.rates ?? FALLBACK_RATES;

  const currency = (searchParams.get('currency') as Currency) ?? 'SGD';
  const sort = searchParams.get('sort') ?? 'NAME';

  const filtered = useMemo(() => {
    if (!inputValue.trim() || inputValue.trim().length < 2) return products;
    const q = inputValue.trim().toLowerCase();
    return products.filter((p) =>
      p.title.toLowerCase().includes(q) ||
      p.vendor.toLowerCase().includes(q) ||
      (p.colorway?.toLowerCase().includes(q) ?? false)
    );
  }, [products, inputValue]);

  const sorted = useMemo(() => {
    let list = [...filtered];
    if (sort === 'PRICE') {
      list.sort((a, b) => {
        const aMin = Math.min(...a.stock.filter((s) => s.inStock).map((s) => toSGD(s.price, s.currency, rates)));
        const bMin = Math.min(...b.stock.filter((s) => s.inStock).map((s) => toSGD(s.price, s.currency, rates)));
        return aMin - bMin;
      });
    } else if (sort === 'DEAL') {
      list.sort((a, b) => {
        const aDisc = Math.max(0, ...a.stock.map((s) => {
          if (!s.isOnSale || s.originalPrice === null || s.originalPrice === 0) return 0;
          return Math.round(((s.originalPrice - s.price) / s.originalPrice) * 100);
        }));
        const bDisc = Math.max(0, ...b.stock.map((s) => {
          if (!s.isOnSale || s.originalPrice === null || s.originalPrice === 0) return 0;
          return Math.round(((s.originalPrice - s.price) / s.originalPrice) * 100);
        }));
        return bDisc - aDisc;
      });
    } else {
      list.sort((a, b) => a.title.localeCompare(b.title));
    }
    return list;
  }, [filtered, sort]);

  useEffect(() => { setVisibleCount(30); }, [sort, currency]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams(searchParams.toString());
    if (inputValue.trim()) {
      params.set('q', inputValue.trim());
    } else {
      params.delete('q');
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const visibleRows = sorted.slice(0, visibleCount);

  const onSaleAnywhere = (p: Product) => p.stock.some((s) => s.isOnSale);

  return (
    <div>
      {/* Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <CurrencyToggle />
        <SortControl />
        <form onSubmit={handleSubmit} style={{ flex: 1, minWidth: '160px', display: 'flex', gap: '8px' }}>
          <input
            type="text"
            placeholder="⌕ Search by name or brand..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            style={{ flex: 1, padding: '7px 12px', fontSize: '12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text)', outline: 'none' }}
          />
          <button
            type="submit"
            style={{ padding: '7px 16px', fontSize: '12px', fontWeight: 600, background: 'var(--accent)', color: '#000', border: 'none', borderRadius: '6px', cursor: 'pointer', whiteSpace: 'nowrap' }}
          >
            Search
          </button>
        </form>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: '8px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '600px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              <th style={{ position: 'sticky', left: 0, background: 'var(--bg)', padding: '10px 14px', textAlign: 'left', fontSize: '10px', fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text3)', textTransform: 'uppercase', minWidth: '220px' }}>
                PRODUCT
              </th>
              {REGIONS.map((r) => (
                <th key={r} style={{ padding: '10px 14px', textAlign: 'center', fontSize: '10px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: REGION_COLORS[r], minWidth: '110px' }}>
                  {REGION_FLAGS[r]} {r}
                  <span style={{ color: 'var(--text3)', fontWeight: 400 }}> ({REGION_CURRENCY[r]})</span>
                </th>
              ))}
              <th style={{ padding: '10px 14px', textAlign: 'center', fontSize: '10px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--accent)', minWidth: '100px' }}>
                BEST ({currency})
              </th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((product, idx) => {
              const prices = REGIONS.map((r) => {
                const s = product.stock.find((st) => st.region === r);
                return s?.inStock ? s : null;
              });

              const stockPrices = prices
                .map((s) => s ? toSGD(s.price, s.currency, rates) : null)
                .filter((v): v is number => v !== null);
              const minSGD = stockPrices.length > 0 ? Math.min(...stockPrices) : null;

              const rowBg = idx % 2 === 1 ? 'rgba(255,255,255,0.01)' : 'transparent';

              return (
                <tr key={product.productCode} style={{ background: rowBg, borderBottom: '1px solid var(--border)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = rowBg)}
                >
                  {/* Product cell */}
                  <td style={{ position: 'sticky', left: 0, background: 'var(--bg)', boxShadow: '1px 0 0 var(--border)', padding: '10px 14px' }}>
                    <Link href={`/product/${product.productCode}`} style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
                      <div style={{ width: '36px', height: '36px', flexShrink: 0, position: 'relative', background: '#111', borderRadius: '4px', overflow: 'hidden' }}>
                        <Image src={product.imageUrl} alt={product.title} fill sizes="36px" style={{ objectFit: 'cover' }} />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: '2px' }}>{product.vendor}</div>
                        <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '160px' }}>{product.title}</div>
                        {onSaleAnywhere(product) && <SaleBadge size="sm" />}
                      </div>
                    </Link>
                  </td>

                  {/* Region price cells */}
                  {REGIONS.map((r, ri) => {
                    const s = prices[ri] ?? null;
                    if (s === null) {
                      return (
                        <td key={r} style={{ padding: '10px 14px', textAlign: 'center' }}>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--text3)' }}>—</span>
                        </td>
                      );
                    }
                    const thisSGD = toSGD(s.price, s.currency, rates);
                    const isCheapest = minSGD !== null && Math.abs(thisSGD - minSGD) < 0.01;
                    return (
                      <td key={r} style={{
                        padding: '10px 14px',
                        textAlign: 'center',
                        background: isCheapest ? 'rgba(0,255,135,0.05)' : undefined,
                        borderLeft: isCheapest ? '1px solid rgba(0,255,135,0.2)' : undefined,
                        borderRight: isCheapest ? '1px solid rgba(0,255,135,0.2)' : undefined,
                      }}>
                        {s.originalPrice !== null && s.isOnSale && (
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text3)', textDecoration: 'line-through' }}>
                            {formatPrice(s.originalPrice, s.currency)}
                          </div>
                        )}
                        {s.isOnSale && <span style={{ fontSize: '10px', color: 'var(--accent)' }}>↓ </span>}
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: 600, color: s.isOnSale ? 'var(--accent)' : 'var(--text)' }}>
                          {formatPrice(s.price, s.currency)}
                        </span>
                        {isCheapest && (
                          <div style={{ fontSize: '9px', fontWeight: 700, color: 'var(--accent)', letterSpacing: '0.06em', marginTop: '2px' }}>BEST</div>
                        )}
                      </td>
                    );
                  })}

                  {/* Best column */}
                  <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                    {minSGD !== null ? (
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 700, color: 'var(--accent)' }}>
                        {formatPrice(minSGD * (rates[currency] ?? 1), currency)}
                      </span>
                    ) : (
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--text3)' }}>—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {sorted.length === 0 && (
          <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text3)', fontSize: '13px' }}>
            No products match your search
          </div>
        )}
      </div>

      {visibleCount < sorted.length && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '20px 0' }}>
          <button
            onClick={() => setVisibleCount((v) => v + 30)}
            style={{ padding: '10px 24px', fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', background: 'var(--surface)', color: 'var(--text2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', cursor: 'pointer' }}
          >
            LOAD MORE  (showing {Math.min(visibleCount, sorted.length)} of {sorted.length})
          </button>
        </div>
      )}
    </div>
  );
}
