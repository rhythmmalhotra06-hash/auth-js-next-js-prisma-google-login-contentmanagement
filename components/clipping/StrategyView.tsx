'use client';

import { useState } from 'react';
import type { Strategy } from '@/lib/clipping/schema';
import type { IntakeReferenceData } from '@/lib/intake/data';
import { ClipApprovalModal } from '@/components/clipping/ClipApprovalModal';

export interface ClipRow {
  id: string;
  index: number;
  title: string;
  timestampStart: string | null;
  timestampEnd: string | null;
  rationale: string | null;
  caption: string | null;
  hookLine: string | null;
  format: string | null;
  viralityScore: number | null;
  status: string;
  ticket: { id: string; title: string; prioStatus: string | null } | null;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-neutral-200">
      <h2 className="text-lg font-semibold text-neutral-900">{title}</h2>
      <div className="mt-4 space-y-3 text-sm text-neutral-700">{children}</div>
    </section>
  );
}

function scoreColor(n: number): string {
  if (n >= 8) return 'bg-green-100 text-green-800';
  if (n >= 6) return 'bg-amber-100 text-amber-800';
  return 'bg-neutral-100 text-neutral-600';
}

export function StrategyView({
  strategyId,
  output,
  clips,
  reference,
}: {
  strategyId: string;
  output: Strategy;
  clips: ClipRow[];
  reference: IntakeReferenceData;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [modalOpen, setModalOpen] = useState(false);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const selectedClips = clips.filter((c) => selected.has(c.id));

  return (
    <div className="space-y-6">
      {/* 4 · Instagram Reels clips — the interactive, ticket-convertible section */}
      <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-neutral-200">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-neutral-900">Instagram Reels clips</h2>
          <button
            type="button"
            disabled={selected.size === 0}
            onClick={() => setModalOpen(true)}
            className="rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            style={{ backgroundColor: '#572280' }}
          >
            Create tickets ({selected.size})
          </button>
        </div>
        <div className="mt-4 space-y-3">
          {clips.map((c) => {
            const done = c.status === 'approved' && c.ticket;
            return (
              <div key={c.id} className={`rounded-xl border p-4 ${selected.has(c.id) ? 'border-[#572280] bg-[#572280]/5' : 'border-neutral-200'}`}>
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 accent-[#572280] disabled:opacity-40"
                    checked={selected.has(c.id)}
                    disabled={!!done}
                    onChange={() => toggle(c.id)}
                  />
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {c.viralityScore != null && (
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${scoreColor(c.viralityScore)}`}>★ {c.viralityScore}/10</span>
                      )}
                      <span className="text-xs text-neutral-400">{c.timestampStart}–{c.timestampEnd}</span>
                      {c.format && <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600">{c.format.replace(/_/g, ' ')}</span>}
                      {done && (
                        <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-800">✓ ticket created</span>
                      )}
                    </div>
                    <p className="mt-1.5 font-medium text-neutral-900">{c.hookLine || c.title}</p>
                    {c.rationale && <p className="mt-1 text-sm text-neutral-600">{c.rationale}</p>}
                    {c.caption && <p className="mt-1 text-xs italic text-neutral-500">Caption: {c.caption}</p>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 1 · Episode titles */}
      <Section title="Episode titles & descriptions">
        <div className="space-y-2">
          {output.episodeTitles?.map((t, i) => (
            <div key={i} className="rounded-lg bg-neutral-50 p-3">
              <span className="rounded bg-[#572280]/10 px-1.5 py-0.5 text-xs text-[#572280] capitalize">{t.format}</span>
              <p className="mt-1 font-medium text-neutral-900">{t.title}</p>
              <p className="text-xs text-neutral-500">{t.description}</p>
            </div>
          ))}
        </div>
        <p className="pt-2"><span className="font-medium">Short description:</span> {output.episodeDescriptionShort}</p>
        <p><span className="font-medium">Full description:</span> {output.episodeDescriptionLong}</p>
        {output.youtubeTags?.length > 0 && (
          <p className="flex flex-wrap gap-1 pt-1">
            {output.youtubeTags.map((tag, i) => <span key={i} className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs text-neutral-600">{tag}</span>)}
          </p>
        )}
      </Section>

      {/* 5 · YouTube title split-tests */}
      <Section title="YouTube title split-tests (ranked by predicted CTR)">
        <ol className="space-y-1">
          {[...(output.youtubeTitleTests ?? [])].sort((a, b) => a.predictedCtrRank - b.predictedCtrRank).map((t, i) => (
            <li key={i}><span className="font-medium">#{t.predictedCtrRank}</span> {t.title} <span className="text-xs text-neutral-400">— {t.rationale}</span></li>
          ))}
        </ol>
      </Section>

      {/* 2 · Thumbnail strategy */}
      <Section title="Thumbnail strategy">
        <p><span className="font-medium">Emotional trigger:</span> {output.thumbnailStrategy?.emotionalTrigger}</p>
        <ul className="list-disc space-y-0.5 pl-5">
          <li>Background: {output.thumbnailStrategy?.primaryConcept.background}</li>
          <li>Text overlay: {output.thumbnailStrategy?.primaryConcept.textOverlay}</li>
          <li>Expression: {output.thumbnailStrategy?.primaryConcept.expression}</li>
          <li>Palette: {output.thumbnailStrategy?.primaryConcept.palette}</li>
          <li>Composition: {output.thumbnailStrategy?.primaryConcept.composition}</li>
        </ul>
        <p><span className="font-medium">A/B variant:</span> {output.thumbnailStrategy?.abVariant}</p>
        {output.thumbnailStrategy?.textOverlayOptions?.length > 0 && (
          <p><span className="font-medium">Overlay options:</span> {output.thumbnailStrategy.textOverlayOptions.join(' · ')}</p>
        )}
      </Section>

      {/* 3 · YouTube hook + chapters */}
      <Section title="60-second YouTube hook & chapters">
        <p className="whitespace-pre-wrap rounded-lg bg-neutral-50 p-3">{output.youtubeHook?.hookScript}</p>
        {output.youtubeHook?.chapterMarkers?.length > 0 && (
          <ul className="space-y-0.5 pt-1">
            {output.youtubeHook.chapterMarkers.map((m, i) => (
              <li key={i}><span className="font-mono text-xs text-neutral-500">{m.timestamp}</span> {m.label}</li>
            ))}
          </ul>
        )}
      </Section>

      {/* 6 · Pull quotes */}
      <Section title="Pull quotes">
        {output.pullQuotes?.map((q, i) => (
          <div key={i} className="border-l-2 border-[#F5B000] pl-3">
            <p className="italic">“{q.quote}”</p>
            <p className="text-xs text-neutral-500">{q.visualTreatment}</p>
          </div>
        ))}
      </Section>

      {/* 7 · Show notes */}
      <Section title="Show notes">
        {output.showNotes?.guestBio && <p><span className="font-medium">Guest:</span> {output.showNotes.guestBio}</p>}
        {output.showNotes?.keyInsights?.length > 0 && (
          <ul className="list-disc space-y-0.5 pl-5">{output.showNotes.keyInsights.map((k, i) => <li key={i}>{k}</li>)}</ul>
        )}
        {output.showNotes?.timestamps?.length > 0 && (
          <ul className="space-y-0.5 pt-1">{output.showNotes.timestamps.map((m, i) => <li key={i}><span className="font-mono text-xs text-neutral-500">{m.timestamp}</span> {m.label}</li>)}</ul>
        )}
      </Section>

      {/* 8 · Distribution plan */}
      <Section title="Distribution plan">
        <div className="space-y-2">
          {output.distributionPlan?.map((p, i) => (
            <div key={i} className="rounded-lg bg-neutral-50 p-3">
              <p className="font-medium capitalize text-neutral-900">{p.platform}</p>
              <p className="text-xs text-neutral-600">Sequence: {p.sequence} · Timing: {p.timing}</p>
              <p className="text-xs text-neutral-500">Cross-promo: {p.crossPromoHook}</p>
            </div>
          ))}
        </div>
      </Section>

      {modalOpen && (
        <ClipApprovalModal
          clips={selectedClips.map((c) => ({ id: c.id, label: c.hookLine || c.title }))}
          reference={reference}
          onClose={() => setModalOpen(false)}
        />
      )}
    </div>
  );
}
