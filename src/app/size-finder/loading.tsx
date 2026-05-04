export default function Loading() {
  return (
    <div style={{ padding: '0 24px 48px' }}>
      <div style={{ padding: '24px 0 20px' }}>
        <div style={{ width: '120px', height: '24px', background: 'var(--surface)', borderRadius: '6px', marginBottom: '8px', animation: 'pulse 2s infinite' }} />
        <div style={{ width: '300px', height: '14px', background: 'var(--surface)', borderRadius: '4px', animation: 'pulse 2s infinite' }} />
      </div>
      {/* Size chip grid skeleton */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '16px', marginBottom: '24px' }}>
        <div style={{ width: '60px', height: '10px', background: 'var(--surface2)', borderRadius: '3px', marginBottom: '10px', animation: 'pulse 2s infinite' }} />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {Array.from({ length: 20 }, (_, i) => (
            <div key={i} style={{ width: '52px', height: '40px', background: 'var(--surface2)', borderRadius: '6px', animation: 'pulse 2s infinite' }} />
          ))}
        </div>
      </div>
      {/* Empty state area */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '60px 24px', gap: '10px' }}>
        <div style={{ width: '32px', height: '32px', background: 'var(--surface)', borderRadius: '50%', animation: 'pulse 2s infinite' }} />
        <div style={{ width: '240px', height: '14px', background: 'var(--surface)', borderRadius: '4px', animation: 'pulse 2s infinite' }} />
      </div>
    </div>
  );
}
