import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { productService } from '@/services/product.service';
import { BrandClient } from './_components/BrandClient';

interface BrandPageProps {
  params: Promise<{ vendor: string }>;
}

export async function generateMetadata({ params }: BrandPageProps): Promise<Metadata> {
  const { vendor } = await params;
  const displayName = decodeURIComponent(vendor);
  return {
    title: `${displayName} Sneakers | KickMap`,
    description: `Browse all ${displayName} sneakers available in Malaysia, Indonesia, and Singapore on JD Sports.`,
  };
}

export default async function BrandPage({ params }: BrandPageProps) {
  const { vendor } = await params;
  const displayVendor = decodeURIComponent(vendor);

  const result = await productService.getProducts({ vendor: displayVendor }, { limit: 24 });
  const initialProducts = result.success ? result.data.data : [];
  const nextCursor = result.success ? result.data.meta.nextCursor : null;
  const total = result.success ? result.data.meta.total : 0;

  if (total === 0 && initialProducts.length === 0) {
    notFound();
  }

  const onSaleCount = initialProducts.filter((p) => p.stock.some((s) => s.isOnSale)).length;

  return (
    <div className="page-wrap">
      <div style={{ padding: '24px 0 0' }}>
        {/* Back link */}
        <Link href="/" style={{ fontSize: '11px', color: 'var(--text2)', textDecoration: 'none', display: 'inline-block', marginBottom: '12px' }}>
          ← All Products
        </Link>

        {/* Brand heading */}
        <h1 className="brand-heading" style={{ fontWeight: 900, letterSpacing: '-0.04em', textTransform: 'uppercase', lineHeight: 1, color: 'var(--text)', margin: '0 0 12px' }}>
          {displayVendor}
        </h1>

        {/* Stats bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px', paddingBottom: '20px', borderBottom: '1px solid var(--border)', fontSize: '13px', color: 'var(--text2)' }}>
          <span>
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--text)' }}>{total}</span>{' '}products
          </span>
          <span style={{ color: 'var(--border2)' }}>·</span>
          <span>In stock across 3 regions</span>
          {onSaleCount > 0 && (
            <>
              <span style={{ color: 'var(--border2)' }}>·</span>
              <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{onSaleCount} on sale</span>
            </>
          )}
        </div>
      </div>

      <BrandClient initialProducts={initialProducts} nextCursor={nextCursor} total={total} vendor={displayVendor} />
    </div>
  );
}
