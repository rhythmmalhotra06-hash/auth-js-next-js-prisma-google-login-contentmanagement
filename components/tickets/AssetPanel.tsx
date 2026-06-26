'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { addAsset, removeAsset } from '@/app/tickets/[id]/actions';
import { ASSET_KINDS } from '@/lib/tickets/constants';

interface AssetRow {
  id: string;
  kind: string;
  fileUrl: string | null;
  distributionUrl: string | null;
  publishedAt: string | null;
  createdAt: string;
}

export function AssetPanel({ ticketId, assets }: { ticketId: string; assets: AssetRow[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [kind, setKind] = useState<'raw' | 'final'>('final');
  const [fileUrl, setFileUrl] = useState('');
  const [distributionUrl, setDistributionUrl] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  function add() {
    setMsg(null);
    start(async () => {
      const r = await addAsset(ticketId, kind, fileUrl, distributionUrl);
      if (r.ok) { setFileUrl(''); setDistributionUrl(''); router.refresh(); } else setMsg(r.error ?? 'Failed');
    });
  }
  function remove(id: string) {
    start(async () => { await removeAsset(id); router.refresh(); });
  }

  const groups: { label: string; kind: string }[] = [
    { label: 'Raw', kind: 'raw' },
    { label: 'Final', kind: 'final' },
  ];

  return (
    <div className="mt-6 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-neutral-200">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Assets</h2>
      <p className="mt-1 text-xs text-neutral-400">Raw and final versions stack under the ticket. A distribution link marks a final as published.</p>

      <div className="mt-4 space-y-4">
        {groups.map((g) => {
          const items = assets.filter((a) => a.kind === g.kind);
          return (
            <div key={g.kind}>
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">{g.label}</p>
              {items.length === 0 ? (
                <p className="mt-1 text-sm text-neutral-400">None</p>
              ) : (
                <ul className="mt-1 space-y-1.5">
                  {items.map((a) => (
                    <li key={a.id} className="flex items-center justify-between rounded-lg border border-neutral-200 px-3 py-2 text-sm">
                      <div className="min-w-0">
                        <a href={a.fileUrl ?? '#'} target="_blank" rel="noreferrer" className="truncate text-[#572280] hover:underline">{a.fileUrl}</a>
                        {a.distributionUrl && (
                          <a href={a.distributionUrl} target="_blank" rel="noreferrer" className="ml-3 text-xs text-neutral-500 hover:underline">↗ distribution</a>
                        )}
                        {a.publishedAt && <span className="ml-2 text-xs text-green-600">published</span>}
                      </div>
                      <button onClick={() => remove(a.id)} disabled={pending} className="ml-3 shrink-0 text-xs text-neutral-400 hover:text-red-600">remove</button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-4 grid gap-2 border-t border-neutral-100 pt-4 sm:grid-cols-[auto_1fr_1fr_auto] sm:items-center">
        <select value={kind} onChange={(e) => setKind(e.target.value as 'raw' | 'final')} className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm">
          {ASSET_KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
        </select>
        <input value={fileUrl} onChange={(e) => setFileUrl(e.target.value)} placeholder="File URL (Dropbox/storage)" className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm outline-none focus:border-[#572280] focus:ring-2 focus:ring-[#572280]/20" />
        <input value={distributionUrl} onChange={(e) => setDistributionUrl(e.target.value)} placeholder="Distribution URL (optional)" className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm outline-none focus:border-[#572280] focus:ring-2 focus:ring-[#572280]/20" />
        <button onClick={add} disabled={pending || !fileUrl.trim()} className="rounded-lg px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50" style={{ backgroundColor: '#572280' }}>Add</button>
      </div>
      {msg && <p className="mt-2 text-xs text-red-600">{msg}</p>}
    </div>
  );
}
