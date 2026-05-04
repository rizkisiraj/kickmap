'use client';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import type { Currency } from '@/types';

const CURRENCIES: Currency[] = ['SGD', 'IDR', 'MYR'];

export function CurrencyToggle() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = (searchParams.get('currency') ?? 'SGD') as Currency;

  const handleChange = (currency: Currency) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('currency', currency);
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div style={{ display: 'inline-flex', padding: '3px', background: 'var(--surface)', borderRadius: '6px', border: '1px solid var(--border)' }}>
      {CURRENCIES.map((currency) => {
        const isActive = current === currency;
        return (
          <button
            key={currency}
            onClick={() => handleChange(currency)}
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
            {currency}
          </button>
        );
      })}
    </div>
  );
}
