import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
}

export function Badge({ children, style, className }: BadgeProps) {
  return (
    <span
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 8px',
        borderRadius: '99px',
        fontSize: '10px',
        fontWeight: 700,
        letterSpacing: '0.06em',
        background: 'var(--surface2)',
        color: 'var(--text2)',
        border: '1px solid var(--border)',
        ...style,
      }}
    >
      {children}
    </span>
  );
}
