'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { assignTicket } from '@/app/tickets/[id]/actions';

export function AssigneeUpdater({
  ticketId,
  current,
  currentName,
  employees,
}: {
  ticketId: string;
  current: string | null;
  /** Label for the current assignee when they're no longer on the roster at all. */
  currentName?: string | null;
  employees: { id: string; name: string; exTeam?: boolean }[];
}) {
  const [value, setValue] = useState(current ?? '');
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  // Ex-team members go in their own group, never mixed into the default choices: a ticket
  // often has to stay credited to whoever actually did the work after they've left.
  const roster = employees.filter((e) => !e.exTeam);
  const exTeam = employees.filter((e) => e.exTeam);
  // A `value` with no matching <option> makes the select silently show the first entry —
  // i.e. an assignee who has left would read as "Unassigned". Keep them selectable.
  const orphan = current && !employees.some((e) => e.id === current) ? current : null;

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
        className="rounded-sm border border-border-default px-3 py-1.5 text-sm text-text outline-none focus-visible:border-brand focus-visible:shadow-[var(--mv-shadow-focus)] disabled:opacity-60"
      >
        <option value="">Unassigned</option>
        {orphan && <option value={orphan}>{currentName ?? 'Currently assigned'} (off roster)</option>}
        {roster.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
        {exTeam.length > 0 && (
          <optgroup label="Ex-team">
            {exTeam.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </optgroup>
        )}
      </select>
      {pending && <span className="text-xs text-text-subtle">saving…</span>}
      {!pending && msg && <span className="text-xs text-success-content">{msg}</span>}
    </div>
  );
}
