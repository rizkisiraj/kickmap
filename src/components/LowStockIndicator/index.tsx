interface LowStockIndicatorProps {
  stock: number;
}

export function LowStockIndicator({ stock }: LowStockIndicatorProps) {
  if (stock <= 0 || stock > 10) return null;

  const isVeryLow = stock <= 3;
  const color = isVeryLow ? '#ef4444' : '#f59e0b';
  const fillPct = Math.min(100, (stock / 10) * 100);
  const label = isVeryLow ? `ONLY ${stock} LEFT` : 'LOW STOCK';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <div
        style={{
          width: '40px',
          height: '3px',
          background: '#222',
          borderRadius: '2px',
          overflow: 'hidden',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            width: `${fillPct}%`,
            height: '100%',
            background: color,
            borderRadius: '2px',
            transition: 'width 0.3s',
          }}
        />
      </div>
      <span
        style={{
          fontSize: '10px',
          color,
          fontWeight: 600,
          letterSpacing: '0.05em',
          fontFamily: 'var(--font-head)',
        }}
      >
        {label}
      </span>
    </div>
  );
}
