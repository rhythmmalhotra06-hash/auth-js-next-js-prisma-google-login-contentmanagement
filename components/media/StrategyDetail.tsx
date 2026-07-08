'use client';

// Read-only render of the full generated content strategy (the 10-section output
// stored in Media Sources › Strategy JSON). The media detail page is approve/
// dismiss only, so unlike components/clipping/StrategyView this has NO ticket
// creation — it just surfaces the rich detail (titles, hook, thumbnail, pull
// quotes, show notes, distribution) that the clip list alone doesn't show.

import type { Strategy } from '@/lib/clipping/schema';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card pad">
      <h3 className="text-sm font-semibold text-text">{title}</h3>
      <div className="mt-3 space-y-3 text-sm text-text-muted">{children}</div>
    </section>
  );
}

/** Parse the stored Strategy JSON; returns null when absent or malformed. */
export function parseStrategy(json: string | null): Strategy | null {
  if (!json) return null;
  try {
    const v = JSON.parse(json) as Strategy;
    return v && typeof v === 'object' ? v : null;
  } catch {
    return null;
  }
}

export function StrategyDetail({ strategy }: { strategy: Strategy }) {
  const s = strategy;
  return (
    <div className="space-y-4">
      {/* Episode titles & descriptions */}
      {(s.episodeTitles?.length || s.episodeDescriptionShort || s.episodeDescriptionLong) && (
        <Section title="Episode titles & descriptions">
          {s.episodeTitles?.length > 0 && (
            <div className="space-y-2">
              {s.episodeTitles.map((t, i) => (
                <div key={i} className="rounded-sm bg-bg-subtle p-3">
                  <span className="rounded-sm bg-brand-soft px-1.5 py-0.5 text-xs capitalize text-brand-content">{t.format}</span>
                  <p className="mt-1 font-medium text-text">{t.title}</p>
                  <p className="text-xs text-text-subtle">{t.description}</p>
                </div>
              ))}
            </div>
          )}
          {s.episodeDescriptionShort && <p><span className="font-medium text-text">Short:</span> {s.episodeDescriptionShort}</p>}
          {s.episodeDescriptionLong && <p><span className="font-medium text-text">Full:</span> {s.episodeDescriptionLong}</p>}
          {s.youtubeTags?.length > 0 && (
            <p className="flex flex-wrap gap-1 pt-1">
              {s.youtubeTags.map((tag, i) => <span key={i} className="rounded-sm bg-bg-subtle px-1.5 py-0.5 text-xs text-text-subtle">{tag}</span>)}
            </p>
          )}
        </Section>
      )}

      {/* YouTube title split-tests */}
      {s.youtubeTitleTests?.length > 0 && (
        <Section title="YouTube title split-tests (ranked by predicted CTR)">
          <ol className="space-y-1">
            {[...s.youtubeTitleTests].sort((a, b) => a.predictedCtrRank - b.predictedCtrRank).map((t, i) => (
              <li key={i}><span className="font-medium text-text">#{t.predictedCtrRank}</span> {t.title} <span className="text-xs text-text-subtle">— {t.rationale}</span></li>
            ))}
          </ol>
        </Section>
      )}

      {/* Thumbnail strategy */}
      {s.thumbnailStrategy && (
        <Section title="Thumbnail strategy">
          <p><span className="font-medium text-text">Emotional trigger:</span> {s.thumbnailStrategy.emotionalTrigger}</p>
          {s.thumbnailStrategy.primaryConcept && (
            <ul className="list-disc space-y-0.5 pl-5">
              <li>Background: {s.thumbnailStrategy.primaryConcept.background}</li>
              <li>Text overlay: {s.thumbnailStrategy.primaryConcept.textOverlay}</li>
              <li>Expression: {s.thumbnailStrategy.primaryConcept.expression}</li>
              <li>Palette: {s.thumbnailStrategy.primaryConcept.palette}</li>
              <li>Composition: {s.thumbnailStrategy.primaryConcept.composition}</li>
            </ul>
          )}
          <p><span className="font-medium text-text">A/B variant:</span> {s.thumbnailStrategy.abVariant}</p>
          {s.thumbnailStrategy.textOverlayOptions?.length > 0 && (
            <p><span className="font-medium text-text">Overlay options:</span> {s.thumbnailStrategy.textOverlayOptions.join(' · ')}</p>
          )}
        </Section>
      )}

      {/* 60-second YouTube hook + chapters */}
      {s.youtubeHook && (
        <Section title="60-second YouTube hook & chapters">
          {s.youtubeHook.hookScript && <p className="whitespace-pre-wrap rounded-sm bg-bg-subtle p-3">{s.youtubeHook.hookScript}</p>}
          {s.youtubeHook.chapterMarkers?.length > 0 && (
            <ul className="space-y-0.5 pt-1">
              {s.youtubeHook.chapterMarkers.map((m, i) => (
                <li key={i}><span className="font-mono text-xs text-text-subtle">{m.timestamp}</span> {m.label}</li>
              ))}
            </ul>
          )}
        </Section>
      )}

      {/* Pull quotes */}
      {s.pullQuotes?.length > 0 && (
        <Section title="Pull quotes">
          {s.pullQuotes.map((q, i) => (
            <div key={i} className="border-l-2 border-brand pl-3">
              <p className="italic">“{q.quote}”</p>
              <p className="text-xs text-text-subtle">{q.visualTreatment}</p>
            </div>
          ))}
        </Section>
      )}

      {/* Show notes */}
      {s.showNotes && (
        <Section title="Show notes">
          {s.showNotes.guestBio && <p><span className="font-medium text-text">Guest:</span> {s.showNotes.guestBio}</p>}
          {s.showNotes.keyInsights?.length > 0 && (
            <ul className="list-disc space-y-0.5 pl-5">{s.showNotes.keyInsights.map((k, i) => <li key={i}>{k}</li>)}</ul>
          )}
          {s.showNotes.timestamps?.length > 0 && (
            <ul className="space-y-0.5 pt-1">{s.showNotes.timestamps.map((m, i) => <li key={i}><span className="font-mono text-xs text-text-subtle">{m.timestamp}</span> {m.label}</li>)}</ul>
          )}
        </Section>
      )}

      {/* Distribution plan */}
      {s.distributionPlan?.length > 0 && (
        <Section title="Distribution plan">
          <div className="space-y-2">
            {s.distributionPlan.map((p, i) => (
              <div key={i} className="rounded-sm bg-bg-subtle p-3">
                <p className="font-medium capitalize text-text">{p.platform}</p>
                <p className="text-xs text-text-muted">Sequence: {p.sequence} · Timing: {p.timing}</p>
                <p className="text-xs text-text-subtle">Cross-promo: {p.crossPromoHook}</p>
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}
