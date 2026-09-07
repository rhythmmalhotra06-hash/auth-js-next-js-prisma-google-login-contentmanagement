'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { updateTicketStatus } from '@/app/tickets/[id]/actions';
import { TICKET_STATUSES } from '@/lib/tickets/constants';

export function StatusUpdater({ ticketId, current }: { ticketId: string; current: string | null }) {
  const [value, setValue] = useState(current ?? '');
  const [msg, setMsg] = useState<string | null>(null);
  const [blockedFor, setBlockedFor] = useState<{ status: string; reason: string } | null>(null);
  const [overrideNote, setOverrideNote] = useState('');
  const [pending, start] = useTransition();
  const router = useRouter();

  function attempt(next: string, note?: string) {
    const prev = value;
    setValue(next);
    setMsg(null);
    start(async () => {
      const res = await updateTicketStatus(ticketId, next, note);
      if (res.ok) {
        setMsg('Saved');
        setBlockedFor(null);
        setOverrideNote('');
        router.refresh();
      } else if (res.blocked) {
        setValue(prev);
        setBlockedFor({ status: next, reason: res.error ?? 'Blocked by DNA review' });
      } else {
        setValue(prev);
        setMsg(res.error ?? 'Failed');
      }
    });
  }

  return (
    <div>
      <div className="flex items-center gap-2">
        <select
          value={value}
          disabled={pending}
          onChange={(e) => attempt(e.target.value)}
          className="rounded-sm border border-border-default px-3 py-1.5 text-sm text-text outline-none focus-visible:border-brand focus-visible:shadow-[var(--mv-shadow-focus)] disabled:opacity-60"
        >
          {TICKET_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        {pending && <span className="text-xs text-text-subtle">saving…</span>}
        {!pending && msg && <span className="text-xs text-success-content">{msg}</span>}
      </div>

      {blockedFor && (
        <div className="card pad" style={{ marginTop: 8 }}>
          <p className="text-xs" style={{ color: 'var(--danger-content)', marginBottom: 6 }}>{blockedFor.reason}</p>
          <textarea
            className="w-full rounded-sm border border-border-default px-2 py-1.5 text-sm"
            rows={2}
            placeholder="Note explaining why you're approving anyway (required)"
            value={overrideNote}
            onChange={(e) => setOverrideNote(e.target.value)}
          />
          <div className="flex items-center gap-2" style={{ marginTop: 6 }}>
            <button className="btn sm" disabled={pending || !overrideNote.trim()} onClick={() => attempt(blockedFor.status, overrideNote)}>
              Approve anyway
            </button>
            <button className="btn ghost sm" disabled={pending} onClick={() => { setBlockedFor(null); setOverrideNote(''); }}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
