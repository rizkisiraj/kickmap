'use client';
import { useRouter } from 'next/navigation';

export function BackButton() {
  const router = useRouter();
  return (
    <button
      onClick={() => router.back()}
      style={{ fontSize: '11px', color: 'var(--text2)', background: 'none', border: 'none', padding: 0, cursor: 'pointer', marginBottom: '20px', display: 'inline-block' }}
    >
      ← Back
    </button>
  );
}
