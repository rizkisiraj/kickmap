import Link from 'next/link';

export default function NotFound() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '70vh', gap: '10px', padding: '48px 24px' }}>
      <span style={{ fontSize: '48px', opacity: 0.3, color: 'var(--text2)' }}>◎</span>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '48px', fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.04em', lineHeight: 1 }}>
        404
      </div>
      <p style={{ fontSize: '14px', color: 'var(--text2)', margin: '4px 0 0' }}>Page not found</p>
      <Link href="/" style={{ marginTop: '16px', fontSize: '13px', fontWeight: 600, color: 'var(--accent)', textDecoration: 'none' }}>
        ← Back to home
      </Link>
    </div>
  );
}
