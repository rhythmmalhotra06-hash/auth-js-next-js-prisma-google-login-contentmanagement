'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Icon } from '@/components/ui/Icon';
import type { IntakeReferenceData } from '@/lib/intake/data';
import type { SocialSuggestion, TicketState } from '@/lib/social/repository';
import { approveSocialSuggestion, rejectSocialSuggestion, raiseSocialRequestAction } from '@/app/social/actions';

const inputCls =
  'w-full rounded-sm border border-border-default px-3 py-2 text-sm text-text outline-none focus-visible:border-brand focus-visible:shadow-[var(--mv-shadow-focus)]';

type View = 'table' | 'cards';

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

const TICKET_URL = (id: string) => `https://airtable.com/appFEFygXo2pRc8AR/tblhrRl8GzsDMv0DD/${id}`;

// Per-suggestion approve / reject with a pending + error state. Raising is lifted to
// the board (one shared modal) so it never nests inside a table row.
function useRowActions() {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      setErr(null);
      const r = await fn();
      if (!r.ok) { setErr(r.error ?? 'failed'); return; }
      router.refresh();
    });
  return { pending, err, run };
}

function statusFlags(s: SocialSuggestion) {
  const st = s.status ?? '';
  return { isProposal: st.startsWith('1'), isApproved: st.startsWith('2') && !st.startsWith('2A') };
}

// ── Field + raise modal (Event/Asset Type, due date, requester) ──────────────

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium text-text">{label}</label>
      {hint && <p className="text-xs text-text-muted">{hint}</p>}
      {children}
    </div>
  );
}

