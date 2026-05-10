import type { Region, StockLevel } from '@/types';
import { getColorForStockLevel } from './useRegionColor';

interface MapTooltipProps {
  region: { id: Region; label: string } | null;
  pos: { x: number; y: number } | null;
  stats: { total: number; onSale: number; topBrand: string };
  stockLevel: StockLevel;
  matchedCount: number;
  totalCount: number;
  selectedSize?: string;
}

const REGION_FLAGS: Record<Region, string> = {
  MY: '🇲🇾',
  ID: '🇮🇩',
  SG: '🇸🇬',
  TH: '🇹🇭',
};

export function MapTooltip({
  region,
  pos,
  stats,
  stockLevel,
  matchedCount,
  totalCount,
  selectedSize,
}: MapTooltipProps) {
  if (!region || !pos) return null;

  const glowColor = getColorForStockLevel(stockLevel);
  const fillPct = totalCount > 0 ? Math.min(100, (matchedCount / totalCount) * 100) : 0;

  return (
    <div
      style={{
        position: 'fixed',
        left: pos.x + 16,
        top: pos.y - 10,
        pointerEvents: 'none',
        zIndex: 9999,
        background: 'rgba(14,14,14,0.97)',
        border: `1px solid ${glowColor}55`,
        borderRadius: '8px',
        padding: '12px 16px',
        minWidth: '200px',
        boxShadow: `0 0 32px ${glowColor}18, 0 4px 24px rgba(0,0,0,0.5)`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
        <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)' }}>
          {REGION_FLAGS[region.id]} {region.label}
        </span>
        <span style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.08em', color: glowColor, background: `${glowColor}18`, border: `1px solid ${glowColor}44`, borderRadius: '99px', padding: '2px 7px' }}>
          {stockLevel.toUpperCase()}
        </span>
      </div>

      <div style={{ marginBottom: '10px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
          <span style={{ fontSize: '10px', color: 'var(--text3)' }}>Matched stock</span>
          <span style={{ fontSize: '10px', color: 'var(--text2)', fontFamily: 'var(--font-mono)' }}>{matchedCount}/{totalCount}</span>
        </div>
        <div style={{ height: '3px', background: '#222', borderRadius: '2px', overflow: 'hidden' }}>
          <div style={{ width: `${fillPct}%`, height: '100%', background: glowColor, borderRadius: '2px', transition: 'width 0.3s' }} />
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '10px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '10px', color: 'var(--text3)' }}>Available</span>
          <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text)' }}>{stats.total} sneakers</span>
        </div>
        {selectedSize !== undefined && (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '10px', color: 'var(--text3)' }}>UK {selectedSize} in stock</span>
            <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text)' }}>{matchedCount} styles</span>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '10px', color: 'var(--text3)' }}>Top brand</span>
          <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text)' }}>{stats.topBrand}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '10px', color: 'var(--text3)' }}>On sale</span>
          <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--accent)' }}>{stats.onSale} deals</span>
        </div>
      </div>

      <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.06em', color: glowColor, textAlign: 'center', borderTop: `1px solid ${glowColor}22`, paddingTop: '8px' }}>
        CLICK TO EXPLORE →
      </div>
    </div>
  );
}
