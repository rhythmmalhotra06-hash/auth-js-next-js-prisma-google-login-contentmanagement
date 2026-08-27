'use client';

import { useState, useTransition } from 'react';
import { cn } from '@/lib/cn';
import { Icon } from '@/components/ui/Icon';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { attachPostToTicket, detachPost, proposeLearningFromPost, type PerfActionResult } from '@/app/performance/actions';
import type { SocialPostRow } from '@/lib/metrics/social-perf';

// The three things worth doing about a published post, on the row itself.
//
// "Attach" is the important one: it's how attribution actually gets fixed for accounts
// Hootsuite reports on but the portal has no permalink for. The link is written to every
// stored row for that post and inherited by later pulls, so it's done once.

export interface TicketOption { id: string; label: string }

export function PostRowActions({ post, tickets }: { post: SocialPostRow; tickets: TicketOption[] }) {
  const [open, setOpen] = useState(false);
  const [ticket, setTicket] = useState('');
  const [result, setResult] = useState<PerfActionResult | null>(null);
  const [pending, start] = useTransition();

  const run = (fn: () => Promise<PerfActionResult>) => {
    setResult(null);
    start(async () => {
      try {
        const r = await fn();
        setResult(r);
        if (r.ok) setOpen(false);
      } catch {
        setResult({ ok: false, message: 'That didn’t go through — try again.' });
      }
    });
  };

  const attached = !!post.ticketAirtableId;

  return (
    <div className="stack" style={{ gap: 6 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
        {attached ? (
          <>
            <span className="t-meta" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <Icon name="check" size={11} /> attached
            </span>
            <button type="button" disabled={pending} onClick={() => run(() => detachPost(post.key))}
              className="rounded-sm border border-border-strong bg-surface px-2 py-1 text-2xs font-semibold text-text hover:bg-bg-subtle disabled:opacity-50">
              Detach
            </button>
          </>
        ) : (
          <button type="button" disabled={pending} onClick={() => setOpen((v) => !v)}
            className="rounded-sm border border-border-strong bg-surface px-2 py-1 text-2xs font-semibold text-text hover:bg-bg-subtle disabled:opacity-50">
            {open ? 'Cancel' : 'Attach to ticket'}
          </button>
        )}

        <button type="button" disabled={pending}
          onClick={() => run(() => proposeLearningFromPost({
            caption: post.caption, account: post.account, reach: post.reach,
            engagementRate: post.engagementRate, vsMedian: post.vsMedian, url: post.url,
          }))}
          title="Propose what worked here as a clip learning — an admin approves it"
          className="rounded-sm border border-border-strong bg-surface px-2 py-1 text-2xs font-semibold text-text hover:bg-bg-subtle disabled:opacity-50">
          Teach the engine
        </button>

        <a href={`/intake?title=${encodeURIComponent(`More like: ${(post.caption ?? '').replace(/\s+/g, ' ').slice(0, 60)}`)}&brief=${encodeURIComponent(referenceBrief(post))}`}
          className="rounded-sm border border-border-strong bg-surface px-2 py-1 text-2xs font-semibold text-text hover:bg-bg-subtle"
          title="Raise a request using this post as the reference">
          Make more like this
        </a>
      </div>

      {open && !attached && (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', maxWidth: 420 }}>
          <SearchableSelect
            value={ticket}
            onChange={setTicket}
            options={tickets.map((t) => ({ value: t.id, label: t.label }))}
            placeholder="Pick a ticket…"
            searchPlaceholder="Search tickets…"
            ariaLabel="Ticket to attach this post to"
            width="100%"
          />
          <button type="button" disabled={pending || !ticket}
            onClick={() => run(() => attachPostToTicket(post.key, ticket))}
            className="rounded-sm bg-brand px-2.5 py-1 text-2xs font-semibold text-white hover:bg-brand-bright disabled:opacity-40">
            {pending ? 'Saving…' : 'Attach'}
          </button>
        </div>
      )}

      {result && (
        <div className={cn('text-2xs', result.ok ? 'text-success-content' : 'text-danger-content')}>{result.message}</div>
      )}
    </div>
  );
}

/** A brief that carries the evidence, so the request explains itself. */
function referenceBrief(post: SocialPostRow): string {
  const bits = [
    `Reference post${post.account ? ` from @${post.account}` : ''}:`,
    post.url ?? '',
    '',
    post.reach != null ? `Reach: ${post.reach.toLocaleString('en-US')}` : '',
    post.engagementRate != null ? `Engagement: ${post.engagementRate}%` : '',
    post.vsMedian != null ? `Performance: ${post.vsMedian}× the account median` : '',
    '',
    'Original caption:',
    (post.caption ?? '').replace(/\s+/g, ' ').slice(0, 600),
  ];
  return bits.filter((b) => b !== undefined).join('\n');
}
