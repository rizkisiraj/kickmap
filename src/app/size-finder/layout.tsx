export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Size Finder | KickMap',
  description: 'Find your UK size across all JD Sports regions.',
};

export default function SizeFinderLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
