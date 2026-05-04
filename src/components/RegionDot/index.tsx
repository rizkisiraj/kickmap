import type { Region } from '@/types';

interface RegionDotProps {
  region: Region;
  active: boolean;
}

const REGION_COLORS: Record<Region, string> = {
  MY: '#3b82f6',
  ID: '#ef4444',
  SG: '#f59e0b',
};

const REGION_NAMES: Record<Region, string> = {
  MY: 'Malaysia',
  ID: 'Indonesia',
  SG: 'Singapore',
};

export function RegionDot({ region, active }: RegionDotProps) {
  const color = REGION_COLORS[region];
  const name = REGION_NAMES[region];
  const title = `${name}: ${active ? 'In Stock' : 'Out of Stock'}`;

  return (
    <span
      title={title}
      style={{
        display: 'inline-block',
        width: '8px',
        height: '8px',
        borderRadius: '50%',
        background: active ? color : 'transparent',
        border: `1.5px solid ${active ? color : '#444'}`,
        flexShrink: 0,
      }}
    />
  );
}
