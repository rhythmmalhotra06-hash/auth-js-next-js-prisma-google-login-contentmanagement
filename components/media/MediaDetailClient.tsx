'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ClipSuggestion } from '@/lib/media/repository';
import type { IntakeReferenceData } from '@/lib/intake/data';
import { Badge } from '@/components/ui/Badge';
import { Icon } from '@/components/ui/Icon';
import { ClipActions } from '@/components/vishen/ClipActions';
import { ClipApprovalModal } from '@/components/media/ClipApprovalModal';
import { CLIP_TYPES, DEFAULT_CLIP_TYPE, RULE_SCOPE_ALL, RULE_SCOPES } from '@/lib/clipping/clip-types';
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
  const [feedback, setFeedback] = useState('');
  const [remember, setRemember] = useState(false);
  const [rememberScope, setRememberScope] = useState<string>(clipType);
  const [learnNote, setLearnNote] = useState<string | null>(null);
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
    setLearnNote(null);
    setRunning(true);
    try {
      const res = await fetch(`/api/media/${sourceId}/suggest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          webSearch,
          clipType,
          transcript: pasted.trim() || undefined,
          feedback: feedback.trim() || undefined,
          remember: remember && !!feedback.trim(),
          rememberScope,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        clips?: number;
        learning?: { saved?: boolean; rule?: string; skipped?: boolean; error?: string };
      };
      if (!data.ok) setRunError(data.error ?? 'Generation failed.');
      if (data.learning?.saved && data.learning.rule) {
        setLearnNote(`Saved as a learning: “${data.learning.rule}” — manage it in Settings → Clip Rules.`);
      } else if (data.learning?.skipped) {
        setLearnNote('Feedback applied to this run; nothing general enough to remember.');
      } else if (data.learning?.error) {
        setLearnNote(`Feedback applied, but the learning couldn’t be saved: ${data.learning.error}`);
      }
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
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label>Clip type</label>
          <select value={clipType} onChange={(e) => setClipType(e.target.value)} disabled={running}>
            {CLIP_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        <label
          className="mb-0 flex items-center gap-2 self-end text-sm text-text-muted"
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
        <label>
          Transcript{' '}
          <span className="font-normal text-text-subtle">
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
        />
      </div>

      {/* Feedback — the primary "steer it" lever on a re-run. */}
      <div className="mt-4">
        <label>
          Feedback{' '}
          <span className="font-normal text-text-subtle">
            — tell the AI what to change this time (e.g. “clips ran too long”, “too salesy — lead with the insight”).
          </span>
        </label>
        <textarea
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          rows={3}
          placeholder="What should be different about this run?"
          disabled={running}
        />
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
          <label className="mb-0 flex items-center gap-2 text-sm text-text-muted" title="When on, this feedback is distilled into a durable rule and applied to every future clip generation, not just this run.">
            <input
              type="checkbox"
              className="h-4 w-4 accent-brand"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              disabled={running || !feedback.trim()}
            />
            Remember this as a learning
          </label>
          {remember && (
            <label className="mb-0 flex items-center gap-2 text-sm text-text-subtle">
              applies to
              <select value={rememberScope} onChange={(e) => setRememberScope(e.target.value)} disabled={running} className="w-auto">
                {RULE_SCOPES.map((s) => (
                  <option key={s} value={s}>{s === RULE_SCOPE_ALL ? 'All clip types' : s}</option>
                ))}
              </select>
            </label>
          )}
        </div>
      </div>

      {learnNote && (
        <div className="mt-3 rounded-sm bg-brand-soft px-3 py-2 text-sm text-text">{learnNote}</div>
      )}

      {error && status === 'Error' && (
        <div className="mt-3 rounded-sm bg-danger-soft px-3 py-2 text-sm text-danger-content">{error}</div>
      )}
      {runError && <div className="mt-3 rounded-sm bg-danger-soft px-3 py-2 text-sm text-danger-content">{runError}</div>}

      <div className="mt-4 flex items-center gap-3">
        <button onClick={suggest} disabled={running} className="btn primary">
          {running ? 'Generating… (1–3 min)' : hasClips ? 'Re-run clips' : 'Suggest clips'}
        </button>
      </div>
    </>
  );

  return (
    <div className="stack">
      {/* No clips yet → generation is the primary action. */}
      {!hasClips && (
        <div className="card pad">
          <div className="mb-1 flex items-baseline gap-2">
            <h3 className="text-sm font-semibold">Generate clip suggestions</h3>
          </div>
          <p className="mb-4 text-xs text-text-subtle">Turn this episode into short-form clips. Paste the transcript for the most reliable results.</p>
          {controls}
        </div>
      )}

      {/* Clips — approve / dismiss. Approved clips become tickets on the Manager Queue. */}
      {hasClips && (
        <div className="card pad">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold">{clips.length} suggested clips</h3>
              <span className="hint">Click a clip to see details · approve it, then raise a ticket right here.</span>
            </div>
            {/* Card / Grid view toggle */}
            <div className="segmented">
              {(['card', 'grid'] as const).map((v) => (
                <button key={v} type="button" onClick={() => setView(v)} aria-pressed={view === v} className={`capitalize ${view === v ? 'on' : ''}`}>
                  {v}
                </button>
              ))}
            </div>
          </div>

          <div className={`mt-4 ${view === 'grid' ? 'clipgrid' : 'stack'}`}>
            {clips.map((c) => {
              const approved = c.status === 'Approved';
              const dismissed = c.status === 'Dismissed';
              const isOpen = expanded.has(c.id);
              return (
                <div key={c.id} className={`card ${dismissed ? 'opacity-50' : ''}`}>
                  {/* Header — click to expand/collapse the clip's full details */}
                  <button
                    type="button"
                    onClick={() => toggleExpanded(c.id)}
                    className="flex w-full items-start gap-2 rounded-md px-4 py-3 text-left hover:bg-bg-subtle"
                    aria-expanded={isOpen}
                  >
                    <Icon name="chevron" size={16} className={`mt-0.5 shrink-0 text-text-subtle transition-transform ${isOpen ? '' : '-rotate-90'}`} />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        {typeof c.viralityScore === 'number' && (
                          <span className="badge b-gold">★ {c.viralityScore}</span>
                        )}
                        {approved && <Badge tone="success">Approved</Badge>}
                        {dismissed && <Badge tone="neutral">Dismissed</Badge>}
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
                          <button type="button" onClick={() => setModalClipId(c.id)} className="btn sm">
                            Convert to ticket <Icon name="arrow" size={14} />
                          </button>
                        </div>
                      )}
                      {approved && c.ticketId && (
                        <div className="mt-3"><Badge tone="success">Ticket created</Badge></div>
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
        <div className="card pad">
          <button type="button" onClick={() => setShowRegenerate((v) => !v)} className="flex w-full items-center gap-2 text-left" aria-expanded={showRegenerate}>
            <Icon name="chevron" size={16} className={`shrink-0 text-text-subtle transition-transform ${showRegenerate ? '' : '-rotate-90'}`} />
            <h3 className="text-sm font-semibold">Not quite right? Re-run clips</h3>
            <span className="hint ml-auto">add feedback · change clip type or settings</span>
          </button>
          {showRegenerate && <div className="mt-4">{controls}</div>}
        </div>
      )}

      {/* Full content strategy — the rest of the generated output (titles, hook,
          thumbnail, pull quotes, show notes, distribution). Collapsed by default. */}
      {strategy && (
        <div className="card pad">
          <button type="button" onClick={() => setShowStrategy((v) => !v)} className="flex w-full items-center gap-2 text-left" aria-expanded={showStrategy}>
            <Icon name="chevron" size={16} className={`shrink-0 text-text-subtle transition-transform ${showStrategy ? '' : '-rotate-90'}`} />
            <h3 className="text-sm font-semibold">Full content strategy</h3>
            <span className="hint ml-auto">titles · hook · thumbnail · pull quotes · show notes · distribution</span>
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
