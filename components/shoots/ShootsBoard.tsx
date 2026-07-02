'use client';

import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { cn } from '@/lib/cn';
import { Badge } from '@/components/ui/Badge';
import { Kpi, KpiGrid } from '@/components/ui/Kpi';
import { Icon } from '@/components/ui/Icon';
import { useTableView, type ColumnDef } from '@/components/ui/table/useTableView';
import { SortableTh } from '@/components/ui/table/SortableTh';
import { ColumnsMenu } from '@/components/ui/table/ColumnsMenu';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import {
  type ShootRow, SHOOT_STATUS, SHOOT_STATUS_ORDER, SHOOT_STATUS_TONE, shortStatus,
} from '@/lib/shoots/constants';

// Grid view for the shoot queue — mirrors the ticket QueueTable (sortable/resizable/
// configurable columns + dropdown filters), so the dense shoot list is scannable.

interface ShootView extends ShootRow { requester: string | null }

type ViewKind = 'all' | 'custom';
type Dim = 'status' | 'format' | 'filmingLocation' | 'requester';

// KPI → the statuses each headline card represents. Clicking a card filters the grid
// to exactly these statuses (and, where it's a single status, mirrors it into the
// Status dropdown so the active filter reads back).
type Stage = 'awaiting' | 'inQueue' | 'filmed';
const STAGE_STATUSES: Record<Stage, string[]> = {
  awaiting: [SHOOT_STATUS.needsReview],
  inQueue: [SHOOT_STATUS.toFilm, SHOOT_STATUS.approved],
  filmed: [SHOOT_STATUS.filmed],
};

const FILTERS: { key: Dim; label: string }[] = [
  { key: 'status', label: 'All statuses' },
  { key: 'format', label: 'All formats' },
  { key: 'filmingLocation', label: 'All locations' },
  { key: 'requester', label: 'All requesters' },
];

const lower = (v: string | null) => (v ?? '').toLowerCase();
const dateVal = (v: string | null) => (v ? new Date(v).getTime() : null);
const shortDate = (v: string | null) => {
  const t = v ? Date.parse(v) : NaN;
  return Number.isNaN(t) ? null : new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};
const uniq = (rows: ShootView[], key: Dim) =>
  [...new Set(rows.map((r) => r[key]).filter((v): v is string => !!v))].sort((a, b) => a.localeCompare(b));

const COLUMNS: ColumnDef<ShootView>[] = [
  { key: 'title', label: 'Title', locked: true, sortable: true, width: 280, sortAccessor: (s) => lower(s.title) },
  { key: 'status', label: 'Status', locked: true, sortable: true, width: 150, sortAccessor: (s) => SHOOT_STATUS_ORDER.indexOf(s.status ?? '') },
  { key: 'format', label: 'Format', locked: true, sortable: true, width: 120, sortAccessor: (s) => lower(s.format) },
  { key: 'filmingDate', label: 'Filming date', locked: true, sortable: true, numeric: true, width: 130, sortAccessor: (s) => dateVal(s.filmingDate) },
  { key: 'requester', label: 'Requested by', locked: true, sortable: true, width: 150, sortAccessor: (s) => lower(s.requester) },
  { key: 'filmingLocation', label: 'Location', sortable: true, defaultVisible: true, width: 170, sortAccessor: (s) => lower(s.filmingLocation) },
  { key: 'created', label: 'Date created', sortable: true, numeric: true, defaultVisible: true, width: 140, sortAccessor: (s) => dateVal(s.createdTime) },
  { key: 'feeds', label: 'Feeds tickets', sortable: true, numeric: true, width: 130, sortAccessor: (s) => s.ticketCount },
];

