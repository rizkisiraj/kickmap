import type { Product } from '@/types';

interface AnnouncementBannerProps {
  product: Product | null;
}

export function AnnouncementBanner({ product }: AnnouncementBannerProps) {
  if (!product) return null;

  const saleStock = product.stock.find((s) => s.isOnSale);
  if (!saleStock) return null;

  const savings = saleStock.originalPrice
    ? Math.round(((saleStock.originalPrice - saleStock.price) / saleStock.originalPrice) * 100)
    : null;

  const label = savings
    ? `Back In Stock · ${product.title} — ${saleStock.currency} ${saleStock.price} · Save ${savings}%`
    : `Back In Stock · ${product.title} — ${saleStock.currency} ${saleStock.price}`;

  return (
    <div
      style={{
        background: 'var(--accent)',
        color: '#0a0a0a',
        fontSize: '11px',
        fontWeight: 700,
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        padding: '7px 16px',
        textAlign: 'center',
      }}
    >
      {label}
    </div>
  );
}
