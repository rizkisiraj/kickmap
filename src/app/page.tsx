import type { Metadata } from 'next';
import { heatmapService } from '@/services/heatmap.service';
import { productService } from '@/services/product.service';
import { HomepageClient } from './_components/HomepageClient';

export const metadata: Metadata = {
  title: 'KickMap — JD Sports Heatmap MY · ID · SG',
  description: 'Live sneaker stock, prices, and deals across Malaysia, Indonesia, and Singapore.',
};

export default async function Home() {
  const [heatmapResult, productsResult, dealsResult] = await Promise.all([
    heatmapService.getHeatmapData(),
    productService.getProducts({}),
    productService.getProducts({ onSaleOnly: true }),
  ]);

  const regionData = heatmapResult.success ? heatmapResult.data : [];
  const allProducts = productsResult.success ? productsResult.data.data : [];
  const topDeal = dealsResult.success
    ? (dealsResult.data.data
        .map((p) => {
          const maxDiscount = p.stock
            .filter((s) => s.isOnSale && s.originalPrice !== null && s.originalPrice > 0)
            .reduce((best, s) => {
              const pct = ((s.originalPrice! - s.price) / s.originalPrice!) * 100;
              return pct > best ? pct : best;
            }, 0);
          return { product: p, maxDiscount };
        })
        .sort((a, b) => b.maxDiscount - a.maxDiscount)[0]?.product ?? null)
    : null;

  const brands = ["Nike","New Balance","Birkenstock","Adidas","Puma","Hoka","Asics"].sort();

  return (
    <HomepageClient
      initialRegionData={regionData}
      allProducts={allProducts}
      brands={brands}
      topDeal={topDeal}
    />
  );
}
