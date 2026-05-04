import React from 'react';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import type { Region } from '@/types';
import { productService } from '@/services/product.service';
import { RegionBadge } from '@/components/RegionBadge';
import { SaleBadge } from '@/components/SaleBadge';
import { PriceDisplay } from '@/components/PriceDisplay';
import { LowStockIndicator } from '@/components/LowStockIndicator';
import { ProductDetailClient } from './_components/ProductDetailClient';
import { BackButton } from './_components/BackButton';

interface ProductPageProps {
  params: Promise<{ productCode: string }>;
}

export async function generateMetadata({ params }: Pick<ProductPageProps, 'params'>): Promise<Metadata> {
  const { productCode } = await params;
  const result = await productService.getByCode(productCode);
  if (!result.success) return { title: 'Product | KickMap' };
  const p = result.data;
  return {
    title: `${p.vendor} ${p.title} | KickMap`,
    description: `Compare ${p.vendor} ${p.title} prices across Malaysia, Indonesia, and Singapore on JD Sports.`,
    openGraph: {
      images: [{ url: p.imageUrl }],
    },
  };
}

const REGION_NAMES: Record<Region, string> = { MY: 'Malaysia', ID: 'Indonesia', SG: 'Singapore' };
const REGION_FLAGS: Record<Region, string> = { MY: '🇲🇾', ID: '🇮🇩', SG: '🇸🇬' };

// Approximate SGD conversion
const TO_SGD: Record<string, number> = { SGD: 1, MYR: 0.29, IDR: 0.000086, USD: 1.35 };

export default async function ProductPage({ params }: ProductPageProps) {
  const { productCode } = await params;
  const result = await productService.getByCode(productCode);

  if (!result.success) {
    notFound();
  }

  const product = result.data;
  const regions: Region[] = ['MY', 'ID', 'SG'];

  // Find cheapest region in SGD
  let cheapestRegion: Region | null = null;
  let cheapestSGD = Infinity;
  for (const s of product.stock) {
    if (!s.inStock) continue;
    const inSGD = s.price * (TO_SGD[s.currency] ?? 1);
    if (inSGD < cheapestSGD) {
      cheapestSGD = inSGD;
      cheapestRegion = s.region;
    }
  }

  const mostExpensiveSGD = product.stock
    .filter((s) => s.inStock)
    .reduce((max, s) => Math.max(max, s.price * (TO_SGD[s.currency] ?? 1)), 0);
  const savings = mostExpensiveSGD - cheapestSGD;

  const latestScrapedAt = product.stock.reduce<string | null>((latest, s) => {
    if (!latest || s.scrapedAt > latest) return s.scrapedAt;
    return latest;
  }, null);

  // JSON-LD
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.title,
    image: product.imageUrl,
    brand: { '@type': 'Brand', name: product.vendor },
    offers: product.stock.filter((s) => s.inStock).map((s) => ({
      '@type': 'Offer',
      price: s.price,
      priceCurrency: s.currency,
      availability: 'https://schema.org/InStock',
      name: `${REGION_NAMES[s.region]} (JD Sports)`,
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="page-wrap">
        <div style={{ padding: '24px 0 0' }}>
          <BackButton />
          <div className="product-detail-grid">
            {/* Left: sticky image */}
            <div className="product-image-sticky">
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden', aspectRatio: '1' }}>
                <Image
                  src={product.imageUrl}
                  alt={product.title}
                  width={600}
                  height={600}
                  priority
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
              </div>
            </div>

            {/* Right: info panel */}
            <ProductDetailClient
              product={product}
              regions={regions}
              cheapestRegion={cheapestRegion}
              savings={savings}
              latestScrapedAt={latestScrapedAt}
            />
          </div>
        </div>
      </div>
    </>
  );
}
