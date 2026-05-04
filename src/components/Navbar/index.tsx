import Link from 'next/link';
import { NavLinks } from './NavLinks';

interface NavbarProps {
  lastUpdated?: string;
}

const REGION_COLORS: Record<string, string> = {
  MY: '#3b82f6',
  ID: '#ef4444',
  SG: '#f59e0b',
};

export function Navbar({ lastUpdated }: NavbarProps) {
  return (
    <header
      className="navbar-header"
      style={{
        position: 'sticky',
        top: 0,
        height: '52px',
        background: 'rgba(10,10,10,0.92)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--border)',
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
      }}
    >
      {/* Logo + Site Name */}
      <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none', flexShrink: 0 }}>
        <div
          style={{
            width: '28px',
            height: '28px',
            borderRadius: '6px',
            background: 'var(--accent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#0a0a0a',
            fontWeight: 800,
            letterSpacing: '-0.04em',
            fontSize: '13px',
            flexShrink: 0,
          }}
        >
          KM
        </div>
        <span className="navbar-site-name" style={{ fontSize: '15px', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text)' }}>
          KickMap
        </span>
      </Link>

      {/* Nav Links */}
      <NavLinks />

      {/* Right side */}
      <div className="navbar-meta" style={{ marginLeft: 'auto', alignItems: 'center', gap: '16px', flexShrink: 0 }}>
        {lastUpdated && (
          <span
            style={{
              fontSize: '11px',
              color: 'var(--text3)',
              fontFamily: 'var(--font-mono)',
            }}
          >
            ⟳ {lastUpdated}
          </span>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {Object.entries(REGION_COLORS).map(([region, color]) => (
            <span
              key={region}
              style={{
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: '0.06em',
                color,
                padding: '2px 6px',
                borderRadius: '99px',
                background: `${color}22`,
                border: `1px solid ${color}44`,
              }}
            >
              {region}
            </span>
          ))}
        </div>
      </div>
    </header>
  );
}
