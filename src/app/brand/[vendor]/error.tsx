'use client';
import React, { useEffect } from 'react';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function Error({ error, reset }: ErrorProps) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '12px', padding: '48px 24px' }}>
      <span style={{ fontSize: '32px', opacity: 0.4, color: 'var(--text2)' }}>◎</span>
      <p style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text)', margin: 0 }}>Something went wrong</p>
      <p style={{ fontSize: '13px', color: 'var(--text3)', margin: 0 }}>Failed to load brand page.</p>
      <button onClick={reset} style={{ marginTop: '8px', padding: '8px 20px', fontSize: '12px', fontWeight: 700, letterSpacing: '0.06em', background: 'var(--surface)', color: 'var(--text2)', border: '1px solid var(--border)', borderRadius: '6px', cursor: 'pointer' }}>
        TRY AGAIN
      </button>
    </div>
  );
}
