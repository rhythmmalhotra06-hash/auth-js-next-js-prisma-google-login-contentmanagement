'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { requestApproval, decideApproval } from '@/app/tickets/[id]/actions';

interface ApprovalRow {
  id: string;
  approver: string | null;
  state: string;
  feedback: string | null;
  decidedAt: string | null;
  createdAt: string;
}

const badgeCls = (s: string) =>
  s === 'approved'
    ? 'bg-green-100 text-green-700'
    : s === 'changes_requested'
      ? 'bg-amber-100 text-amber-700'
      : 'bg-neutral-100 text-neutral-600';

export function ApprovalPanel({
  ticketId,
  approvals,
  employees,
}: {
  ticketId: string;
  approvals: ApprovalRow[];
  employees: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [approverId, setApproverId] = useState('');
  const [feedback, setFeedback] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<string | null>(null);

  function request() {
    setMsg(null);
    start(async () => {
      const r = await requestApproval(ticketId, approverId);
      if (r.ok) { setApproverId(''); router.refresh(); } else setMsg(r.error ?? 'Failed');
    });
  }

  function decide(id: string, decision: 'approved' | 'changes_requested') {
    setMsg(null);
    start(async () => {
      const r = await decideApproval(id, decision, feedback[id] ?? '');
      if (r.ok) router.refresh(); else setMsg(r.error ?? 'Failed');
    });
  }

  return (
    <div className="mt-6 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-neutral-200">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Approvals</h2>
      <p className="mt-1 text-xs text-neutral-400">An approved approval is required before a ticket can move to “Shipping” (decision lock).</p>

      {approvals.length === 0 ? (
        <p className="mt-4 text-sm text-neutral-400">No approvals requested yet.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {approvals.map((a) => (
            <li key={a.id} className="rounded-lg border border-neutral-200 p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-neutral-900">{a.approver ?? 'Approver'}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badgeCls(a.state)}`}>{a.state.replace('_', ' ')}</span>
              </div>
              {a.feedback && <p className="mt-1 text-xs italic text-neutral-500">“{a.feedback}”</p>}
              {a.state === 'pending' && (
                <div className="mt-3 space-y-2">
                  <textarea
                    rows={2}
                    placeholder="Feedback (optional)"
                    value={feedback[a.id] ?? ''}
                    onChange={(e) => setFeedback((f) => ({ ...f, [a.id]: e.target.value }))}
                    className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-[#572280] focus:ring-2 focus:ring-[#572280]/20"
                  />
                  <div className="flex gap-2">
                    <button onClick={() => decide(a.id, 'approved')} disabled={pending} className="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60">Approve</button>
                    <button onClick={() => decide(a.id, 'changes_requested')} disabled={pending} className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-700 disabled:opacity-60">Request changes</button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 flex items-center gap-2 border-t border-neutral-100 pt-4">
        <select
          value={approverId}
          onChange={(e) => setApproverId(e.target.value)}
          className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm outline-none focus:border-[#572280] focus:ring-2 focus:ring-[#572280]/20"
        >
          <option value="">Select approver…</option>
          {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
        <button onClick={request} disabled={pending || !approverId} className="rounded-lg px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50" style={{ backgroundColor: '#572280' }}>
          Request approval
        </button>
      </div>
      {msg && <p className="mt-2 text-xs text-red-600">{msg}</p>}
    </div>
  );
}
