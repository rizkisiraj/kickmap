import type { Product } from '@/types';
import { ProductCard } from '@/components/ProductCard';

interface ProductGridProps {
  products: Product[];
  priorityCount?: number;
}

export function ProductGrid({ products, priorityCount = 4 }: ProductGridProps) {
  if (products.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '64px 24px', gap: '12px' }}>
        <span style={{ fontSize: '32px', opacity: 0.4, color: 'var(--text2)' }}>◎</span>
        <span style={{ fontSize: '14px', color: 'var(--text2)', fontWeight: 500 }}>No products found</span>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' }}>
      {products.map((product, i) => (
        <ProductCard key={product.productCode} product={product} priority={i < priorityCount} />
      ))}
    </div>
  );
}
