export default function Loading() {
  return (
    <div style={{ padding: '0 24px 48px' }}>
      <div style={{ padding: '24px 0 0' }}>
        <div style={{ width: '80px', height: '11px', background: 'var(--surface)', borderRadius: '3px', marginBottom: '12px', animation: 'pulse 2s infinite' }} />
        {/* Large brand heading skeleton */}
        <div style={{ width: '280px', height: '40px', background: 'var(--surface)', borderRadius: '6px', marginBottom: '12px', animation: 'pulse 2s infinite' }} />
        {/* Stats row */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', paddingBottom: '20px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ width: '100px', height: '14px', background: 'var(--surface)', borderRadius: '3px', animation: 'pulse 2s infinite' }} />
          <div style={{ width: '160px', height: '14px', background: 'var(--surface)', borderRadius: '3px', animation: 'pulse 2s infinite' }} />
        </div>
      </div>
      {/* Card grid skeletons */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' }}>
        {Array.from({ length: 12 }, (_, i) => (
          <div key={i} style={{ height: '260px', background: 'var(--surface)', borderRadius: '10px', animation: 'pulse 2s infinite' }} />
        ))}
      </div>
    </div>
  );
}
