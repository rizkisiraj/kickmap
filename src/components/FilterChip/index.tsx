interface FilterChipProps {
  label: string;
  onRemove: () => void;
}

export function FilterChip({ label, onRemove }: FilterChipProps) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px',
        padding: '2px 8px 2px 10px',
        borderRadius: '99px',
        fontSize: '10px',
        fontWeight: 600,
        background: 'var(--accent-dim)',
        color: 'var(--accent)',
        border: '1px solid rgba(0,255,135,0.2)',
      }}
    >
      {label}
      <button
        onClick={onRemove}
        style={{
          fontSize: '11px',
          opacity: 0.7,
          color: 'var(--accent)',
          lineHeight: 1,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: 0,
        }}
        aria-label={`Remove ${label} filter`}
      >
        ✕
      </button>
    </span>
  );
}
