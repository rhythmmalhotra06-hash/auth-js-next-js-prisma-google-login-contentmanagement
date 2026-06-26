'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { recomputePriority } from '@/app/manager/actions';

export function RecomputeButton() {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const router = useRouter();

  return (
    <button
      onClick={() => start(async () => { const r = await recomputePriority(); setMsg(`scored ${r.scored}`); router.refresh(); })}
      disabled={pending}
      className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-60"
    >
      {pending ? 'Scoring…' : `Recompute priority${msg ? ` · ${msg}` : ''}`}
    </button>
  );
}
