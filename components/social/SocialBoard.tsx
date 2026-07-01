'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Icon } from '@/components/ui/Icon';
import { DetailDrawer } from '@/components/ui/DetailDrawer';
import type { IntakeReferenceData } from '@/lib/intake/data';
import type { SocialSuggestion, TicketState } from '@/lib/social/repository';
import { approveSocialSuggestion, rejectSocialSuggestion, raiseSocialRequestAction } from '@/app/social/actions';

const inputCls =
  'w-full rounded-sm border border-border-default px-3 py-2 text-sm text-text outline-none focus-visible:border-brand focus-visible:shadow-[var(--mv-shadow-focus)]';

type View = 'cards' | 'table';
type SortKey = 'clip' | 'status' | 'virality';
type Sort = { key: SortKey; dir: 'asc' | 'desc' };

const TICKET_URL = (id: string) => `https://airtable.com/appFEFygXo2pRc8AR/tblhrRl8GzsDMv0DD/${id}`;

function statusTone(status: string | null): 'neutral' | 'brand' | 'success' | 'info' | 'warning' {
  if (!status) return 'neutral';
  if (status.startsWith('1')) return 'info';
  if (status.startsWith('2A')) return 'success';
  if (status.startsWith('2')) return 'brand';
  if (status.startsWith('13')) return 'warning';
  return 'neutral';
}
// Pipeline order for sorting (proposals first — they need triage).
function statusRank(status: string | null): number {
  const s = status ?? '';
  if (s.startsWith('1')) return 1;
  if (s.startsWith('2A')) return 3;
  if (s.startsWith('2')) return 2;
  if (s.startsWith('13')) return 5;
  return 4;
}
function statusFlags(s: SocialSuggestion) {
  const st = s.status ?? '';
  return { isProposal: st.startsWith('1'), isApproved: st.startsWith('2') && !st.startsWith('2A') };
}
function hostOf(url: string | null): string {
  if (!url) return 'Other source';
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
}

// Per-suggestion approve / reject with pending + error state.
function useRowActions() {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      setErr(null);
      const r = await fn();
      if (!r.ok) { setErr(r.error ?? 'Something went wrong'); return; }
      router.refresh();
    });
  return { pending, err, run };
}

// ── Cards (design-system .clip) ──────────────────────────────────────────────

function ClipCard({ s, onOpen }: { s: SocialSuggestion; onOpen: () => void }) {
  return (
    <button type="button" onClick={onOpen} className="clip cursor-pointer text-left focus-visible:shadow-[var(--mv-shadow-focus)] focus-visible:outline-none">
      <div className="cap">
        <Icon name="film" size={26} />
        {s.viralityScore != null && <span className="vir">★ {s.viralityScore}</span>}
        {s.timecode && <span className="ts">{s.timecode}</span>}
      </div>
      <div className="body">
        <div className="hk line-clamp-2">{s.title ?? 'Untitled clip'}</div>
        {s.captions && <div className="desc line-clamp-2">{s.captions}</div>}
        <div className="foot">
          {s.status && <Badge tone={statusTone(s.status)}>{s.status}</Badge>}
        </div>
      </div>
    </button>
  );
}

// ── Sortable table ───────────────────────────────────────────────────────────

function Th({ label, k, sort, onSort, align }: { label: string; k: SortKey; sort: Sort; onSort: (k: SortKey) => void; align?: 'right' }) {
  const active = sort.key === k;
  return (
    <th className={cn('px-4 py-2.5', align === 'right' && 'text-right')} aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button type="button" onClick={() => onSort(k)} className={cn('group inline-flex items-center gap-1 uppercase tracking-wide', align === 'right' && 'flex-row-reverse')}>
        <span>{label}</span>
        <Icon name="chevron" size={11} className={cn('transition-opacity', active ? 'text-brand opacity-100' : 'opacity-0 group-hover:opacity-40', active && sort.dir === 'asc' && 'rotate-180')} />
      </button>
    </th>
  );
}

function ClipRow({ s, ticketState, onOpen }: { s: SocialSuggestion; ticketState?: TicketState; onOpen: () => void }) {
  return (
    <tr onClick={onOpen} className="cursor-pointer border-b border-border-muted align-top last:border-0 hover:bg-bg-subtle">
      <td className="px-4 py-3 font-medium text-text">
        <div className="line-clamp-2">{s.title ?? 'Untitled clip'}</div>
        {s.captions && <div className="mt-0.5 line-clamp-1 text-2xs font-normal text-text-subtle">{s.captions}</div>}
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        {s.status && <Badge tone={statusTone(s.status)}>{s.status}</Badge>}
        {s.ticketRaised && ticketState?.prioStatus && (
          <div className="mt-1 text-2xs text-text-muted">{ticketState.prioStatus}{ticketState.ticketStatus ? ` · ${ticketState.ticketStatus}` : ''}</div>
        )}
      </td>
      <td className="px-4 py-3 text-right tabular-nums text-text">{s.viralityScore ?? '—'}</td>
    </tr>
  );
}

