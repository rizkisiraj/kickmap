import type { Region } from '@/types';

interface RegionBadgeProps {
  region: Region;
  size?: 'sm' | 'md';
}

const REGION_COLORS: Record<Region, { color: string; bg: string; border: string }> = {
  MY: { color: '#3b82f6', bg: 'rgba(59,130,246,0.15)', border: '#3b82f633' },
  ID: { color: '#ef4444', bg: 'rgba(239,68,68,0.15)', border: '#ef444433' },
  SG: { color: '#f59e0b', bg: 'rgba(245,158,11,0.15)', border: '#f59e0b33' },
  TH: { color: '#8b5cf6', bg: 'rgba(139,92,246,0.15)', border: '#8b5cf633' },
};

const SIZE_STYLES = {
  sm: { padding: '2px 7px', fontSize: '10px' },
  md: { padding: '3px 10px', fontSize: '11px' },
} as const;

export function RegionBadge({ region, size = 'sm' }: RegionBadgeProps) {
  const { color, bg, border } = REGION_COLORS[region];
  const sizeStyle = SIZE_STYLES[size];

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        borderRadius: '99px',
        fontWeight: 700,
        letterSpacing: '0.06em',
        fontFamily: 'var(--font-head)',
        color,
        background: bg,
        border: `1px solid ${border}`,
        ...sizeStyle,
      }}
    >
      {region}
    </span>
  );
}
