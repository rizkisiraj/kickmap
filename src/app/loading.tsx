export default function Loading() {
  return (
    <div style={{ padding: '0 24px 48px' }}>
      {/* Hero skeleton */}
      <div style={{ padding: '32px 0 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ width: '320px', height: '28px', background: 'var(--surface)', borderRadius: '6px', animation: 'pulse 2s infinite' }} />
          <div style={{ width: '200px', height: '14px', background: 'var(--surface)', borderRadius: '4px', animation: 'pulse 2s infinite' }} />
        </div>
        <div style={{ display: 'flex', gap: '16px' }}>
          {[0, 1, 2].map((i) => (
            <div key={i} style={{ width: '48px', height: '40px', background: 'var(--surface)', borderRadius: '6px', animation: 'pulse 2s infinite' }} />
          ))}
        </div>
      </div>

      {/* Filter bar skeleton */}
      <div style={{ height: '40px', background: 'var(--surface)', borderRadius: '8px', marginBottom: '16px', animation: 'pulse 2s infinite' }} />

      {/* Map + sidebar skeleton */}
      <div style={{ display: 'flex', gap: '16px' }}>
        <div style={{ flex: 1, aspectRatio: '420/310', background: 'var(--surface)', borderRadius: '10px', animation: 'pulse 2s infinite' }} />
        <div style={{ width: '210px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ height: '80px', background: 'var(--surface)', borderRadius: '8px', animation: 'pulse 2s infinite' }} />
          {[0, 1, 2].map((i) => (
            <div key={i} style={{ height: '72px', background: 'var(--surface)', borderRadius: '8px', animation: 'pulse 2s infinite' }} />
          ))}
          <div style={{ height: '36px', background: 'var(--surface)', borderRadius: '8px', animation: 'pulse 2s infinite' }} />
        </div>
      </div>
    </div>
  );
}