// ── Drawer detail + actions ──────────────────────────────────────────────────

function DrawerBody({ s, ticketState }: { s: SocialSuggestion; ticketState?: TicketState }) {
  return (
    <div className="space-y-5 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        {s.status && <Badge tone={statusTone(s.status)}>{s.status}</Badge>}
        {s.viralityScore != null && <Badge tone="brand">Virality {s.viralityScore}/10</Badge>}
        {s.timecode && <Badge tone="neutral">{s.timecode}</Badge>}
      </div>
      {s.captions && <Section label="Caption">{s.captions}</Section>}
      {s.notes && <Section label="Why this clip">{s.notes}</Section>}
      {s.ticketRaised && (ticketState?.prioStatus || ticketState?.ticketStatus) && (
        <Section label="Ticket status">
          <span className="flex flex-wrap gap-2">
            {ticketState?.prioStatus && <Badge tone="brand">{ticketState.prioStatus}</Badge>}
            {ticketState?.ticketStatus && <Badge tone="neutral">{ticketState.ticketStatus}</Badge>}
          </span>
        </Section>
      )}
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-2xs font-semibold uppercase tracking-wide text-text-subtle">{label}</div>
      <div className="leading-relaxed text-text whitespace-pre-line">{children}</div>
    </div>
  );
}

