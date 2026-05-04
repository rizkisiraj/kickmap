export default function Loading() {
  return (
    <div style={{ padding: '0 24px 48px' }}>
      <div style={{ padding: '24px 0 20px' }}>
        <div style={{ width: '180px', height: '24px', background: 'var(--surface)', borderRadius: '6px', marginBottom: '8px', animation: 'pulse 2s infinite' }} />
        <div style={{ width: '220px', height: '14px', background: 'var(--surface)', borderRadius: '4px', animation: 'pulse 2s infinite' }} />
      </div>
      {/* Controls skeleton */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
        <div style={{ width: '140px', height: '36px', background: 'var(--surface)', borderRadius: '6px', animation: 'pulse 2s infinite' }} />
        <div style={{ width: '140px', height: '36px', background: 'var(--surface)', borderRadius: '6px', animation: 'pulse 2s infinite' }} />
        <div style={{ flex: 1, height: '36px', background: 'var(--surface)', borderRadius: '6px', animation: 'pulse 2s infinite' }} />
      </div>
      {/* Table skeleton */}
      <div style={{ border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr 1fr 1fr 100px', borderBottom: '1px solid var(--border)' }}>
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} style={{ padding: '10px 14px' }}>
              <div style={{ height: '10px', background: 'var(--surface)', borderRadius: '3px', animation: 'pulse 2s infinite' }} />
            </div>
          ))}
        </div>
        {/* Rows */}
        {Array.from({ length: 10 }, (_, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '220px 1fr 1fr 1fr 100px', borderBottom: '1px solid var(--border)' }}>
            {[0, 1, 2, 3, 4].map((j) => (
              <div key={j} style={{ padding: '10px 14px' }}>
                <div style={{ height: j === 0 ? '36px' : '18px', background: 'var(--surface)', borderRadius: '4px', animation: 'pulse 2s infinite' }} />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
