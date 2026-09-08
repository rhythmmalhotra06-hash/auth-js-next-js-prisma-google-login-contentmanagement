// The editing DNA for a ticket's asset type, read-only, on the ticket itself.
//
// Titus, 2026-09-08: "if someone raises a ticket called podcast snippet, is there a way
// where they can actually see the editing DNA in the ticket itself? … don't show this,
// don't show that." Editors were being asked to hit the DNA standard without the standard
// being anywhere near the work.
//
// Deliberately read-only: DNA is governed at /settings/asset-types (and upstream in
// Airtable), so this is a reference panel, not a second editing surface.

import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { BriefText } from '@/components/ui/BriefText';
import { getDnaReviewConfig } from '@/lib/dna-review/config';

export async function TicketDnaPanel({ assetTypeId }: { assetTypeId: string | null }) {
  if (!assetTypeId) return null;

  const config = await getDnaReviewConfig(assetTypeId);
  // 'none' means neither the portal fields nor the upstream DNA hold anything — showing an
  // empty card would just be noise next to the DNA review card below.
  if (!config || config.baselineSource === 'none') return null;

  return (
    <div className="card pad">
      <div className="k mb-2.5 text-2xs font-semibold uppercase tracking-wide text-text-subtle">
        Editing DNA
      </div>
      <p className="subtle mb-2 text-xs">
        The standard for <b>{config.assetTypeName}</b>
        {config.baselineSource === 'upstream' ? ' · from Airtable' : ' · edited in the portal'}
      </p>

      <BriefText text={config.baseline} />

      {config.ruleBullets.length > 0 && (
        <div className="mt-3">
          <p className="text-2xs font-semibold uppercase tracking-wide text-text-subtle">
            Learned rules
          </p>
          <ul className="mt-1.5 space-y-1">
            {config.ruleBullets.map((b, i) => (
              <li key={i} className="text-xs text-text-muted">• {b}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-3">
        {config.processDnaUrl && (
          <a href={config.processDnaUrl} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-brand hover:underline">
            Process DNA <Icon name="ext" size={12} />
          </a>
        )}
        <Link href="/settings/asset-types" className="text-xs text-text-subtle hover:underline">
          Manage DNA
        </Link>
      </div>
    </div>
  );
}