function DrawerActions({ s, onRaise, onDone }: { s: SocialSuggestion; onRaise: () => void; onDone: () => void }) {
  const { pending, err, run } = useRowActions();
  const { isProposal, isApproved } = statusFlags(s);
  const done = () => { onDone(); };

  if (s.ticketRaised) {
    return s.creativeTicketId
      ? <a href={TICKET_URL(s.creativeTicketId)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand">Open ticket in Creatives queue <Icon name="ext" size={14} /></a>
      : <span className="text-sm text-text-muted">Ticket raised.</span>;
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      {isProposal && (
        <Button size="md" disabled={pending} onClick={() => run(async () => { const r = await approveSocialSuggestion(s.id); if (r.ok) done(); return r; })}>Approve</Button>
      )}
      {isApproved && (
        <Button size="md" disabled={pending} onClick={onRaise}>Raise request</Button>
      )}
      <Button variant="ghost" size="md" disabled={pending} onClick={() => run(async () => { const r = await rejectSocialSuggestion(s.id); if (r.ok) done(); return r; })}>Reject</Button>
      {err && <span className="text-xs text-danger">{err}</span>}
    </div>
  );
}

// ── Raise modal ──────────────────────────────────────────────────────────────

function ModalField({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
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
      eventTypeId, assetTypeId,
      officialCalendarId: officialCalendarId || undefined,
      dueDate, requesterId: requesterId || undefined,
    });
    setSubmitting(false);
    if (res.ok) { router.refresh(); onClose(); }
    else setError(res.error ?? 'Failed to raise the ticket.');
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-md bg-surface p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-text">Raise a ticket</h3>
        <p className="mt-1 text-sm text-text-muted">Creates a production ticket in the Creatives queue for “{suggestion.title ?? 'this clip'}”. Title and brief are filled from the clip.</p>
        <form onSubmit={onSubmit} className="mt-5 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <ModalField label="Event Type">
              <select className={inputCls} value={eventTypeId} onChange={(e) => { setEventTypeId(e.target.value); setAssetTypeId(''); }}>
                <option value="">Select…</option>
                {reference.eventTypes.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </ModalField>
            <ModalField label="Asset Type" hint={eventTypeId ? undefined : 'Pick an Event Type first'}>
              <select className={inputCls} value={assetTypeId} onChange={(e) => setAssetTypeId(e.target.value)} disabled={!eventTypeId}>
                <option value="">{eventTypeId ? `Select… (${filteredAssetTypes.length})` : 'Select an Event Type first'}</option>
                {filteredAssetTypes.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </ModalField>
            <ModalField label="Official Calendar" hint="Optional">
              <select className={inputCls} value={officialCalendarId} onChange={(e) => setOfficialCalendarId(e.target.value)}>
                <option value="">Select…</option>
                {reference.officialCalendars.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </ModalField>
            <ModalField label="Due date">
              <input type="date" className={inputCls} value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </ModalField>
            <ModalField label="Requested by" hint="Defaults to you">
              <select className={inputCls} value={requesterId} onChange={(e) => setRequesterId(e.target.value)}>
                <option value="">Me (current user)</option>
                {reference.employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </ModalField>
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

// ── Board ────────────────────────────────────────────────────────────────────

export function SocialBoard({
  suggestions, reference, ticketStates,
}: {
  suggestions: SocialSuggestion[];
  reference: IntakeReferenceData;
  ticketStates: Record<string, TicketState>;
}) {
  const [view, setView] = useState<View>('cards');
  const [sort, setSort] = useState<Sort>({ key: 'status', dir: 'asc' });
  const [selected, setSelected] = useState<SocialSuggestion | null>(null);
  const [raiseTarget, setRaiseTarget] = useState<SocialSuggestion | null>(null);

  const toggleSort = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));

  const groups = useMemo(() => {
    const m = new Map<string, SocialSuggestion[]>();
    for (const s of suggestions) {
      const key = s.clipSourceUrl ?? '';
      const arr = m.get(key);
      if (arr) arr.push(s);
      else m.set(key, [s]);
    }
    const cmp = (a: SocialSuggestion, b: SocialSuggestion) => {
      const mult = sort.dir === 'asc' ? 1 : -1;
      if (sort.key === 'virality') return (((a.viralityScore ?? -1) - (b.viralityScore ?? -1)) * mult);
      if (sort.key === 'status') return ((statusRank(a.status) - statusRank(b.status)) || 0) * mult;
      return (a.title ?? '').localeCompare(b.title ?? '') * mult;
    };
    return [...m.entries()].map(([url, items]) => [url, [...items].sort(cmp)] as const);
  }, [suggestions, sort]);

  const stateFor = (s: SocialSuggestion) => (s.creativeTicketId ? ticketStates[s.creativeTicketId] : undefined);
  const openRaise = (s: SocialSuggestion) => { setSelected(null); setRaiseTarget(s); };

  if (suggestions.length === 0) {
    return (
      <div className="empty">
        No clip suggestions yet. <Link href="/social/new" className="font-semibold text-brand">Generate from a media link</Link>.
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <div className="segmented">
          {(['cards', 'table'] as View[]).map((v) => (
            <button key={v} type="button" onClick={() => setView(v)} className={cn(view === v && 'on')} style={{ textTransform: 'capitalize' }}>{v}</button>
          ))}
        </div>
      </div>

      <div className="space-y-6">
        {groups.map(([url, items]) => {
          const taken = items.filter((i) => i.ticketRaised).length;
          return (
            <section key={url || 'none'} className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2 text-sm font-semibold text-text">
                  <Icon name="film" size={16} className="flex-none text-text-muted" />
                  <span className="truncate">{items[0]?.sourceTitle || hostOf(url)}</span>
                  {url && <a href={url} target="_blank" rel="noreferrer" aria-label="Open source video" className="flex-none text-text-subtle hover:text-brand"><Icon name="ext" size={13} /></a>}
                </div>
                <span className="flex-none text-2xs text-text-subtle">{items.length} suggested · {taken} raised</span>
              </div>

              {view === 'cards' ? (
                <div className="clipgrid">
                  {items.map((s) => <ClipCard key={s.id} s={s} onOpen={() => setSelected(s)} />)}
                </div>
              ) : (
                <div className="overflow-x-auto rounded-md border border-border-default bg-surface shadow-[var(--mv-shadow-light)]">
                  <table className="w-full text-sm">
                    <thead className="text-left text-2xs uppercase tracking-wide text-text-subtle">
                      <tr className="border-b border-border-default">
                        <Th label="Clip" k="clip" sort={sort} onSort={toggleSort} />
                        <Th label="Status" k="status" sort={sort} onSort={toggleSort} />
                        <Th label="Virality" k="virality" sort={sort} onSort={toggleSort} align="right" />
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((s) => <ClipRow key={s.id} s={s} ticketState={stateFor(s)} onOpen={() => setSelected(s)} />)}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          );
        })}
      </div>

      <DetailDrawer
        open={!!selected}
        onClose={() => setSelected(null)}
        eyebrow={selected ? (selected.sourceTitle || hostOf(selected.clipSourceUrl)) : ''}
        title={selected?.title ?? 'Clip'}
        footer={selected && <DrawerActions s={selected} onRaise={() => openRaise(selected)} onDone={() => setSelected(null)} />}
      >
        {selected && <DrawerBody s={selected} ticketState={stateFor(selected)} />}
      </DetailDrawer>

      {raiseTarget && <RaiseModal suggestion={raiseTarget} reference={reference} onClose={() => setRaiseTarget(null)} />}
    </div>
  );
}
