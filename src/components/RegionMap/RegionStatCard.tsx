import React, { useState } from 'react';
import type { RegionMapData, Region } from '@/types';
import { getColorForStockLevel } from './useRegionColor';

const REGION_FLAGS: Record<Region, string> = { MY: '🇲🇾', ID: '🇮🇩', SG: '🇸🇬', TH: '🇹🇭' };
const REGION_LABELS: Record<Region, string> = { MY: 'Malaysia', ID: 'Indonesia', SG: 'Singapore', TH: 'Thailand' };

interface RegionStatCardProps {
  data: RegionMapData;
  onClick: () => void;
  hasActiveFilters: boolean;
}

export function RegionStatCard({ data, onClick, hasActiveFilters }: RegionStatCardProps) {
  const [hovered, setHovered] = useState(false);
  const glowColor = getColorForStockLevel(data.stockLevel);
  const activeFill = hasActiveFilters && data.matchedCount !== undefined ? data.matchedCount : data.inStockCount;
  const fillPct = data.totalProducts > 0
    ? Math.min(100, (activeFill / data.totalProducts) * 100)
    : 0;

  const displayCount = hasActiveFilters && data.matchedCount !== undefined
    ? data.matchedCount
    : data.inStockCount;

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'block',
        width: '100%',
        textAlign: 'left',
        background: hovered ? 'var(--surface2)' : 'var(--surface)',
        border: `1px solid var(--border)`,
        borderLeft: `3px solid ${glowColor}`,
        borderRadius: '8px',
        padding: '11px 12px',
        cursor: 'pointer',
        transition: 'background 0.15s',
      }}
    >
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
        <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text)' }}>
          {REGION_FLAGS[data.region]} {REGION_LABELS[data.region]}
        </span>
        <span style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.08em', color: glowColor }}>
          {data.stockLevel.toUpperCase()}
        </span>
      </div>

      {/* Count */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginBottom: '6px' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '16px', fontWeight: 800, color: glowColor }}>
          {displayCount}
        </span>
        {hasActiveFilters && data.matchedCount !== undefined && (
          <span style={{ fontSize: '10px', color: 'var(--text3)' }}>
            / {data.inStockCount}
          </span>
        )}
      </div>

      {/* Mini progress bar */}
      <div style={{ height: '2px', background: '#222', borderRadius: '2px', overflow: 'hidden', marginBottom: '6px' }}>
        <div style={{ width: `${fillPct}%`, height: '100%', background: glowColor, borderRadius: '2px', transition: 'width 0.3s' }} />
      </div>

      {/* Footer */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '9px', color: 'var(--text3)' }}>sneakers in stock</span>
        {data.onSaleCount > 0 && (
          <span style={{ fontSize: '9px', fontWeight: 700, color: 'var(--accent)' }}>
            {data.onSaleCount} on sale
          </span>
        )}
      </div>
    </button>
  );
}
