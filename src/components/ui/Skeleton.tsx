import React from 'react';

interface SkeletonProps {
  className?: string;
  style?: React.CSSProperties;
}

export function Skeleton({ className, style }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse ${className ?? ''}`}
      style={{
        background: 'var(--surface)',
        borderRadius: 'var(--radius)',
        ...style,
      }}
    />
  );
}
