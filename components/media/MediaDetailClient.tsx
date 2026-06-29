'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ClipSuggestion } from '@/lib/media/repository';
import { ClipActions } from '@/components/vishen/ClipActions';
import { CLIP_TYPES, DEFAULT_CLIP_TYPE } from '@/lib/clipping/clip-types';
import { StrategyDetail, parseStrategy } from '@/components/media/StrategyDetail';

function StatusBadge({ status }: { status: string | null }) {
  const map: Record<string, string> = {
    'New': 'bg-bg-subtle text-text-muted',
    'Transcribing': 'bg-amber-50 text-amber-700',
    'Clips Suggested': 'bg-green-50 text-success-content',
    'Error': 'bg-red-50 text-danger',
  };
  return <span className={`rounded-full px-2 py-0.5 text-xs ${map[status ?? ''] ?? 'bg-bg-subtle text-text-muted'}`}>{status ?? 'New'}</span>;
}

// Approve/dismiss only — ticket creation happens on the Manager Queue. Approving a
// clip surfaces it in the manager's "approved clips" panel there.
export function MediaDetailClient({
  sourceId,
  status,
  error,
  clips,
  strategyJson = null,
  autostart = false,
}: {
  sourceId: string;
  status: string | null;
  error: string | null;
  clips: ClipSuggestion[];
  strategyJson?: string | null;
  autostart?: boolean;
}) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [webSearch, setWebSearch] = useState(false);
  const [clipType, setClipType] = useState<string>(DEFAULT_CLIP_TYPE);
  const [pasted, setPasted] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [showStrategy, setShowStrategy] = useState(false);

  const hasClips = clips.length > 0;
  const strategy = parseStrategy(strategyJson);

  const toggleExpanded = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  async function suggest() {
    setRunError(null);
    setRunning(true);
    try {
      const res = await fetch(`/api/media/${sourceId}/suggest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ webSearch, clipType, transcript: pasted.trim() || undefined }),
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

  // Auto-kick generation when arriving with ?autostart=1 (one click from the Clips
  // page). Fires once; strip the param so a manual reload won't re-generate.
  const autoFired = useRef(false);
  useEffect(() => {
    if (autostart && !autoFired.current && !hasClips && !running && status !== 'Transcribing') {
      autoFired.current = true;
      router.replace(`/media/${sourceId}`);
      suggest();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-6">
      {/* Run panel */}
      <div className="rounded-[12px] bg-surface p-5 shadow-sm ring-1 ring-border-default">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <StatusBadge status={status} />
            {status === 'Clips Suggested' && <span className="text-sm text-text-muted">{clips.length} clips suggested</span>}
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-xs text-text-muted">
              Clip type
              <select
                value={clipType}
                onChange={(e) => setClipType(e.target.value)}
                disabled={running}
                className="rounded-[8px] border border-border-default px-2 py-1 text-xs text-text outline-none focus-visible:border-brand"
              >
                {CLIP_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </label>
            <label
              className="flex items-center gap-2 text-xs text-text-muted"
              title="When on, the AI first searches the web for current context about the guest and topic, then writes clips grounded in what it finds. More accurate and up-to-date, but adds about a minute. When off, clips are generated from the transcript alone — faster, and usually enough."
            >
              <input type="checkbox" checked={webSearch} onChange={(e) => setWebSearch(e.target.checked)} />
              Research topic on the web first
            </label>
          </div>
        </div>

        <p className="mt-2 text-xs text-text-subtle">
          {webSearch
            ? 'On: the AI searches the web for current context on the guest & topic before writing clips — more accurate, ~1 min slower.'
            : 'Off: clips are generated from the transcript alone — faster, and usually enough. Turn on to research the guest & topic on the web first.'}
        </p>

        {error && status === 'Error' && (
          <div className="mt-3 rounded-[8px] bg-red-50 px-3 py-2 text-sm text-danger">{error}</div>
        )}
        {runError && <div className="mt-3 rounded-[8px] bg-red-50 px-3 py-2 text-sm text-danger">{runError}</div>}

        {!hasClips && (
          <div className="mt-4">
            <label className="block text-sm font-medium text-text">
              Transcript <span className="font-normal text-text-muted">— recommended. Paste it for instant, reliable clips; leave blank to try auto-fetch.</span>
            </label>
            <textarea
              value={pasted}
              onChange={(e) => setPasted(e.target.value)}
              rows={6}
              placeholder="Paste the full transcript here…"
              className="mt-1.5 w-full rounded-[8px] border border-border-default px-3 py-2 text-sm outline-none focus-visible:border-brand focus-visible:shadow-[var(--mv-shadow-focus)]"
            />
          </div>
        )}

        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={suggest}
            disabled={running}
            className="rounded-[8px] bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-bright disabled:opacity-60"
          >
            {running ? 'Generating… (1–3 min)' : hasClips ? 'Re-run clips' : 'Suggest clips'}
          </button>
        </div>
      </div>

      {/* Clips — approve / dismiss. Approved clips become tickets on the Manager Queue. */}
      {hasClips && (
        <div className="rounded-[12px] bg-surface p-5 shadow-sm ring-1 ring-border-default">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-text">Suggested Reels clips</h2>
            <span className="text-xs text-text-subtle">Approve a clip → it appears in the Manager queue to convert into a ticket.</span>
          </div>

          <ul className="mt-4 space-y-3">
            {clips.map((c) => {
              const approved = c.status === 'Approved';
              const dismissed = c.status === 'Dismissed';
              const isOpen = expanded.has(c.id);
              return (
                <li key={c.id} className={`rounded-xl border ${dismissed ? 'border-border-muted opacity-50' : 'border-border-default'}`}>
                  {/* Header — click to expand/collapse the clip's full details */}
                  <button
                    type="button"
                    onClick={() => toggleExpanded(c.id)}
                    className="flex w-full items-center gap-2 rounded-xl px-4 py-3 text-left hover:bg-bg-subtle"
                    aria-expanded={isOpen}
                  >
                    <span className={`text-text-subtle transition-transform ${isOpen ? 'rotate-90' : ''}`}>›</span>
                    <span className="font-medium text-text">{c.hookLine || c.name || `Clip ${c.index ?? ''}`}</span>
                    {typeof c.viralityScore === 'number' && (
                      <span className="rounded-full bg-[#F5B000]/15 px-2 py-0.5 text-xs font-medium text-[#8a6500]">★ {c.viralityScore}</span>
                    )}
                    {approved && <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs text-success-content">Approved</span>}
                    {dismissed && <span className="rounded-full bg-bg-subtle px-2 py-0.5 text-xs text-text-muted">Dismissed</span>}
                    <span className="ml-auto text-xs text-text-subtle">
                      {c.timestampStart}–{c.timestampEnd}{c.format ? ` · ${c.format}` : ''}
                    </span>
                  </button>

                  {/* Body — revealed on click */}
                  {isOpen && (
                    <div className="border-t border-border-muted px-4 py-3">
                      {c.rationale && (
                        <p className="text-sm text-text-muted"><span className="font-medium text-text">Why this clip: </span>{c.rationale}</p>
                      )}
                      {c.caption && (
                        <p className="mt-2 text-sm italic text-text-muted"><span className="font-medium not-italic text-text">Caption: </span>“{c.caption}”</p>
                      )}
                      {!c.rationale && !c.caption && <p className="text-sm text-text-subtle">No additional details.</p>}
                      {!approved && !dismissed && (
                        <div className="mt-3"><ClipActions clipId={c.id} /></div>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Full content strategy — the rest of the generated output (titles, hook,
          thumbnail, pull quotes, show notes, distribution). Collapsed by default. */}
      {strategy && (
        <div className="rounded-[12px] bg-surface p-5 shadow-sm ring-1 ring-border-default">
          <button
            type="button"
            onClick={() => setShowStrategy((v) => !v)}
            className="flex w-full items-center gap-2 text-left"
            aria-expanded={showStrategy}
          >
            <span className={`text-text-subtle transition-transform ${showStrategy ? 'rotate-90' : ''}`}>›</span>
            <h2 className="text-sm font-semibold text-text">Full content strategy</h2>
            <span className="ml-auto text-xs text-text-subtle">titles · hook · thumbnail · pull quotes · show notes · distribution</span>
          </button>
          {showStrategy && (
            <div className="mt-4">
              <StrategyDetail strategy={strategy} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
