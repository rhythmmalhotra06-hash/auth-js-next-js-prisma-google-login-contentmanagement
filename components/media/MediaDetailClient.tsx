'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { IntakeReferenceData } from '@/lib/intake/data';
import type { ClipSuggestion } from '@/lib/media/repository';
import { dismissClip } from '@/app/media/actions';
import { ClipApprovalModal } from '@/components/media/ClipApprovalModal';

const purple = '#572280';

function StatusBadge({ status }: { status: string | null }) {
  const map: Record<string, string> = {
    'New': 'bg-neutral-100 text-neutral-600',
    'Transcribing': 'bg-amber-50 text-amber-700',
    'Clips Suggested': 'bg-green-50 text-green-700',
    'Error': 'bg-red-50 text-red-700',
  };
  return <span className={`rounded-full px-2 py-0.5 text-xs ${map[status ?? ''] ?? 'bg-neutral-100 text-neutral-600'}`}>{status ?? 'New'}</span>;
}

export function MediaDetailClient({
  sourceId,
  sourceUrl,
  status,
  error,
  clips,
  reference,
}: {
  sourceId: string;
  sourceUrl: string | null;
  status: string | null;
  error: string | null;
  clips: ClipSuggestion[];
  reference: IntakeReferenceData;
}) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [webSearch, setWebSearch] = useState(false);
  const [showPaste, setShowPaste] = useState(false);
  const [pasted, setPasted] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [modalOpen, setModalOpen] = useState(false);

  const hasClips = clips.length > 0;
  const selectable = clips.filter((c) => c.status !== 'Approved');

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function suggest() {
    setRunError(null);
    setRunning(true);
    try {
      const res = await fetch(`/api/media/${sourceId}/suggest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ webSearch, transcript: pasted.trim() || undefined }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string; clips?: number };
      if (!data.ok) setRunError(data.error ?? 'Generation failed.');
      router.refresh();
    } catch (e) {
      setRunError(e instanceof Error ? e.message : 'Request failed.');
    } finally {
      setRunning(false);
    }
  }

  async function onDismiss(id: string) {
    await dismissClip(id);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {/* Run panel */}
      <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-neutral-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <StatusBadge status={status} />
            {status === 'Clips Suggested' && <span className="text-sm text-neutral-500">{clips.length} clips suggested</span>}
          </div>
          <label className="flex items-center gap-2 text-xs text-neutral-500">
            <input type="checkbox" checked={webSearch} onChange={(e) => setWebSearch(e.target.checked)} />
            Web-search grounding (slower)
          </label>
        </div>

        {error && status === 'Error' && (
          <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
        )}
        {runError && <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{runError}</div>}

        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={suggest}
            disabled={running}
            className="rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            style={{ backgroundColor: purple }}
          >
            {running ? 'Generating… (1–3 min)' : hasClips ? 'Re-run clips' : 'Suggest clips'}
          </button>
          <button onClick={() => setShowPaste((v) => !v)} className="text-sm text-neutral-500 hover:text-[#572280]">
            {showPaste ? 'Hide paste fallback' : 'Paste transcript (if auto-fetch fails)'}
          </button>
        </div>

        {showPaste && (
          <textarea
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
            rows={6}
            placeholder="Paste the transcript here if YouTube auto-fetch is blocked…"
            className="mt-3 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-[#572280] focus:ring-2 focus:ring-[#572280]/20"
          />
        )}
      </div>

      {/* Clips */}
      {hasClips && (
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-neutral-200">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-neutral-900">Suggested Reels clips</h2>
            <button
              onClick={() => setModalOpen(true)}
              disabled={selected.size === 0}
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
              style={{ backgroundColor: purple }}
            >
              Convert {selected.size || ''} to ticket{selected.size === 1 ? '' : 's'}
            </button>
          </div>

          <ul className="mt-4 space-y-3">
            {clips.map((c) => {
              const approved = c.status === 'Approved';
              const dismissed = c.status === 'Dismissed';
              return (
                <li key={c.id} className={`rounded-xl border p-4 ${dismissed ? 'border-neutral-100 opacity-50' : 'border-neutral-200'}`}>
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={selected.has(c.id)}
                      disabled={approved || dismissed}
                      onChange={() => toggle(c.id)}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-neutral-900">{c.hookLine || c.name || `Clip ${c.index ?? ''}`}</span>
                        {typeof c.viralityScore === 'number' && (
                          <span className="rounded-full bg-[#F5B000]/15 px-2 py-0.5 text-xs font-medium text-[#8a6500]">★ {c.viralityScore}</span>
                        )}
                        {approved && <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs text-green-700">Ticket created</span>}
                        {dismissed && <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-500">Dismissed</span>}
                      </div>
                      <div className="mt-1 text-xs text-neutral-400">
                        {c.timestampStart}–{c.timestampEnd}{c.format ? ` · ${c.format}` : ''}
                      </div>
                      {c.rationale && <p className="mt-2 text-sm text-neutral-600">{c.rationale}</p>}
                      {c.caption && <p className="mt-2 text-sm italic text-neutral-500">“{c.caption}”</p>}
                      {!approved && !dismissed && (
                        <button onClick={() => onDismiss(c.id)} className="mt-2 text-xs text-neutral-400 hover:text-red-600">
                          Dismiss
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {modalOpen && (
        <ClipApprovalModal
          clipIds={[...selected].filter((id) => selectable.some((c) => c.id === id))}
          sourceUrl={sourceUrl}
          reference={reference}
          onClose={() => { setModalOpen(false); setSelected(new Set()); }}
        />
      )}
    </div>
  );
}
