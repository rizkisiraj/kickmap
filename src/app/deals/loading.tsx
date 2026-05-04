export default function Loading() {
  return (
    <div style={{ padding: '0 24px 48px' }}>
      <div style={{ padding: '24px 0 20px' }}>
        <div style={{ width: '80px', height: '24px', background: 'var(--surface)', borderRadius: '6px', marginBottom: '16px', animation: 'pulse 2s infinite' }} />
        <div style={{ height: '48px', background: 'var(--surface)', borderRadius: '8px', animation: 'pulse 2s infinite' }} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {Array.from({ length: 12 }, (_, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden', height: '88px', animation: 'pulse 2s infinite' }}>
            <div style={{ width: '44px', height: '100%', background: 'var(--surface2)', borderRight: '1px solid var(--border)' }} />
            <div style={{ width: '88px', height: '88px', background: '#111', flexShrink: 0 }} />
            <div style={{ flex: 1, padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ width: '120px', height: '10px', background: 'var(--surface2)', borderRadius: '3px' }} />
              <div style={{ width: '200px', height: '14px', background: 'var(--surface2)', borderRadius: '3px' }} />
              <div style={{ width: '80px', height: '10px', background: 'var(--surface2)', borderRadius: '3px' }} />
            </div>
            <div style={{ width: '100px', padding: '10px 16px', display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-end' }}>
              <div style={{ width: '60px', height: '10px', background: 'var(--surface2)', borderRadius: '3px' }} />
              <div style={{ width: '80px', height: '18px', background: 'var(--surface2)', borderRadius: '3px' }} />
              <div style={{ width: '50px', height: '10px', background: 'var(--surface2)', borderRadius: '3px' }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
