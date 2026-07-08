'use client';

// Clips & suggestions tab — the approval gate for clip ideas cut from Vishen's media.
// Approve → ready to convert to a ticket; Dismiss → dropped. Writes straight to Airtable.

import type { ClipSuggestion } from '@/lib/media/repository';

export function ClipsPanel({ proposed, approved, sourceNames, onApprove, onDismiss }: {
  proposed: ClipSuggestion[];
  approved: ClipSuggestion[];
  sourceNames: Record<string, string>;
  onApprove: (id: string) => void;
  onDismiss: (id: string) => void;
}) {
  return (
    <div className="space-y-8">
      <section>
        <div className="mb-3">
          <span className="text-2xs font-bold uppercase tracking-wider text-gold-content">✦ Awaiting your approval</span>
          <div className="flex items-baseline gap-3">
            <h3 className="font-display text-base font-bold text-text">Clip ideas from your media</h3>
            <span className="ml-auto text-xs text-text-subtle">approve to send to your channels</span>
          </div>
        </div>
        {proposed.length === 0 ? (
          <Empty>No clips waiting — all reviewed. 🎉</Empty>
        ) : (
          <Grid>
            {proposed.map((c) => (
              <ClipCard key={c.id} clip={c} source={c.mediaSourceId ? sourceNames[c.mediaSourceId] : null}
                actions={
                  <>
                    <button onClick={() => onDismiss(c.id)} className="flex-1 rounded-sm border border-border-strong bg-surface px-3 py-1.5 text-xs font-semibold text-text hover:bg-bg-subtle">Dismiss</button>
                    <button onClick={() => onApprove(c.id)} className="flex-1 rounded-sm bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-bright">Approve</button>
                  </>
                } />
            ))}
          </Grid>
        )}
      </section>

      <section>
        <div className="mb-3">
          <span className="text-2xs font-bold uppercase tracking-wider text-success-content">✓ Approved</span>
          <h3 className="font-display text-base font-bold text-text">Ready to ship</h3>
        </div>
        {approved.length === 0 ? (
          <Empty>Nothing approved yet.</Empty>
        ) : (
          <Grid>
            {approved.map((c) => (
              <ClipCard key={c.id} clip={c} source={c.mediaSourceId ? sourceNames[c.mediaSourceId] : null} approved />
            ))}
          </Grid>
        )}
      </section>
    </div>
  );
}

function ClipCard({ clip, source, actions, approved }: {
  clip: ClipSuggestion; source: string | null; actions?: React.ReactNode; approved?: boolean;
}) {
  const ts = clip.timestampStart && clip.timestampEnd ? `${clip.timestampStart}–${clip.timestampEnd}` : clip.timestampStart;
  return (
    <div className="flex flex-col overflow-hidden rounded-md border border-border-default bg-surface shadow-[var(--mv-shadow-light)] transition-all hover:-translate-y-0.5 hover:shadow-[var(--mv-shadow-medium)]">
      <div className="relative h-[110px]" style={{ background: 'linear-gradient(135deg, var(--brand), var(--st-violet, #7c3aed))' }}>
        {clip.viralityScore != null && (
          <span className="absolute right-2 top-2 rounded-full bg-gold px-2 py-0.5 text-[11px] font-bold text-gold-content tabular-nums">🔥 {clip.viralityScore}</span>
        )}
        {ts && <span className="absolute bottom-2 left-2 rounded-full bg-black/40 px-2 py-0.5 text-[10.5px] font-bold text-white tabular-nums">{ts}</span>}
        {approved && <span className="absolute left-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-bold text-success-content">Approved</span>}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-3">
        <div className="text-[13px] font-semibold leading-snug text-text">{clip.hookLine || clip.name || 'Untitled clip'}</div>
        <div className="text-xs text-text-subtle">
          {clip.format ? `${clip.format}` : 'Clip'}{source ? ` · from ${source}` : ''}
        </div>
        {actions && <div className="mt-auto flex gap-2 pt-1">{actions}</div>}
      </div>
    </div>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{children}</div>;
}
function Empty({ children }: { children: React.ReactNode }) {
  return <div className="rounded-md border border-border-default bg-surface px-4 py-8 text-center text-sm text-text-subtle shadow-[var(--mv-shadow-light)]">{children}</div>;
}
