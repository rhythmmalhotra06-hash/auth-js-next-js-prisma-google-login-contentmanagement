'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/Badge';
import { Kpi, KpiGrid } from '@/components/ui/Kpi';
import { Icon } from '@/components/ui/Icon';
import { cn } from '@/lib/cn';
import {
  type ShootRow, SHOOT_FORMATS, SHOOT_STATUS, SHOOT_STATUS_ORDER, SHOOT_STATUS_TONE,
  shortStatus, isToFilmInStudioTime, STUDIO_TIME_SINCE,
} from '@/lib/shoots/constants';

type ViewKind = 'studio' | 'all' | 'custom';
interface ViewState {
  view: ViewKind;
  status: string;
  format: string;
  hasDate: '' | 'yes' | 'no';
  createdAfter: string;
}
const DEFAULT: ViewState = { view: 'studio', status: '', format: '', hasDate: '', createdAfter: STUDIO_TIME_SINCE };
const STORAGE_KEY = 'tableview:shoots';

function matches(s: ShootRow, f: ViewState): boolean {
  if (f.view === 'studio' && !isToFilmInStudioTime(s)) return false;
  if (f.view === 'custom' && f.createdAfter && !(s.createdTime > f.createdAfter)) return false;
  if (f.status && s.status !== f.status) return false;
  if (f.format && s.format !== f.format) return false;
  if (f.hasDate === 'yes' && !s.filmingDate) return false;
  if (f.hasDate === 'no' && s.filmingDate) return false;
  return true;
}

export function ShootsBoard({ rows, employeeNames }: { rows: ShootRow[]; employeeNames: Record<string, string> }) {
  const [f, setF] = useState<ViewState>(DEFAULT);
  const [hydrated, setHydrated] = useState(false);

  // Hydrate saved view after mount (SSR-safe).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setF({ ...DEFAULT, ...JSON.parse(raw) });
    } catch { /* ignore */ }
    setHydrated(true);
  }, []);
  useEffect(() => {
    if (hydrated) try { localStorage.setItem(STORAGE_KEY, JSON.stringify(f)); } catch { /* ignore */ }
  }, [f, hydrated]);

  const awaiting = rows.filter((s) => s.status === SHOOT_STATUS.needsReview).length;
  const inQueue = rows.filter((s) => s.status === SHOOT_STATUS.toFilm || s.status === SHOOT_STATUS.approved).length;
  const filmed = rows.filter((s) => s.status === SHOOT_STATUS.filmed).length;

  const matched = useMemo(() => rows.filter((s) => matches(s, f)), [rows, f]);
  const groups = useMemo(
    () => SHOOT_STATUS_ORDER.map((st) => ({ status: st, items: matched.filter((s) => s.status === st) })).filter((g) => g.items.length),
    [matched],
  );

  function setView(view: ViewKind) {
    setF((p) => (view === 'custom' ? { ...p, view } : { ...DEFAULT, view, createdAfter: p.createdAfter }));
  }

  const pill = (view: ViewKind, label: React.ReactNode) => (
    <button type="button" onClick={() => setView(view)} className={cn('chipbtn', f.view === view && 'on')}>
      {label}
    </button>
  );
  const hasFilters = !!(f.status || f.format || f.hasDate);

  return (
    <>
      <KpiGrid>
        <Kpi tone="alert" label="Awaiting Vishen" value={awaiting} sub="needs review" i={0} />
        <Kpi label="In studio queue" value={inQueue} sub="approved / to film" i={1} />
        <Kpi label="Filmed" value={filmed} i={2} />
      </KpiGrid>

      <div className="row-between" style={{ margin: '4px 0 10px' }}>
        <h3 style={{ fontSize: 15 }}>Shoot queue</h3>
        <Link href="/shoots/new" className="btn primary" style={{ textDecoration: 'none' }}>
          <Icon name="plus" size={15} /> New shoot request
        </Link>
      </div>

      <div className="sortchips" style={{ marginBottom: 12 }}>
        {pill('studio', <><Icon name="video" size={13} /> To Film in Studio Time</>)}
        {pill('all', 'All shoots')}
        {pill('custom', <><Icon name="sliders" size={13} /> Custom view</>)}
      </div>

      {f.view === 'studio' && (
        <p className="subtle" style={{ fontSize: 12, margin: '-4px 0 12px' }}>
          Showing shoots created after <b>31 May 2026</b> with a filming date set — the live studio-time list.
        </p>
      )}

      <div className="filters">
        <select value={f.status} onChange={(e) => setF((p) => ({ ...p, status: e.target.value }))}>
          <option value="">All statuses</option>
          {SHOOT_STATUS_ORDER.map((s) => <option key={s} value={s}>{shortStatus(s)}</option>)}
        </select>
        <select value={f.format} onChange={(e) => setF((p) => ({ ...p, format: e.target.value }))}>
          <option value="">All formats</option>
          {SHOOT_FORMATS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={f.hasDate} onChange={(e) => setF((p) => ({ ...p, hasDate: e.target.value as ViewState['hasDate'] }))}>
          <option value="">Any filming date</option>
          <option value="yes">Has filming date</option>
          <option value="no">No date yet</option>
        </select>
        {f.view === 'custom' && (
          <label className="subtle" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
            Created after
            <input type="date" value={f.createdAfter} onChange={(e) => setF((p) => ({ ...p, createdAfter: e.target.value }))} style={{ width: 'auto' }} />
          </label>
        )}
        {hasFilters && (
          <button className="btn sm ghost" onClick={() => setF((p) => ({ ...p, status: '', format: '', hasDate: '' }))}>Clear</button>
        )}
        <span className="subtle" style={{ fontSize: 12, marginLeft: 'auto' }}>{matched.length} of {rows.length}</span>
      </div>

      {matched.length === 0 ? (
        <div className="empty" style={{ padding: 34, textAlign: 'center' }}>
          No shoots match this view. Try <b>All shoots</b> or widen the filters.
        </div>
      ) : (
        groups.map((g) => (
          <div key={g.status}>
            <div className="sec-head" style={{ margin: '14px 0 8px' }}>
              <h3 style={{ fontSize: 13 }}><Badge tone={SHOOT_STATUS_TONE[g.status] ?? 'neutral'}>{shortStatus(g.status)}</Badge></h3>
              <span className="hint">{g.items.length}</span>
            </div>
            <div className="stack">
              {g.items.map((s) => {
                const meta = [
                  s.requestedById ? employeeNames[s.requestedById] : null,
                  s.format,
                  s.filmingDate ? `📆 ${s.filmingDate}` : null,
                  s.filmingLocation,
                ].filter(Boolean).join(' · ');
                return (
                  <Link key={s.id} href={`/shoots/${s.id}`} className="mrow" style={{ textDecoration: 'none', color: 'inherit' }}>
                    <div className="thumb"><Icon name="video" size={20} /></div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <b style={{ fontSize: 13.5 }}>{s.title || '(untitled shoot)'}</b>
                      <div className="t-meta">{meta || (s.filmingDate ? '' : 'no date yet')}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      <Badge tone={SHOOT_STATUS_TONE[s.status ?? ''] ?? 'neutral'}>{shortStatus(s.status)}</Badge>
                      <span className="muted" style={{ fontSize: 12, width: 92, textAlign: 'right' }}>
                        {s.ticketCount ? `feeds ${s.ticketCount} ticket${s.ticketCount > 1 ? 's' : ''}` : '—'}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        ))
      )}
    </>
  );
}
