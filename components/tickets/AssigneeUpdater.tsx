'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { assignTicket } from '@/app/tickets/[id]/actions';

export function AssigneeUpdater({
  ticketId,
  current,
  employees,
}: {
  ticketId: string;
  current: string | null;
  employees: { id: string; name: string }[];
}) {
  const [value, setValue] = useState(current ?? '');
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  function onChange(next: string) {
    const prev = value;
    setValue(next);
    setMsg(null);
    start(async () => {
      const res = await assignTicket(ticketId, next);
      if (res.ok) { setMsg('Saved'); router.refresh(); }
      else { setValue(prev); setMsg(res.error ?? 'Failed'); }
    });
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={value}
        disabled={pending}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-[8px] border border-border-default px-3 py-1.5 text-sm text-text outline-none focus-visible:border-brand focus-visible:shadow-[var(--mv-shadow-focus)] disabled:opacity-60"
      >
        <option value="">Unassigned</option>
        {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
      </select>
      {pending && <span className="text-xs text-text-subtle">saving…</span>}
      {!pending && msg && <span className="text-xs text-success-content">{msg}</span>}
    </div>
  );
}
