'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { updateTicketStatus } from '@/app/tickets/[id]/actions';
import { TICKET_STATUSES } from '@/lib/tickets/constants';

export function StatusUpdater({ ticketId, current }: { ticketId: string; current: string | null }) {
  const [value, setValue] = useState(current ?? '');
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  function onChange(next: string) {
    const prev = value;
    setValue(next);
    setMsg(null);
    start(async () => {
      const res = await updateTicketStatus(ticketId, next);
      if (res.ok) {
        setMsg('Saved');
        router.refresh();
      } else {
        setValue(prev);
        setMsg(res.error ?? 'Failed');
      }
    });
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={value}
        disabled={pending}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm text-neutral-900 outline-none focus:border-[#572280] focus:ring-2 focus:ring-[#572280]/20 disabled:opacity-60"
      >
        {TICKET_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>
      {pending && <span className="text-xs text-neutral-400">saving…</span>}
      {!pending && msg && <span className="text-xs text-green-600">{msg}</span>}
    </div>
  );
}
