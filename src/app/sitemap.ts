export const dynamic = 'force-dynamic';

import type { MetadataRoute } from 'next';
import { productService } from '@/services/product.service';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${baseUrl}/`, changeFrequency: 'hourly', priority: 1 },
    { url: `${baseUrl}/deals`, changeFrequency: 'hourly', priority: 0.9 },
    { url: `${baseUrl}/compare`, changeFrequency: 'hourly', priority: 0.8 },
    { url: `${baseUrl}/size-finder`, changeFrequency: 'daily', priority: 0.7 },
  ];

  const result = await productService.getProducts({}, { limit: 5000 });
  const products = result.success ? result.data.data : [];

  const productRoutes: MetadataRoute.Sitemap = products.map((p) => ({
    url: `${baseUrl}/product/${p.productCode}`,
    changeFrequency: 'daily' as const,
    priority: 0.6,
  }));

  const vendors = [...new Set(products.map((p) => p.vendor))];
  const brandRoutes: MetadataRoute.Sitemap = vendors.map((vendor) => ({
    url: `${baseUrl}/brand/${encodeURIComponent(vendor)}`,
    changeFrequency: 'daily' as const,
    priority: 0.5,
  }));

  return [...staticRoutes, ...productRoutes, ...brandRoutes];
}
