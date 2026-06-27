'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { approveClip, dismissClip } from '@/app/vishen/actions';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import type { ClipSuggestion } from '@/lib/media/repository';

export function ClipApprovalCard({ clip }: { clip: ClipSuggestion }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();
  const approved = clip.status === 'Approved';

  const run = (fn: (id: string) => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      setErr(null);
      const r = await fn(clip.id);
      if (!r.ok) setErr(r.error ?? 'failed');
      router.refresh();
    });

  return (
    <article
      className={
        'flex flex-col gap-3 rounded-[12px] border bg-surface p-4 shadow-[var(--mv-shadow-light)] ' +
        (approved ? 'border-border-default' : 'border-l-[3px] border-l-gold border-border-default')
      }
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold leading-snug text-text">{clip.hookLine || clip.name || 'Untitled clip'}</h3>
          {(clip.timestampStart || clip.timestampEnd) && (
            <p className="mt-1 text-[11.5px] text-text-subtle tabular-nums">
              {clip.timestampStart}{clip.timestampEnd ? `–${clip.timestampEnd}` : ''}
            </p>
          )}
        </div>
        {clip.viralityScore != null && (
          <div className="flex-none rounded-[10px] bg-brand-soft px-2.5 py-1.5 text-center">
            <div className="text-[19px] font-bold leading-none text-brand-content tabular-nums">{clip.viralityScore}</div>
            <div className="text-[9.5px] font-semibold uppercase tracking-wide text-brand">Virality</div>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {approved && <Badge tone="success">Approved</Badge>}
        {clip.format && <Badge tone="neutral">{clip.format.replace(/_/g, ' ')}</Badge>}
      </div>

      {clip.caption && (
        <p className="rounded-[8px] bg-bg-subtle px-3 py-2.5 text-[13px] leading-relaxed text-text-muted">{clip.caption}</p>
      )}

      {approved ? (
        <div className="flex items-center justify-between gap-3 rounded-[8px] bg-success-soft px-3 py-2 text-[12.5px] font-semibold text-success-content">
          <span>Approved — ready to produce</span>
          {clip.mediaSourceId && (
            <Link href={`/media/${clip.mediaSourceId}`} className="rounded-[8px] border border-border-default bg-surface px-3 py-1.5 text-text hover:bg-bg-subtle">
              Convert to ticket →
            </Link>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <Button size="sm" disabled={pending} onClick={() => run(approveClip)}>Approve</Button>
          <Button variant="ghost" size="sm" disabled={pending} onClick={() => run(dismissClip)}>Dismiss</Button>
          {pending && <span className="text-xs text-text-subtle">saving…</span>}
          {err && <span className="text-xs text-danger">{err}</span>}
        </div>
      )}
    </article>
  );
}
