import React from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const SIZE_STYLES: Record<ButtonSize, React.CSSProperties> = {
  sm: { fontSize: '10px', padding: '4px 11px' },
  md: { fontSize: '12px', padding: '6px 14px' },
  lg: { fontSize: '13px', padding: '8px 16px' },
};

const VARIANT_STYLES: Record<ButtonVariant, React.CSSProperties> = {
  primary: {
    background: 'var(--accent-dim)',
    color: 'var(--accent)',
    border: '1px solid rgba(0,255,135,0.25)',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
  },
  secondary: {
    background: 'var(--surface)',
    color: 'var(--text2)',
    border: '1px solid var(--border)',
    letterSpacing: '0.06em',
  },
  ghost: {
    background: 'transparent',
    color: 'var(--text2)',
    border: '1px solid transparent',
    letterSpacing: '0.06em',
  },
};

export function Button({ variant = 'secondary', size = 'md', style, ...props }: ButtonProps) {
  return (
    <button
      {...props}
      style={{
        fontWeight: 600,
        borderRadius: 'var(--radius)',
        transition: 'all 0.15s',
        cursor: 'pointer',
        fontFamily: 'var(--font-head)',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        ...SIZE_STYLES[size],
        ...VARIANT_STYLES[variant],
        ...style,
      }}
    />
  );
}
