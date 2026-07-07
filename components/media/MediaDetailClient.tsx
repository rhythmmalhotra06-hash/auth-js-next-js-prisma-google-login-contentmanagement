'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ClipSuggestion } from '@/lib/media/repository';
import type { IntakeReferenceData } from '@/lib/intake/data';
import { ClipActions } from '@/components/vishen/ClipActions';
import { ClipApprovalModal } from '@/components/media/ClipApprovalModal';
import { CLIP_TYPES, DEFAULT_CLIP_TYPE } from '@/lib/clipping/clip-types';
import { StrategyDetail, parseStrategy } from '@/components/media/StrategyDetail';

// Approve/dismiss + raise the ticket inline. Approving a clip surfaces it in the manager's
// "approved clips" panel; a "Convert to ticket" button here lets editors raise the ticket
// straight from the source page too (same modal + flow as the Manager Queue).
export function MediaDetailClient({
  sourceId,
  status,
  error,
  clips,
  strategyJson = null,
  autostart = false,
  reference,
  sourceUrl = null,
}: {
  sourceId: string;
  status: string | null;
  error: string | null;
  clips: ClipSuggestion[];
  strategyJson?: string | null;
  autostart?: boolean;
  reference: IntakeReferenceData;
  sourceUrl?: string | null;
}) {
  const router = useRouter();
  const [modalClipId, setModalClipId] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [webSearch, setWebSearch] = useState(false);
  const [clipType, setClipType] = useState<string>(DEFAULT_CLIP_TYPE);
  const [pasted, setPasted] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [showStrategy, setShowStrategy] = useState(false);
  const [showRegenerate, setShowRegenerate] = useState(false);
  const [view, setView] = useState<'card' | 'grid'>('card');

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

  // Shared generate/regenerate form — clip type, web-search grounding, optional
  // transcript, and the run button. Reused by the (no-clips) generate card and
  // the (has-clips) collapsible re-run card.
  const controls = (
    <>
      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-xs text-text-muted">
          Clip type
          <select
            value={clipType}
            onChange={(e) => setClipType(e.target.value)}
            disabled={running}
            className="rounded-sm border border-border-default px-2 py-1 text-xs text-text outline-none focus-visible:border-brand"
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

      <p className="mt-2 text-xs text-text-subtle">
        {webSearch
          ? 'On: the AI searches the web for current context on the guest & topic before writing clips — more accurate, ~1 min slower.'
          : 'Off: clips are generated from the transcript alone — faster, and usually enough. Turn on to research the guest & topic on the web first.'}
      </p>

      <div className="mt-4">
        <label className="block text-sm font-medium text-text">
          Transcript{' '}
          <span className="font-normal text-text-muted">
            {hasClips
              ? '— optional. Paste a transcript to re-run from different source text; leave blank to reuse the existing one.'
              : '— recommended. Paste it for instant, reliable clips; leave blank to try auto-fetch.'}
          </span>
        </label>
        <textarea
          value={pasted}
          onChange={(e) => setPasted(e.target.value)}
          rows={6}
          placeholder="Paste the full transcript here…"
          className="mt-1.5 w-full rounded-sm border border-border-default px-3 py-2 text-sm outline-none focus-visible:border-brand focus-visible:shadow-[var(--mv-shadow-focus)]"
        />
      </div>

      {error && status === 'Error' && (
        <div className="mt-3 rounded-sm bg-danger-soft px-3 py-2 text-sm text-danger">{error}</div>
      )}
      {runError && <div className="mt-3 rounded-sm bg-danger-soft px-3 py-2 text-sm text-danger">{runError}</div>}

      <div className="mt-4 flex items-center gap-3">
        <button
          onClick={suggest}
          disabled={running}
          className="rounded-sm bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-bright disabled:opacity-60"
        >
          {running ? 'Generating… (1–3 min)' : hasClips ? 'Re-run clips' : 'Suggest clips'}
        </button>
      </div>
    </>
  );

  return (
    <div className="space-y-6">
      {/* No clips yet → generation is the primary action. */}
      {!hasClips && (
        <div className="rounded-md bg-surface p-5 shadow-sm ring-1 ring-border-default">
          <h2 className="text-sm font-semibold text-text">Generate clip suggestions</h2>
          <p className="mt-1 text-xs text-text-subtle">Turn this episode into short-form clips. Paste the transcript for the most reliable results.</p>
          <div className="mt-4">{controls}</div>
        </div>
      )}

      {/* Clips — approve / dismiss. Approved clips become tickets on the Manager Queue. */}
      {hasClips && (
        <div className="rounded-md bg-surface p-5 shadow-sm ring-1 ring-border-default">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-text">{clips.length} suggested clips</h2>
              <span className="text-xs text-text-subtle">Click a clip to see details · approve it, then raise a ticket right here.</span>
            </div>
            {/* Card / Grid view toggle */}
            <div className="inline-flex rounded-sm border border-border-default p-0.5 text-xs">
              {(['card', 'grid'] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setView(v)}
                  aria-pressed={view === v}
                  className={`rounded-[6px] px-3 py-1 capitalize ${view === v ? 'bg-brand text-white' : 'text-text-muted hover:text-text'}`}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>

          <div className={`mt-4 ${view === 'grid' ? 'grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3' : 'space-y-3'}`}>
            {clips.map((c) => {
              const approved = c.status === 'Approved';
              const dismissed = c.status === 'Dismissed';
              const isOpen = expanded.has(c.id);
              return (
                <div
                  key={c.id}
                  className={`flex flex-col rounded-xl border ${dismissed ? 'border-border-muted opacity-50' : 'border-border-default'}`}
                >
                  {/* Header — click to expand/collapse the clip's full details */}
                  <button
                    type="button"
                    onClick={() => toggleExpanded(c.id)}
                    className="flex w-full items-start gap-2 rounded-xl px-4 py-3 text-left hover:bg-bg-subtle"
                    aria-expanded={isOpen}
                  >
                    <span className={`mt-0.5 text-text-subtle transition-transform ${isOpen ? 'rotate-90' : ''}`}>›</span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        {typeof c.viralityScore === 'number' && (
                          <span className="rounded-full bg-gold/15 px-2 py-0.5 text-xs font-medium text-gold-content">★ {c.viralityScore}</span>
                        )}
                        {approved && <span className="rounded-full bg-success-soft px-2 py-0.5 text-xs text-success-content">Approved</span>}
                        {dismissed && <span className="rounded-full bg-bg-subtle px-2 py-0.5 text-xs text-text-muted">Dismissed</span>}
                        <span className="text-xs text-text-subtle">
                          {c.timestampStart}–{c.timestampEnd}{c.format ? ` · ${c.format}` : ''}
                        </span>
                      </span>
                      <span className="mt-1 block font-medium text-text">{c.hookLine || c.name || `Clip ${c.index ?? ''}`}</span>
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
                      {/* Approved → raise the ticket inline (same modal/flow as the Manager Queue). */}
                      {approved && !c.ticketId && (
                        <div className="mt-3">
                          <button
                            type="button"
                            onClick={() => setModalClipId(c.id)}
                            className="rounded-sm border border-border-default px-3 py-1.5 text-sm font-semibold text-brand hover:bg-bg-subtle"
                          >
                            Convert to ticket →
                          </button>
                        </div>
                      )}
                      {approved && c.ticketId && (
                        <div className="mt-3">
                          <span className="rounded-full bg-success-soft px-2 py-0.5 text-xs text-success-content">Ticket created</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Re-run — secondary once clips exist; collapsed by default. */}
      {hasClips && (
        <div className="rounded-md bg-surface p-5 shadow-sm ring-1 ring-border-default">
          <button
            type="button"
            onClick={() => setShowRegenerate((v) => !v)}
            className="flex w-full items-center gap-2 text-left"
            aria-expanded={showRegenerate}
          >
            <span className={`text-text-subtle transition-transform ${showRegenerate ? 'rotate-90' : ''}`}>›</span>
            <h2 className="text-sm font-semibold text-text">Not quite right? Re-run clips</h2>
            <span className="ml-auto text-xs text-text-subtle">change clip type or settings</span>
          </button>
          {showRegenerate && <div className="mt-4">{controls}</div>}
        </div>
      )}

      {/* Full content strategy — the rest of the generated output (titles, hook,
          thumbnail, pull quotes, show notes, distribution). Collapsed by default. */}
      {strategy && (
        <div className="rounded-md bg-surface p-5 shadow-sm ring-1 ring-border-default">
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

      {modalClipId && (
        <ClipApprovalModal
          clipIds={[modalClipId]}
          sourceUrl={sourceUrl}
          reference={reference}
          onClose={() => setModalClipId(null)}
        />
      )}
    </div>
  );
}
