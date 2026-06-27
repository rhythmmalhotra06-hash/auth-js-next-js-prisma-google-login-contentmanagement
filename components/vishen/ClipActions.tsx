'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { approveClip, dismissClip } from '@/app/vishen/actions';
import { Button } from '@/components/ui/Button';

export function ClipActions({ clipId, size = 'sm' }: { clipId: string; size?: 'sm' | 'md' }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();

  const run = (fn: (id: string) => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      setErr(null);
      const r = await fn(clipId);
      if (!r.ok) setErr(r.error ?? 'failed');
      router.refresh();
    });

  return (
    <div className="flex items-center gap-2">
      <Button size={size} disabled={pending} onClick={() => run(approveClip)}>Approve</Button>
      <Button variant="ghost" size={size} disabled={pending} onClick={() => run(dismissClip)}>Dismiss</Button>
      {pending && <span className="text-xs text-text-subtle">saving…</span>}
      {err && <span className="text-xs text-danger">{err}</span>}
    </div>
  );
}
