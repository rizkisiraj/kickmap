'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_LINKS = [
  { href: '/', label: 'HEATMAP' },
  { href: '/deals', label: 'DEALS' },
  { href: '/compare', label: 'COMPARE' },
  { href: '/size-finder', label: 'SIZE FINDER' },
];

export function NavLinks() {
  const pathname = usePathname();
  return (
    <nav className="navbar-links" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
      {NAV_LINKS.map(({ href, label }) => {
        const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            style={{
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase' as const,
              padding: '6px 12px',
              borderRadius: '4px',
              color: isActive ? 'var(--accent)' : 'var(--text2)',
              background: isActive ? 'var(--accent-dim)' : 'transparent',
              textDecoration: 'none',
              transition: 'all 0.15s',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
