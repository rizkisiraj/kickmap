export default function Loading() {
  return (
    <div style={{ padding: '0 24px 48px' }}>
      <div style={{ padding: '24px 0 0' }}>
        <div style={{ width: '60px', height: '11px', background: 'var(--surface)', borderRadius: '3px', marginBottom: '20px', animation: 'pulse 2s infinite' }} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: '32px', alignItems: 'flex-start' }}>
          {/* Image skeleton */}
          <div style={{ aspectRatio: '1', background: 'var(--surface)', borderRadius: '8px', animation: 'pulse 2s infinite' }} />
          {/* Info skeleton */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', gap: '6px' }}>
              <div style={{ width: '70px', height: '24px', background: 'var(--surface)', borderRadius: '99px', animation: 'pulse 2s infinite' }} />
              <div style={{ width: '50px', height: '24px', background: 'var(--surface)', borderRadius: '99px', animation: 'pulse 2s infinite' }} />
            </div>
            <div style={{ width: '280px', height: '32px', background: 'var(--surface)', borderRadius: '6px', animation: 'pulse 2s infinite' }} />
            <div style={{ width: '160px', height: '14px', background: 'var(--surface)', borderRadius: '4px', animation: 'pulse 2s infinite' }} />
            <div style={{ height: '64px', background: 'var(--surface)', borderRadius: '8px', animation: 'pulse 2s infinite' }} />
            {/* Region card skeletons */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
              {[0, 1, 2].map((i) => (
                <div key={i} style={{ height: '80px', background: 'var(--surface)', borderRadius: '8px', animation: 'pulse 2s infinite' }} />
              ))}
            </div>
            {/* Size chips */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {Array.from({ length: 12 }, (_, i) => (
                <div key={i} style={{ width: '38px', height: '28px', background: 'var(--surface)', borderRadius: '5px', animation: 'pulse 2s infinite' }} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
