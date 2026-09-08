// The editing DNA for a ticket's asset type, as scannable checkpoints.
//
// Titus, 2026-09-08: "is there a way where they can actually see the editing DNA in the
// ticket itself? … don't show this, don't show that" — then, on seeing it: "can the portal
// summarise it as check points instead of showing the full thing, that is so long."
//
// So: the rule list is split into individual checkpoints (verbatim — see
// lib/dna-review/checkpoints.ts for why we don't paraphrase), the pre-submission ones are
// pulled to the top as an actual hand-over checklist, and the long tail collapses behind a
// native <details> so no client JS is needed.
//
// Read-only by design: DNA is governed at /settings/asset-types and upstream in Airtable.

import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { getDnaReviewConfig } from '@/lib/dna-review/config';
import { toDnaCheckpoints } from '@/lib/dna-review/checkpoints';

/** Rules shown before the "+N more" fold. Enough to be useful, few enough to scan. */
const VISIBLE_RULES = 8;

function Checklist({ items, box }: { items: string[]; box: boolean }) {
  return (
    <ul className="space-y-1">
      {items.map((r, i) => (
        <li key={i} className="flex gap-2 text-xs text-text-muted">
          <span aria-hidden className="shrink-0 text-text-subtle">{box ? '☐' : '•'}</span>
          <span>{r}</span>
        </li>
      ))}
    </ul>
  );
}

export async function TicketDnaPanel({ assetTypeId }: { assetTypeId: string | null }) {
  if (!assetTypeId) return null;

  const config = await getDnaReviewConfig(assetTypeId);
  if (!config || config.baselineSource === 'none') return null;

  const { preSubmit, rules, total } = toDnaCheckpoints(config.dnaText);
  if (total === 0) return null;

  const head = rules.slice(0, VISIBLE_RULES);
  const tail = rules.slice(VISIBLE_RULES);

  return (
    <div className="card pad">
      <div className="sec-head" style={{ margin: '0 0 12px' }}>
        <h3>Editing DNA</h3>
        <span className="hint">
          {total} checkpoint{total === 1 ? '' : 's'} for {config.assetTypeName}
          {config.baselineSource === 'upstream' ? ' · from Airtable' : ' · edited in the portal'}
        </span>
      </div>

      {preSubmit.length > 0 && (
        <div className="mb-3">
          <p className="mb-1.5 text-2xs font-semibold uppercase tracking-wide text-text-subtle">
            Before you submit
          </p>
          <Checklist items={preSubmit} box />
        </div>
      )}

      {head.length > 0 && (
        <>
          <p className="mb-1.5 text-2xs font-semibold uppercase tracking-wide text-text-subtle">
            Must follow
          </p>
          <Checklist items={head} box={false} />
        </>
      )}

      {tail.length > 0 && (
        <details className="mt-2">
          <summary className="cursor-pointer text-xs text-brand hover:underline">
            +{tail.length} more rule{tail.length === 1 ? '' : 's'}
          </summary>
          <div className="mt-1.5">
            <Checklist items={tail} box={false} />
          </div>
        </details>
      )}

      {config.ruleBullets.length > 0 && (
        <div className="mt-3 border-t border-border-muted pt-3">
          <p className="mb-1.5 text-2xs font-semibold uppercase tracking-wide text-text-subtle">
            Learned from feedback
          </p>
          <Checklist items={config.ruleBullets} box={false} />
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
