export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import { dealsService } from '@/services/deals.service';
import { RegionBadge } from '@/components/RegionBadge';
import { DealsClient } from './_components/DealsClient';

export const metadata: Metadata = {
  title: 'Deals | KickMap',
  description: 'Best sneaker deals on JD Sports right now, ranked by discount.',
};

export default async function DealsPage() {
  const result = await dealsService.getDeals({ sort: 'discount_desc', limit: 20 });
  const initialDeals = result.success ? result.data.data : [];
  const nextCursor = result.success ? result.data.meta.nextCursor : null;
  const total = result.success ? result.data.meta.total : 0;

  const topDeal = initialDeals[0];

  return (
    <div className="page-wrap">
      {/* Header summary */}
      <div style={{ padding: '24px 0 20px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text)', margin: '0 0 16px' }}>
          Deals
        </h1>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ fontSize: '13px', color: 'var(--text2)' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '15px', fontWeight: 700, color: 'var(--accent)' }}>{total}</span>
            {' '}products on sale across 3 regions.
            {topDeal !== undefined && (
              <span> Biggest discount: {topDeal.vendor} {topDeal.title.split(' ').slice(0, 4).join(' ')} —{' '}
                <span style={{ fontWeight: 700, color: 'var(--text)' }}>{topDeal.discountPercent}% off</span>{' '}in{' '}
                <RegionBadge region={topDeal.region} size="sm" />
              </span>
            )}
          </div>
          <span style={{ fontSize: '10px', color: 'var(--text3)', fontFamily: 'var(--font-mono)' }}>⟳ refreshed regularly</span>
        </div>
      </div>

      <DealsClient initialDeals={initialDeals} nextCursor={nextCursor} total={total} />
    </div>
  );
}
