'use client';
import React, { useState, useRef, useEffect } from 'react';
import type { Product, ProductFilters, PaginatedResponse } from '@/types';

interface HeatmapFilterBarProps {
  filters: ProductFilters;
  onFiltersChange: (filters: ProductFilters) => void;
  brands: string[];
  allProducts: Product[];
}

const UK_SIZES = [
  '3', '3.5', '4', '4.5', '5', '5.5', '6', '6.5',
  '7', '7.5', '8', '8.5', '9', '9.5', '10', '10.5',
  '11', '11.5', '12', '12.5', '13', '14', '15', '16',
];

const GENDERS = ['All', 'Men', 'Women', 'Unisex'] as const;

interface AutocompleteItem {
  productCode: string;
  vendor: string;
  title: string;
  colorway?: string;
}

function FilterChipInline({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '2px 8px 2px 10px', borderRadius: '99px', fontSize: '10px', fontWeight: 600, background: 'var(--accent-dim)', color: 'var(--accent)', border: '1px solid rgba(0,255,135,0.2)' }}>
      {label}
      <button onClick={onRemove} style={{ fontSize: '11px', opacity: 0.7, color: 'var(--accent)', lineHeight: 1 }}>✕</button>
    </span>
  );
}

export function HeatmapFilterBar({ filters, onFiltersChange, brands, allProducts }: HeatmapFilterBarProps) {
  const [modelQuery, setModelQuery] = useState(filters.model ?? '');
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [autocompleteItems, setAutocompleteItems] = useState<AutocompleteItem[]>([]);
  const [showBrand, setShowBrand] = useState(false);
  const [showSize, setShowSize] = useState(false);
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autocompleteDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hasFilters =
    filters.vendor !== undefined ||
    filters.size !== undefined ||
    filters.model !== undefined ||
    (filters.gender !== undefined && filters.gender !== 'All') ||
    filters.onSaleOnly === true;

  useEffect(() => {
    if (autocompleteDebounceRef.current) clearTimeout(autocompleteDebounceRef.current);

    if (modelQuery.length < 1) {
      setAutocompleteItems([]);
      return;
    }

    autocompleteDebounceRef.current = setTimeout(() => {
      const params = new URLSearchParams({ model: modelQuery, limit: '6' });
      fetch(`/api/products?${params.toString()}`)
        .then((res) => res.json() as Promise<PaginatedResponse<{ productCode: string; vendor: string; title: string; colorway?: string }>>)
        .then((json) => {
          setAutocompleteItems(
            json.data.map((p) => ({
              productCode: p.productCode,
              vendor: p.vendor,
              title: p.title,
              ...(p.colorway !== undefined ? { colorway: p.colorway } : {}),
            })),
          );
        })
        .catch(() => { setAutocompleteItems([]); });
    }, 300);

    return () => {
      if (autocompleteDebounceRef.current) clearTimeout(autocompleteDebounceRef.current);
    };
  }, [modelQuery]);

  const clearAll = () => { setModelQuery(''); onFiltersChange({}); };

  const removeFilter = (key: keyof ProductFilters) => {
    const next = { ...filters };
    delete next[key];
    onFiltersChange(next);
  };

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', overflow: 'visible', marginBottom: '16px' }}>
      {/* Always-visible row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', flexWrap: 'wrap' }}>

        {/* Search input */}
        <div style={{ position: 'relative', flex: '1 1 180px', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '6px', padding: '5px 10px' }}>
            <span style={{ color: 'var(--text3)', fontSize: '12px', flexShrink: 0 }}>⌕</span>
            <input
              type="text"
              placeholder="Search model…"
              value={modelQuery}
              onChange={(e) => { setModelQuery(e.target.value); setShowAutocomplete(true); }}
              onFocus={() => setShowAutocomplete(true)}
              onBlur={() => { blurTimerRef.current = setTimeout(() => setShowAutocomplete(false), 150); }}
              style={{ flex: 1, background: 'transparent', border: 'none', color: 'var(--text)', fontSize: '11px', fontFamily: 'var(--font-head)', minWidth: 0, outline: 'none' }}
            />
            {modelQuery.length > 0 && (
              <button onClick={() => { setModelQuery(''); removeFilter('model'); }} style={{ color: 'var(--text3)', fontSize: '11px', flexShrink: 0 }}>✕</button>
            )}
          </div>
          {showAutocomplete && autocompleteItems.length > 0 && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--surface2)', border: '1px solid var(--border2)', borderRadius: '6px', boxShadow: '0 8px 24px rgba(0,0,0,0.4)', zIndex: 500, marginTop: '2px' }}>
              {autocompleteItems.map((item) => (
                <button key={item.productCode}
                  onMouseDown={() => { if (blurTimerRef.current) clearTimeout(blurTimerRef.current); setModelQuery(item.title); setShowAutocomplete(false); onFiltersChange({ ...filters, model: item.title }); }}
                  style={{ display: 'block', width: '100%', textAlign: 'left', padding: '7px 10px', borderBottom: '1px solid var(--border)', fontSize: '11px', color: 'var(--text)' }}>
                  <span style={{ color: 'var(--text3)', marginRight: '6px', fontSize: '10px' }}>{item.vendor}</span>
                  {item.title}
                  {item.colorway !== undefined && <span style={{ color: 'var(--text3)', marginLeft: '6px' }}>· {item.colorway}</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="filter-divider" style={{ width: '1px', height: '20px', background: 'var(--border)', flexShrink: 0 }} />

        {/* Brand toggle */}
        <button
          onClick={() => setShowBrand((v) => !v)}
          style={{
            display: 'flex', alignItems: 'center', gap: '5px',
            padding: '5px 11px', borderRadius: '6px', fontSize: '11px', fontWeight: 600,
            background: showBrand || filters.vendor !== undefined ? 'var(--accent-dim)' : 'var(--surface2)',
            color: showBrand || filters.vendor !== undefined ? 'var(--accent)' : 'var(--text2)',
            border: showBrand || filters.vendor !== undefined ? '1px solid rgba(0,255,135,0.3)' : '1px solid var(--border)',
            transition: 'all 0.15s', flexShrink: 0,
          }}
        >
          BRAND
          {filters.vendor !== undefined && (
            <span style={{ fontSize: '9px', background: 'var(--accent)', color: 'var(--bg)', borderRadius: '99px', padding: '1px 5px', fontWeight: 700 }}>1</span>
          )}
          <span style={{ fontSize: '9px', opacity: 0.6 }}>{showBrand ? '▲' : '▼'}</span>
        </button>

        {/* Size toggle */}
        <button
          onClick={() => setShowSize((v) => !v)}
          style={{
            display: 'flex', alignItems: 'center', gap: '5px',
            padding: '5px 11px', borderRadius: '6px', fontSize: '11px', fontWeight: 600,
            background: showSize || filters.size !== undefined ? 'var(--accent-dim)' : 'var(--surface2)',
            color: showSize || filters.size !== undefined ? 'var(--accent)' : 'var(--text2)',
            border: showSize || filters.size !== undefined ? '1px solid rgba(0,255,135,0.3)' : '1px solid var(--border)',
            transition: 'all 0.15s', flexShrink: 0,
          }}
        >
          SIZE
          {filters.size !== undefined && (
            <span style={{ fontSize: '9px', background: 'var(--accent)', color: 'var(--bg)', borderRadius: '99px', padding: '1px 5px', fontWeight: 700 }}>UK {filters.size}</span>
          )}
          <span style={{ fontSize: '9px', opacity: 0.6 }}>{showSize ? '▲' : '▼'}</span>
        </button>

        {/* Divider */}
        <div className="filter-divider" style={{ width: '1px', height: '20px', background: 'var(--border)', flexShrink: 0 }} />

        {/* Gender pills */}
        <div style={{ display: 'flex', gap: '3px' }}>
          {GENDERS.map((g) => {
            const isActive = (filters.gender ?? 'All') === g;
            return (
              <button key={g} onClick={() => { const n = { ...filters }; if (g === 'All') { delete n.gender; } else { n.gender = g; } onFiltersChange(n); }}
                style={{ padding: '4px 9px', borderRadius: '4px', fontSize: '10px', fontWeight: 600, background: isActive ? 'var(--surface2)' : 'transparent', color: isActive ? 'var(--text)' : 'var(--text3)', border: isActive ? '1px solid var(--border2)' : '1px solid transparent', transition: 'all 0.15s' }}>
                {g}
              </button>
            );
          })}
        </div>

        {/* Sale only */}
        <button
          onClick={() => { const n = { ...filters }; if (n.onSaleOnly) { delete n.onSaleOnly; } else { n.onSaleOnly = true; } onFiltersChange(n); }}
          style={{ padding: '5px 11px', borderRadius: '6px', fontSize: '10px', fontWeight: 700, letterSpacing: '0.07em', background: filters.onSaleOnly === true ? 'rgba(0,255,135,0.12)' : 'var(--surface2)', color: filters.onSaleOnly === true ? 'var(--accent)' : 'var(--text3)', border: filters.onSaleOnly === true ? '1px solid rgba(0,255,135,0.3)' : '1px solid var(--border)', transition: 'all 0.15s', flexShrink: 0 }}
        >
          SALE ONLY
        </button>

        {/* Clear all */}
        {hasFilters && (
          <button onClick={clearAll} style={{ marginLeft: 'auto', fontSize: '10px', color: 'var(--text3)', fontWeight: 600, letterSpacing: '0.06em', flexShrink: 0 }}>
            CLEAR ✕
          </button>
        )}
      </div>

      {/* Collapsible: Brand */}
      {showBrand && (
        <div style={{ padding: '10px 12px 12px', borderTop: '1px solid var(--border)' }}>
          <div style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.1em', color: 'var(--text3)', textTransform: 'uppercase', marginBottom: '8px' }}>BRAND</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
            {brands.map((brand) => {
              const isActive = filters.vendor === brand;
              return (
                <button key={brand} onClick={() => { const n = { ...filters }; if (isActive) { delete n.vendor; } else { n.vendor = brand; } onFiltersChange(n); }}
                  style={{ padding: '3px 10px', borderRadius: '99px', fontSize: '11px', fontWeight: 600, background: isActive ? 'var(--accent-dim)' : 'var(--surface2)', color: isActive ? 'var(--accent)' : 'var(--text2)', border: isActive ? '1px solid rgba(0,255,135,0.3)' : '1px solid var(--border)', transition: 'all 0.15s' }}>
                  {brand}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Collapsible: Size */}
      {showSize && (
        <div style={{ padding: '10px 12px 12px', borderTop: '1px solid var(--border)' }}>
          <div style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.1em', color: 'var(--text3)', textTransform: 'uppercase', marginBottom: '8px' }}>UK SIZE</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
            {UK_SIZES.map((size) => {
              const isSelected = filters.size === size;
              return (
                <button key={size} onClick={() => { const n = { ...filters }; if (isSelected) { delete n.size; } else { n.size = size; } onFiltersChange(n); }}
                  style={{ width: '36px', height: '28px', borderRadius: '4px', fontSize: '11px', fontFamily: 'var(--font-mono)', fontWeight: isSelected ? 700 : 400, background: isSelected ? 'var(--accent)' : 'var(--surface2)', color: isSelected ? 'var(--bg)' : 'var(--text2)', border: isSelected ? '1px solid var(--accent)' : '1px solid var(--border)', transition: 'all 0.15s' }}>
                  {size}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Active chips */}
      {hasFilters && (
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px', padding: '8px 12px', borderTop: '1px solid var(--border)' }}>
          <span style={{ fontSize: '10px', color: 'var(--text3)', marginRight: '4px' }}>Showing:</span>
          {filters.vendor !== undefined && <FilterChipInline label={filters.vendor} onRemove={() => removeFilter('vendor')} />}
          {filters.size !== undefined && <FilterChipInline label={`UK ${filters.size}`} onRemove={() => removeFilter('size')} />}
          {filters.model !== undefined && <FilterChipInline label={filters.model} onRemove={() => { setModelQuery(''); removeFilter('model'); }} />}
          {filters.gender !== undefined && filters.gender !== 'All' && <FilterChipInline label={filters.gender} onRemove={() => removeFilter('gender')} />}
          {filters.onSaleOnly === true && <FilterChipInline label="On Sale" onRemove={() => removeFilter('onSaleOnly')} />}
        </div>
      )}
    </div>
  );
}
