'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { ClipApprovalModal } from '@/components/media/ClipApprovalModal';
import type { IntakeReferenceData } from '@/lib/intake/data';
import type { ClipSuggestion } from '@/lib/media/repository';

// Vishen-approved clips waiting to be converted into tickets. Surfaced in the
// Manager and Editor views. "Convert to ticket" opens the create-ticket form
// modal inline (pre-loaded with the clip) instead of navigating to the source.
export function ApprovedClipsPanel({ approved, sourceNames, sourceUrls, reference }: {
  approved: ClipSuggestion[];
  sourceNames: Record<string, string>;
  sourceUrls: Record<string, string>;
  reference: IntakeReferenceData;
}) {
  const [modalClip, setModalClip] = useState<ClipSuggestion | null>(null);

  // An Approved clip that already links a ticket is done — converting it again is
  // a silent no-op downstream, so only show clips still awaiting conversion.
  const convertible = approved.filter((c) => !c.ticketId);
  if (convertible.length === 0) return null;

  return (
    <section className="mb-7 rounded-md border border-border-default bg-surface p-4 shadow-[var(--mv-shadow-light)]">
      <div className="mb-3 flex items-center gap-2.5">
        <h2 className="text-base font-bold tracking-tight text-text">Approved by Vishen — ready to convert</h2>
        <Badge tone="success">{convertible.length}</Badge>
      </div>
      <ul className="divide-y divide-border-muted">
        {convertible.map((c) => (
          <li key={c.id} className="flex items-center justify-between gap-4 py-2.5">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-text">{c.hookLine || c.name || 'Clip'}</p>
              <p className="truncate text-xs text-text-muted">
                {sourceNames[c.mediaSourceId ?? ''] ?? 'Source'}
                {c.format ? ` · ${c.format.replace(/_/g, ' ')}` : ''}
                {c.viralityScore != null ? ` · virality ${c.viralityScore}` : ''}
              </p>
            </div>
            <button
              onClick={() => setModalClip(c)}
              className="flex-none rounded-sm border border-border-default px-3 py-1.5 text-sm font-semibold text-brand hover:bg-bg-subtle"
            >
              Convert to ticket →
            </button>
          </li>
        ))}
      </ul>

      {modalClip && (
        <ClipApprovalModal
          clipIds={[modalClip.id]}
          sourceUrl={sourceUrls[modalClip.mediaSourceId ?? ''] ?? null}
          reference={reference}
          onClose={() => setModalClip(null)}
        />
      )}
    </section>
  );
}
