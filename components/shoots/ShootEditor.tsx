'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { SearchableSelect, type SelectOption } from '@/components/ui/SearchableSelect';
import { cn } from '@/lib/cn';
import {
  type ShootRow, SHOOT_FORMATS, SHOOT_LOCATIONS, SHOOT_PLATFORMS, SHOOT_STATUS_ORDER, shortStatus,
} from '@/lib/shoots/constants';
import { ShootStars } from '@/components/shoots/ShootStars';
import { updateShootAction, linkShootTicket, raiseNewPrioTicket } from '@/app/shoots/actions';

interface TicketOption { id: string; title: string; ticketStatus: string | null }

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-text">{label}</label>
      {hint && <p className="text-xs text-text-muted">{hint}</p>}
      {children}
    </div>
  );
}

const inputCls =
  'w-full rounded-sm border border-border-default px-3 py-2 text-sm text-text outline-none focus-visible:border-brand focus-visible:shadow-[var(--mv-shadow-focus)]';

export function ShootEditor({
  shoot,
  eventTypeOptions,
  tickets,
}: {
  shoot: ShootRow;
  eventTypeOptions: SelectOption[];
  tickets: TicketOption[];
}) {
  const router = useRouter();
  const [saving, startSave] = useTransition();
  const [linking, startLink] = useTransition();
  const [raising, startRaise] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Editable field state (seeded from the live record).
  const [brief, setBrief] = useState(shoot.brief ?? '');
  const [format, setFormat] = useState(shoot.format ?? '');
  const [filmingStatus, setFilmingStatus] = useState(shoot.status ?? '');
  const [filmingDate, setFilmingDate] = useState(shoot.filmingDate ?? '');
  const [filmingLocation, setFilmingLocation] = useState(shoot.filmingLocation ?? '');
  const [productionSupport, setProductionSupport] = useState(shoot.productionSupport ?? '');
  const [rawFiles, setRawFiles] = useState(shoot.rawFiles ?? '');
  const [platforms, setPlatforms] = useState<string[]>(shoot.platforms);
  const [eventTypeId, setEventTypeId] = useState(shoot.eventTypeIds[0] ?? '');
  const [linkTicketId, setLinkTicketId] = useState('');

  const formatOpts: SelectOption[] = useMemo(() => SHOOT_FORMATS.map((f) => ({ value: f, label: f })), []);
  const locationOpts: SelectOption[] = useMemo(() => SHOOT_LOCATIONS.map((l) => ({ value: l, label: l })), []);
  const statusOpts: SelectOption[] = useMemo(() => SHOOT_STATUS_ORDER.map((s) => ({ value: s, label: shortStatus(s) })), []);

  const linkedTickets = useMemo(() => tickets.filter((t) => shoot.ticketIds.includes(t.id)), [tickets, shoot.ticketIds]);
  const linkableOpts: SelectOption[] = useMemo(
    () => tickets.filter((t) => !shoot.ticketIds.includes(t.id)).map((t) => ({ value: t.id, label: t.title })),
    [tickets, shoot.ticketIds],
  );

  // Raise-ticket gate reflects the live (server-fetched) links, not unsaved edits.
  const canRaise = shoot.assetLibraryIds.length > 0 && shoot.eventTypeIds.length > 0;

  function onSave() {
    setMsg(null);
    startSave(async () => {
      const res = await updateShootAction(shoot.id, {
        brief, format, filmingStatus, filmingDate, filmingLocation, productionSupport, rawFiles,
        platforms, eventTypeIds: eventTypeId ? [eventTypeId] : [],
      });
      if (res.ok) { setMsg({ ok: true, text: 'Saved.' }); router.refresh(); }
      else setMsg({ ok: false, text: res.error ?? 'Save failed' });
    });
  }

  function onLink() {
    if (!linkTicketId) return;
    setMsg(null);
    startLink(async () => {
      const res = await linkShootTicket(shoot.id, linkTicketId);
      if (res.ok) { setLinkTicketId(''); router.refresh(); }
      else setMsg({ ok: false, text: res.error ?? 'Link failed' });
    });
  }

  function onRaise() {
    setMsg(null);
    startRaise(async () => {
      const res = await raiseNewPrioTicket(shoot.id);
      if (res.ok) setMsg({ ok: true, text: 'Raised — Airtable is creating the ticket.' });
      else setMsg({ ok: false, text: res.error ?? 'Could not raise ticket' });
    });
  }

  return (
    <div className="grid2" style={{ gridTemplateColumns: '1.4fr 1fr', alignItems: 'start', gap: 18 }}>
      {/* ── Left: brief + details + priority ─────────────────────────────── */}
      <div className="card pad space-y-5">
        <Field label="Brief" hint="What's the shoot, who's in it, and the goal?">
          <textarea className={inputCls} rows={5} value={brief} onChange={(e) => setBrief(e.target.value)} />
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Format">
            <SearchableSelect value={format} onChange={setFormat} options={formatOpts}
              placeholder="Select…" allLabel="No format" searchPlaceholder="Search formats…" width="100%" ariaLabel="Format" />
          </Field>
          <Field label="Filming status">
            <SearchableSelect value={filmingStatus} onChange={setFilmingStatus} options={statusOpts}
              placeholder="Select…" searchPlaceholder="Search statuses…" width="100%" ariaLabel="Filming status" />
          </Field>
          <Field label="📆 Filming date">
            <input type="date" className={inputCls} value={filmingDate ? filmingDate.slice(0, 10) : ''} onChange={(e) => setFilmingDate(e.target.value)} />
          </Field>
          <Field label="📍 Filming location">
            <SearchableSelect value={filmingLocation} onChange={setFilmingLocation} options={locationOpts}
              placeholder="Select…" allLabel="No location" searchPlaceholder="Search locations…" width="100%" ariaLabel="Filming location" />
          </Field>
        </div>

        <Field label="Production support" hint="Tech support (e.g. teleprompter) or props needed to film the asset">
          <textarea className={inputCls} rows={2} value={productionSupport} onChange={(e) => setProductionSupport(e.target.value)} />
        </Field>

        <Field label="Raw files" hint="Link to the raw footage (Frame.io / Drive / etc.)">
          <input type="url" className={inputCls} value={rawFiles} onChange={(e) => setRawFiles(e.target.value)} placeholder="https://…" />
        </Field>

        <Field label="Platforms" hint="Where the finished asset may be published">
          <div className="flex flex-wrap gap-1.5">
            {SHOOT_PLATFORMS.map((p) => {
              const on = platforms.includes(p);
              return (
                <button key={p} type="button" onClick={() => setPlatforms((xs) => (on ? xs.filter((x) => x !== p) : [...xs, p]))}
                  className={cn('rounded-full px-3 py-1 text-xs border transition-colors',
                    on ? 'bg-brand-soft text-brand border-brand' : 'border-border-default text-text-muted hover:bg-bg-muted')}>
                  {on ? '✓ ' : ''}{p}
                </button>
              );
            })}
          </div>
        </Field>

        <Field label="🧩 Event Type" hint="Needed before a new Prio ticket can be raised">
          <SearchableSelect value={eventTypeId} onChange={setEventTypeId} options={eventTypeOptions}
            placeholder="Select an event type…" allLabel="None" searchPlaceholder="Search event types…" width="100%" ariaLabel="Event Type" />
        </Field>

        <div className="divider" style={{ margin: '2px 0' }} />
        <Field label="Priority ranking (manual)" hint="Manager ranking — click a star to set, click it again to clear">
          <ShootStars shootId={shoot.id} value={shoot.priorityRanking} />
        </Field>

        {msg && (
          <div className={`rounded-sm px-4 py-2.5 text-sm ${msg.ok ? 'bg-success-soft text-success-content' : 'bg-danger-soft text-danger'}`}>
            {msg.text}
          </div>
        )}
        <div className="flex justify-end border-t border-border-default pt-4">
          <button type="button" onClick={onSave} disabled={saving}
            className="rounded-sm bg-brand px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-bright disabled:opacity-60">
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>

      {/* ── Right: tickets (linked + link + raise) ───────────────────────── */}
      <div className="space-y-5">
        <div>
          <div className="sec-head" style={{ margin: '0 0 10px' }}><h3>Linked tickets</h3><span className="hint">post-production</span></div>
          {linkedTickets.length ? (
            <div className="vstack">
              {linkedTickets.map((t) => (
                <Link key={t.id} href={`/tickets/${t.id}`} className="vrow" style={{ textDecoration: 'none', color: 'inherit' }}>
                  <div className="vthumb" style={{ background: 'var(--brand)', fontSize: 11 }}>▦</div>
                  <div className="meta"><b>{t.title}</b><span>{t.ticketStatus ?? '—'}</span></div>
                  <Icon name="arrow" size={16} />
                </Link>
              ))}
            </div>
          ) : (
            <div className="empty" style={{ padding: 18, textAlign: 'center', fontSize: 13 }}>
              {shoot.ticketCount ? `${shoot.ticketCount} linked ticket(s), none currently active.` : 'No production tickets linked yet.'}
            </div>
          )}
        </div>

        <div className="card pad space-y-4">
          <Field label="Link an existing ticket" hint="Attach a Prio Request that already exists">
            <div className="flex gap-2">
              <SearchableSelect value={linkTicketId} onChange={setLinkTicketId} options={linkableOpts}
                placeholder="Select a ticket…" searchPlaceholder="Search tickets…" width="100%" ariaLabel="Link ticket" />
              <button type="button" onClick={onLink} disabled={!linkTicketId || linking}
                className="rounded-sm border border-border-default px-3 py-2 text-sm font-medium text-text hover:bg-bg-muted disabled:opacity-50 whitespace-nowrap">
                {linking ? 'Linking…' : 'Link'}
              </button>
            </div>
          </Field>

          <div className="divider" style={{ margin: '2px 0' }} />

          <div className="space-y-1.5">
            <label className={cn('flex items-start gap-2 text-sm', canRaise ? 'text-text cursor-pointer' : 'text-text-subtle cursor-not-allowed')}>
              <input type="checkbox" className="mt-0.5" disabled={!canRaise || raising || shoot.newPrioTicket}
                checked={shoot.newPrioTicket} onChange={() => onRaise()} />
              <span>
                Raise a new Prio ticket
                <span className="block text-xs text-text-muted">
                  {shoot.newPrioTicket
                    ? 'Raised — the ticket is being created in Airtable.'
                    : canRaise
                      ? 'Ticks the “New Prio Ticket” box; Airtable creates the ticket.'
                      : 'Link an Asset Library entry and an Event Type first.'}
                </span>
              </span>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