function RaiseModal({ suggestion, reference, onClose }: { suggestion: SocialSuggestion; reference: IntakeReferenceData; onClose: () => void }) {
  const router = useRouter();
  const [eventTypeId, setEventTypeId] = useState('');
  const [assetTypeId, setAssetTypeId] = useState('');
  const [officialCalendarId, setOfficialCalendarId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [requesterId, setRequesterId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filteredAssetTypes = useMemo(
    () => (eventTypeId ? reference.assetTypes.filter((a) => a.eventTypeIds.includes(eventTypeId)) : []),
    [eventTypeId, reference.assetTypes],
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const res = await raiseSocialRequestAction(suggestion.id, {
      eventTypeId,
      assetTypeId,
      officialCalendarId: officialCalendarId || undefined,
      dueDate,
      requesterId: requesterId || undefined,
    });
    setSubmitting(false);
    if (res.ok) { router.refresh(); onClose(); }
    else setError(res.error ?? 'Failed to raise the ticket.');
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-md bg-surface p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-text">Raise a ticket</h3>
        <p className="mt-1 text-sm text-text-muted">
          Creates a production ticket in the Creatives queue for “{suggestion.title ?? 'this clip'}”. Title and brief are filled from the clip.
        </p>
        <form onSubmit={onSubmit} className="mt-5 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Event Type">
              <select className={inputCls} value={eventTypeId} onChange={(e) => { setEventTypeId(e.target.value); setAssetTypeId(''); }}>
                <option value="">Select…</option>
                {reference.eventTypes.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </Field>
            <Field label="Asset Type" hint={eventTypeId ? undefined : 'Pick an Event Type first'}>
              <select className={inputCls} value={assetTypeId} onChange={(e) => setAssetTypeId(e.target.value)} disabled={!eventTypeId}>
                <option value="">{eventTypeId ? `Select… (${filteredAssetTypes.length})` : 'Select an Event Type first'}</option>
                {filteredAssetTypes.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </Field>
            <Field label="Official Calendar" hint="Optional">
              <select className={inputCls} value={officialCalendarId} onChange={(e) => setOfficialCalendarId(e.target.value)}>
                <option value="">Select…</option>
                {reference.officialCalendars.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <Field label="Due date">
              <input type="date" className={inputCls} value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </Field>
            <Field label="Requested by" hint="Defaults to you">
              <select className={inputCls} value={requesterId} onChange={(e) => setRequesterId(e.target.value)}>
                <option value="">Me (current user)</option>
                {reference.employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </Field>
          </div>
          {error && <div className="rounded-sm bg-danger-soft px-3 py-2 text-sm text-danger">{error}</div>}
          <div className="flex justify-end gap-2 border-t border-border-default pt-4">
            <button type="button" onClick={onClose} className="rounded-sm px-4 py-2 text-sm text-text-muted hover:bg-bg-subtle">Cancel</button>
            <button type="submit" disabled={submitting} className="rounded-sm px-4 py-2 text-sm font-medium text-white bg-brand hover:bg-brand-bright disabled:opacity-60">
              {submitting ? 'Raising…' : 'Raise ticket'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Row actions (shared by table + cards) ────────────────────────────────────

function RowActions({ s, onRaise }: { s: SocialSuggestion; onRaise: (s: SocialSuggestion) => void }) {
  const { pending, err, run } = useRowActions();
  const { isProposal, isApproved } = statusFlags(s);

  if (s.ticketRaised) {
    return s.creativeTicketId
      ? <a href={TICKET_URL(s.creativeTicketId)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-brand">Open ticket <Icon name="ext" size={12} /></a>
      : <span className="text-2xs text-text-subtle">raised</span>;
  }
  return (
    <div className="flex items-center justify-end gap-1.5">
      {isProposal && (
        <>
          <Button size="sm" disabled={pending} onClick={() => run(() => approveSocialSuggestion(s.id))}>Approve</Button>
          <Button variant="ghost" size="sm" disabled={pending} onClick={() => run(() => rejectSocialSuggestion(s.id))}>Reject</Button>
        </>
      )}
      {isApproved && (
        <>
          <Button size="sm" disabled={pending} onClick={() => onRaise(s)}>Raise</Button>
          <Button variant="ghost" size="sm" disabled={pending} onClick={() => run(() => rejectSocialSuggestion(s.id))}>Reject</Button>
        </>
      )}
      {err && <span className="text-2xs text-danger">{err}</span>}
    </div>
  );
}

// ── Table + card renderers ───────────────────────────────────────────────────

function SuggestionRow({ s, ticketState, onRaise }: { s: SocialSuggestion; ticketState?: TicketState; onRaise: (s: SocialSuggestion) => void }) {
  return (
    <tr className="border-b border-border-muted last:border-0 align-top hover:bg-bg-subtle">
      <td className="px-4 py-3 font-medium text-text">
        <div className="line-clamp-2">{s.title ?? 'Untitled clip'}</div>
        {s.captions && <div className="mt-1 line-clamp-1 text-2xs font-normal text-text-subtle">{s.captions}</div>}
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        {s.status && <Badge tone={statusTone(s.status)}>{s.status}</Badge>}
        {s.ticketRaised && ticketState?.prioStatus && (
          <div className="mt-1 text-2xs text-text-muted">{ticketState.prioStatus}{ticketState.ticketStatus ? ` · ${ticketState.ticketStatus}` : ''}</div>
        )}
      </td>
      <td className="px-4 py-3 text-right whitespace-nowrap"><RowActions s={s} onRaise={onRaise} /></td>
    </tr>
  );
}

function SuggestionCard({ s, ticketState, onRaise }: { s: SocialSuggestion; ticketState?: TicketState; onRaise: (s: SocialSuggestion) => void }) {
  return (
    <div className="card pad space-y-3">
      <div className="flex items-start justify-between gap-3">
        <h4 className="text-sm font-semibold text-text">{s.title ?? 'Untitled clip'}</h4>
        {s.status && <Badge tone={statusTone(s.status)}>{s.status}</Badge>}
      </div>
      {s.captions && <p className="text-xs text-text-muted whitespace-pre-line">{s.captions}</p>}
      {s.ticketRaised && (ticketState?.prioStatus || ticketState?.ticketStatus) && (
        <div className="flex flex-wrap gap-2 border-t border-border-default pt-2 text-2xs">
          {ticketState?.prioStatus && <Badge tone="brand">{ticketState.prioStatus}</Badge>}
          {ticketState?.ticketStatus && <Badge tone="neutral">{ticketState.ticketStatus}</Badge>}
        </div>
      )}
      <div className="border-t border-border-default pt-3"><RowActions s={s} onRaise={onRaise} /></div>
    </div>
  );
}

// ── Board ────────────────────────────────────────────────────────────────────

export function SocialBoard({
  suggestions,
  reference,
  ticketStates,
}: {
  suggestions: SocialSuggestion[];
  reference: IntakeReferenceData;
  ticketStates: Record<string, TicketState>;
}) {
  const [view, setView] = useState<View>('table');
  const [raiseTarget, setRaiseTarget] = useState<SocialSuggestion | null>(null);

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

  const stateFor = (s: SocialSuggestion) => (s.creativeTicketId ? ticketStates[s.creativeTicketId] : undefined);

  if (suggestions.length === 0) {
    return (
      <div className="empty">
        No clip suggestions yet. <Link href="/social/new" className="font-semibold text-brand">Generate from a media link</Link>.
      </div>
    );
  }

  return (
    <div>
      <div className="subtabs" style={{ justifyContent: 'flex-end', marginTop: 0, marginBottom: 14 }}>
        {(['table', 'cards'] as View[]).map((v) => (
          <button key={v} onClick={() => setView(v)} className={cn('subtab', view === v && 'on')} style={{ textTransform: 'capitalize' }}>
            {v}
          </button>
        ))}
      </div>

      <div className="space-y-6">
        {groups.map(([url, items]) => {
          const taken = items.filter((i) => i.ticketRaised).length;
          return (
            <section key={url || 'none'} className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-medium text-text">
                  <Icon name="film" size={16} />
                  {url ? <a href={url} target="_blank" rel="noreferrer" className="text-brand underline">{hostOf(url)}</a> : <span>{hostOf(url)}</span>}
                </div>
                <span className="text-2xs text-text-subtle">{items.length} suggested · {taken} raised</span>
              </div>

              {view === 'table' ? (
                <div className="overflow-x-auto rounded-md border border-border-default bg-surface shadow-[var(--mv-shadow-light)]">
                  <table className="w-full text-sm">
                    <thead className="text-left text-2xs uppercase tracking-wide text-text-subtle">
                      <tr className="border-b border-border-default">
                        <th className="px-4 py-2.5">Clip</th>
                        <th className="px-4 py-2.5">Status</th>
                        <th className="px-4 py-2.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((s) => <SuggestionRow key={s.id} s={s} ticketState={stateFor(s)} onRaise={setRaiseTarget} />)}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {items.map((s) => <SuggestionCard key={s.id} s={s} ticketState={stateFor(s)} onRaise={setRaiseTarget} />)}
                </div>
              )}
            </section>
          );
        })}
      </div>

      {raiseTarget && <RaiseModal suggestion={raiseTarget} reference={reference} onClose={() => setRaiseTarget(null)} />}
    </div>
  );
}
