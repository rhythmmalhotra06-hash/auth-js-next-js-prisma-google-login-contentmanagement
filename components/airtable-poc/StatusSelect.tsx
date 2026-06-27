'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { updateStatus } from '@/app/airtable-poc/actions';
import { TICKET_STATUS_OPTIONS } from '@/lib/repositories/ticket.repository';

export function StatusSelect({ recordId, current }: { recordId: string; current: string | null }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();

  return (
    <span className="inline-flex items-center gap-2">
      <select
        defaultValue={current ?? ''}
        disabled={pending}
        onChange={(e) =>
          start(async () => {
            setErr(null);
            const r = await updateStatus(recordId, e.target.value);
            if (!r.ok) setErr(r.error ?? 'failed');
            router.refresh();
          })
        }
        className="rounded border border-neutral-300 px-2 py-1 text-sm disabled:opacity-60"
      >
        <option value="" disabled>—</option>
        {TICKET_STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>
      {pending && <span className="text-xs text-neutral-400">saving…</span>}
      {err && <span className="text-xs text-red-600">{err}</span>}
    </span>
  );
}
