'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Icon } from '@/components/ui/Icon';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import type { SocialSuggestion, SocialAssetType } from '@/lib/social/repository';
import { approveSocialSuggestion, rejectSocialSuggestion, raiseSocialRequestAction } from '@/app/social/actions';

function statusTone(status: string | null): 'neutral' | 'brand' | 'success' | 'info' | 'warning' {
  if (!status) return 'neutral';
  if (status.startsWith('1')) return 'info'; // Proposal
  if (status.startsWith('2A')) return 'success'; // Ticket Raised
  if (status.startsWith('2')) return 'brand'; // Approved
  if (status.startsWith('13')) return 'warning'; // Reject
  return 'neutral';
}

function hostOf(url: string | null): string {
  if (!url) return 'Other source';
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function SuggestionCard({ s, assetTypes }: { s: SocialSuggestion; assetTypes: SocialAssetType[] }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [assetTypeId, setAssetTypeId] = useState(s.assetTypeId ?? '');
  const router = useRouter();

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      setErr(null);
      const r = await fn();
      if (!r.ok) { setErr(r.error ?? 'failed'); return; }
      router.refresh();
    });

  const isProposal = (s.status ?? '').startsWith('1');
  const isApproved = (s.status ?? '').startsWith('2') && !(s.status ?? '').startsWith('2A');

  const options = useMemo(() => assetTypes.map((a) => ({ value: a.id, label: a.name })), [assetTypes]);

  return (
    <div className="card pad space-y-3">
      <div className="flex items-start justify-between gap-3">
        <h4 className="text-sm font-semibold text-text">{s.title ?? 'Untitled clip'}</h4>
        {s.status && <Badge tone={statusTone(s.status)}>{s.status}</Badge>}
      </div>

      {s.captions && <p className="text-xs text-text-muted whitespace-pre-line">{s.captions}</p>}
      {s.notes && <p className="text-2xs text-text-subtle whitespace-pre-line">{s.notes}</p>}

      {/* Status mirror — once a ticket exists, surface its state without leaving the portal. */}
      {s.ticketRaised && (
        <div className="flex flex-wrap gap-2 border-t border-border-default pt-2 text-2xs text-text-muted">
          {s.prioStatus && <Badge tone="brand">{s.prioStatus}</Badge>}
          {s.ticketStatus && <Badge tone="neutral">{s.ticketStatus}</Badge>}
          {s.assignedCreative && <span>· {s.assignedCreative}</span>}
          {s.assetLink && <a href={s.assetLink} target="_blank" rel="noreferrer" className="text-brand underline">asset</a>}
        </div>
      )}

      {err && <p className="text-xs text-danger">{err}</p>}

      {/* Actions */}
      {!s.ticketRaised && (
        <div className="space-y-2 border-t border-border-default pt-3">
          {isProposal && (
            <div className="flex items-center gap-2">
              <Button size="sm" disabled={pending} onClick={() => run(() => approveSocialSuggestion(s.id))}>Approve</Button>
              <Button variant="ghost" size="sm" disabled={pending} onClick={() => run(() => rejectSocialSuggestion(s.id))}>Reject</Button>
            </div>
          )}
          {isApproved && (
            <div className="flex flex-wrap items-center gap-2">
              <div className="min-w-48">
                <SearchableSelect
                  value={assetTypeId}
                  onChange={setAssetTypeId}
                  options={options}
                  placeholder="Asset type…"
                  searchPlaceholder="Search asset types…"
                />
              </div>
              <Button
                size="sm"
                disabled={pending || !assetTypeId}
                onClick={() => run(() => raiseSocialRequestAction(s.id, assetTypeId))}
              >
                Raise request
              </Button>
            </div>
          )}
          {pending && <span className="text-xs text-text-subtle">saving…</span>}
        </div>
      )}
    </div>
  );
}

export function SocialBoard({ suggestions, assetTypes }: { suggestions: SocialSuggestion[]; assetTypes: SocialAssetType[] }) {
  // Group by the source media link (the engine batch).
  const groups = useMemo(() => {
    const m = new Map<string, SocialSuggestion[]>();
    for (const s of suggestions) {
      const key = s.clipSourceUrl ?? '';
      const arr = m.get(key);
      if (arr) arr.push(s);
      else m.set(key, [s]);
    }
    return [...m.entries()];
  }, [suggestions]);

  if (suggestions.length === 0) {
    return (
      <div className="empty">
        No clip suggestions yet. <Link href="/social/new" className="font-semibold text-brand">Generate from a media link</Link>.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {groups.map(([url, items]) => {
        const taken = items.filter((i) => i.ticketRaised || (i.status ?? '').startsWith('2A')).length;
        return (
          <section key={url || 'none'} className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-medium text-text">
                <Icon name="film" size={16} />
                {url ? (
                  <a href={url} target="_blank" rel="noreferrer" className="text-brand underline">{hostOf(url)}</a>
                ) : (
                  <span>{hostOf(url)}</span>
                )}
              </div>
              <span className="text-2xs text-text-subtle">{items.length} suggested · {taken} raised</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((s) => <SuggestionCard key={s.id} s={s} assetTypes={assetTypes} />)}
            </div>
          </section>
        );
      })}
    </div>
  );
}
