'use client';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';

type SortOption = 'name' | 'price' | 'discount';
const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'name', label: 'NAME' },
  { value: 'price', label: 'PRICE' },
  { value: 'discount', label: 'DEAL' },
];

export function SortControl() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = (searchParams.get('sort') ?? 'name') as SortOption;

  const handleChange = (sort: SortOption) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('sort', sort);
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div style={{ display: 'inline-flex', padding: '3px', background: 'var(--surface)', borderRadius: '6px', border: '1px solid var(--border)' }}>
      {SORT_OPTIONS.map(({ value, label }) => {
        const isActive = current === value;
        return (
          <button
            key={value}
            onClick={() => handleChange(value)}
            style={{
              padding: '4px 10px',
              borderRadius: '4px',
              fontSize: '11px',
              fontWeight: 700,
              background: isActive ? 'var(--surface2)' : 'transparent',
              color: isActive ? 'var(--text)' : 'var(--text2)',
              border: isActive ? '1px solid var(--border2)' : '1px solid transparent',
              transition: 'all 0.15s',
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
