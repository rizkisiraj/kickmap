interface SaleBadgeProps {
  pct?: number;
  size?: 'sm' | 'md';
}

const SIZE_STYLES = {
  sm: { padding: '2px 7px', fontSize: '10px' },
  md: { padding: '3px 10px', fontSize: '11px' },
} as const;

export function SaleBadge({ pct, size = 'sm' }: SaleBadgeProps) {
  const sizeStyle = SIZE_STYLES[size];
  // Use unicode minus sign U+2212
  const text = pct !== undefined ? `SALE \u2212${pct}%` : 'SALE';

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        background: 'rgba(0,255,135,0.12)',
        color: '#00ff87',
        border: '1px solid rgba(0,255,135,0.3)',
        borderRadius: '99px',
        fontWeight: 700,
        letterSpacing: '0.07em',
        ...sizeStyle,
      }}
    >
      {text}
    </span>
  );
}
