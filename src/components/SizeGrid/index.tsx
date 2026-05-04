'use client';
import React from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';

const UK_SIZES = [
  '3', '3.5', '4', '4.5', '5', '5.5', '6', '6.5',
  '7', '7.5', '8', '8.5', '9', '9.5', '10', '10.5',
  '11', '11.5', '12', '12.5', '13', '14', '15', '16',
];

interface SizeGridProps {
  availableSizes?: string[] | undefined;
}

export function SizeGrid({ availableSizes }: SizeGridProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selectedSize = searchParams.get('size');

  const handleClick = (size: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (selectedSize === size) {
      params.delete('size');
    } else {
      params.set('size', size);
    }
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
      {UK_SIZES.map((size) => {
        const isSelected = selectedSize === size;
        const hasStock = availableSizes === undefined || availableSizes.includes(size);

        let bg = 'var(--surface2)';
        let color = 'var(--text)';
        let border = '1.5px solid var(--border2)';
        let cursor: React.CSSProperties['cursor'] = 'pointer';

        if (isSelected) {
          bg = 'var(--accent)';
          color = 'var(--bg)';
          border = '1.5px solid var(--accent)';
        } else if (!hasStock) {
          bg = 'rgba(255,255,255,0.02)';
          color = 'var(--text3)';
          border = '1.5px solid var(--border)';
          cursor = 'default';
        }

        return (
          <button
            key={size}
            onClick={hasStock ? () => handleClick(size) : undefined}
            style={{ width: '52px', height: '40px', borderRadius: '6px', fontSize: '12px', fontFamily: 'var(--font-mono)', fontWeight: 600, background: bg, color, border, cursor, transition: 'all 0.15s' }}
          >
            {size}
          </button>
        );
      })}
    </div>
  );
}