export function ShootsBoard({ rows, employeeNames }: { rows: ShootRow[]; employeeNames: Record<string, string> }) {
  const router = useRouter();
  const tableRef = useRef<HTMLTableElement>(null);
  const colRefs = useRef<Record<string, HTMLTableColElement | null>>({});

  const views: ShootView[] = useMemo(
    () => rows.map((s) => ({ ...s, requester: s.requestedById ? employeeNames[s.requestedById] ?? null : null })),
    [rows, employeeNames],
  );

  const [view, setViewKind] = useState<ViewKind>('all');
  const [createdAfter, setCreatedAfter] = useState('');
  const [sel, setSel] = useState<Record<Dim, string>>({ status: '', format: '', filmingLocation: '', requester: '' });
  const [stage, setStage] = useState<Stage | null>(null);
  const [q, setQ] = useState('');
  const tv = useTableView({ columns: COLUMNS, storageKey: 'shoots' });

  // Click a KPI to scope the grid to its statuses. Single-status stages also drive the
  // Status dropdown so it reads back the selection; multi-status stages clear it.
  const toggleStage = (s: Stage) => {
    setStage((cur) => {
      const next = cur === s ? null : s;
      const statuses = next ? STAGE_STATUSES[next] : [];
      setSel((prev) => ({ ...prev, status: statuses.length === 1 ? statuses[0] : '' }));
      return next;
    });
  };

  const awaiting = views.filter((s) => s.status === SHOOT_STATUS.needsReview).length;
  const inQueue = views.filter((s) => s.status === SHOOT_STATUS.toFilm || s.status === SHOOT_STATUS.approved).length;
  const filmed = views.filter((s) => s.status === SHOOT_STATUS.filmed).length;

  const options = useMemo(
    () => Object.fromEntries(FILTERS.map((f) => [f.key, uniq(views, f.key)])) as Record<Dim, string[]>,
    [views],
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return views.filter((s) => {
      if (view === 'custom' && createdAfter && !(s.createdTime > createdAfter)) return false;
      if (stage && !STAGE_STATUSES[stage].includes(s.status ?? '')) return false;
      if (!(Object.keys(sel) as Dim[]).every((k) => !sel[k] || s[k] === sel[k])) return false;
      if (needle && !(s.title ?? '').toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [views, view, createdAfter, stage, sel, q]);
  const sorted = useMemo(() => tv.sortRows(filtered), [tv, filtered]);

  const activeFilters = (Object.keys(sel) as Dim[]).filter((k) => sel[k]).length;

  function startResize(key: string, e: React.PointerEvent<HTMLElement>) {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startW = tv.widthOf(key);
    const baseTotal = tv.visibleColumns.reduce((sum, c) => sum + tv.widthOf(c.key), 0);
    const col = colRefs.current[key];
    const table = tableRef.current;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    const compute = (ev: PointerEvent) => Math.max(80, Math.min(640, startW + (ev.clientX - startX)));
    const onMove = (ev: PointerEvent) => {
      const w = compute(ev);
      if (col) col.style.width = `${w}px`;
      if (table) { const total = baseTotal - startW + w; table.style.width = `${total}px`; table.style.minWidth = `${total}px`; }
    };
    const onUp = (ev: PointerEvent) => {
      tv.setWidth(key, compute(ev));
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }

  const tableWidth = tv.visibleColumns.reduce((sum, c) => sum + tv.widthOf(c.key), 0);

  function cell(key: string, s: ShootView) {
    switch (key) {
      case 'title':
        return <td key={key}><div className="t-title">{s.title || '(untitled shoot)'}</div></td>;
      case 'status':
        return <td key={key}><Badge tone={SHOOT_STATUS_TONE[s.status ?? ''] ?? 'neutral'}>{shortStatus(s.status)}</Badge></td>;
      case 'format':
        return <td key={key}>{s.format ?? <span className="subtle">—</span>}</td>;
      case 'filmingDate':
        return <td key={key}>{shortDate(s.filmingDate) ?? <span className="subtle">no date</span>}</td>;
      case 'requester':
        return <td key={key}>{s.requester ?? <span className="subtle">—</span>}</td>;
      case 'filmingLocation':
        return <td key={key}>{s.filmingLocation ?? <span className="subtle">—</span>}</td>;
      case 'created':
        return <td key={key}>{shortDate(s.createdTime) ?? <span className="subtle">—</span>}</td>;
      case 'feeds':
        return <td key={key}>{s.ticketCount ? `${s.ticketCount} ticket${s.ticketCount > 1 ? 's' : ''}` : <span className="subtle">—</span>}</td>;
      default:
        return <td key={key} />;
    }
  }

  const pill = (kind: ViewKind, label: React.ReactNode) => (
    <button type="button" onClick={() => setViewKind(kind)} className={cn('chipbtn', view === kind && 'on')}>{label}</button>
  );

  return (
    <>
      <KpiGrid>
        <Kpi tone="alert" label="Awaiting Vishen" value={awaiting} sub="needs review" i={0}
          onClick={() => toggleStage('awaiting')} active={stage === 'awaiting'} />
        <Kpi label="In studio queue" value={inQueue} sub="approved / to film" i={1}
          onClick={() => toggleStage('inQueue')} active={stage === 'inQueue'} />
        <Kpi label="Filmed" value={filmed} i={2}
          onClick={() => toggleStage('filmed')} active={stage === 'filmed'} />
      </KpiGrid>

      <div className="row-between" style={{ margin: '4px 0 10px' }}>
        <h3 style={{ fontSize: 15 }}>Shoot queue</h3>
        <Link href="/shoots/new" className="btn primary" style={{ textDecoration: 'none' }}>
          <Icon name="plus" size={15} /> New shoot request
        </Link>
      </div>

      <div className="sortchips" style={{ marginBottom: 12 }}>
        {pill('all', 'All shoots')}
        {pill('custom', <><Icon name="sliders" size={13} /> Custom view</>)}
      </div>

      <div className="filters">
        <input className="qsearch" type="search" placeholder="Search shoots…" value={q} onChange={(e) => setQ(e.target.value)}
          style={{ width: 200, flex: '0 1 200px' }} aria-label="Search shoots by title" />
        {FILTERS.map((f) => (
          <SearchableSelect key={f.key} value={sel[f.key]} allLabel={f.label} placeholder={f.label} ariaLabel={f.label}
            searchPlaceholder="Search…"
            options={options[f.key].map((o) => ({ value: o, label: f.key === 'status' ? shortStatus(o) : o }))}
            onChange={(v) => {
              // A manual Status change overrides any KPI stage so the highlight stays honest.
              if (f.key === 'status') setStage(v === SHOOT_STATUS.needsReview ? 'awaiting' : v === SHOOT_STATUS.filmed ? 'filmed' : null);
              setSel((s) => ({ ...s, [f.key]: v }));
            }} />
        ))}
        {view === 'custom' && (
          <label className="subtle" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
            Created after
            <input type="date" value={createdAfter} onChange={(e) => setCreatedAfter(e.target.value)} style={{ width: 'auto' }} />
          </label>
        )}
        {(activeFilters > 0 || q || stage) && (
          <button className="btn sm ghost" onClick={() => { setSel({ status: '', format: '', filmingLocation: '', requester: '' }); setStage(null); setQ(''); }}>
            Clear{activeFilters > 0 ? ` (${activeFilters})` : ''}
          </button>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="subtle" style={{ fontSize: 12 }}>{sorted.length} of {rows.length}</span>
          <ColumnsMenu columns={COLUMNS} isVisible={tv.isVisible} onToggle={tv.toggleColumn} onReset={tv.reset} hiddenCount={tv.hiddenCount} />
        </div>
      </div>

      <div className="tw"><div className="tscroll"><table ref={tableRef} className="list" style={{ tableLayout: 'fixed', width: tableWidth, minWidth: tableWidth }}>
        <colgroup>
          {tv.visibleColumns.map((c) => (
            <col key={c.key} ref={(el) => { colRefs.current[c.key] = el; }} style={{ width: tv.widthOf(c.key) }} />
          ))}
        </colgroup>
        <thead><tr>
          {tv.visibleColumns.map((c) => (
            <SortableTh key={c.key} label={c.label} sortKey={c.key} sort={tv.sort}
              onSort={c.sortable ? tv.toggleSort : undefined} onResizeStart={(e) => startResize(c.key, e)} />
          ))}
        </tr></thead>
        <tbody>
          {sorted.map((s) => (
            <tr key={s.id} onClick={() => router.push(`/shoots/${s.id}`)}>
              {tv.visibleColumns.map((c) => cell(c.key, s))}
            </tr>
          ))}
          {sorted.length === 0 && (
            <tr><td colSpan={tv.visibleColumns.length} className="empty">No shoots match this view. Try <b>All shoots</b> or widen the filters.</td></tr>
          )}
        </tbody>
      </table></div></div>

      <div className="legend">
        <span className="subtle">Click a column to sort · use Columns to show or hide fields</span>
      </div>
    </>
  );
}
