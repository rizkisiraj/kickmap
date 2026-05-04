import type { Metadata } from 'next';
import { Suspense } from 'react';
import { productService } from '@/services/product.service';
import { CompareClient } from './_components/CompareClient';

export const metadata: Metadata = {
  title: 'Price Compare | KickMap',
  description: 'Compare sneaker prices across MY, ID, SG.',
};

interface ComparePageProps {
  searchParams: Promise<{ q?: string }>;
}

export default async function ComparePage({ searchParams }: ComparePageProps) {
  const { q } = await searchParams;
  const trimmedQ = q && q.trim().length >= 2 ? q.trim() : undefined;

  const result = await productService.getProducts(
    { multiRegion: true, ...(trimmedQ !== undefined ? { q: trimmedQ } : {}) },
    { limit: 200 },
  );

  const products = result.success ? result.data.data : [];
  const total = result.success ? result.data.meta.total : 0;

  return (
    <div className="page-wrap">
      <div style={{ padding: '24px 0 20px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text)', margin: '0 0 4px' }}>
          Price Comparison
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--text2)', margin: 0 }}>
          Cheapest price highlighted · {total} products in 2+ regions
        </p>
      </div>
      <Suspense>
        <CompareClient
          products={products}
          total={total}
          initialQ={q ?? ''}
        />
      </Suspense>
    </div>
  );
}
