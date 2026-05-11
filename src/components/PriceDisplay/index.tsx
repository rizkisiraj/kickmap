import type { Currency } from '@/types';

interface PriceDisplayProps {
  original: number;
  current: number;
  currency: Currency;
  accent?: boolean;
}

const CURRENCY_LOCALE: Record<Currency, { locale: string; currency: string; prefix: string }> = {
  MYR: { locale: 'ms-MY', currency: 'MYR', prefix: 'RM' },
  IDR: { locale: 'id-ID', currency: 'IDR', prefix: 'Rp' },
  SGD: { locale: 'en-SG', currency: 'SGD', prefix: 'S$' },
  THB: { locale: 'th-TH', currency: 'THB', prefix: '฿' },
  USD: { locale: 'en-US', currency: 'USD', prefix: 'US$' },
};

function formatPrice(amount: number, currency: Currency): string {
  const { prefix } = CURRENCY_LOCALE[currency];
  const formatted = new Intl.NumberFormat('en', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
  return `${prefix}${formatted}`;
}

export function PriceDisplay({ original, current, currency, accent = true }: PriceDisplayProps) {
  const isDiscounted = original > current;

  return (
    <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: '6px', fontFamily: 'var(--font-mono)' }}>
      {isDiscounted && (
        <del style={{ color: 'var(--text3)', fontSize: '0.85em', textDecoration: 'line-through' }}>
          {formatPrice(original, currency)}
        </del>
      )}
      <span
        style={{
          color: isDiscounted && accent ? 'var(--accent)' : 'var(--text)',
          fontWeight: 600,
        }}
      >
        {formatPrice(current, currency)}
      </span>
    </span>
  );
}
