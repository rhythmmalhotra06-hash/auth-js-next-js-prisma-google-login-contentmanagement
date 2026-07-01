'use client';

import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/cn';
import { TicketStatusBadge, PrioStatusBadge } from '@/components/ui/Badge';
import { TierBadge } from '@/components/ui/TierBadge';
import { Icon } from '@/components/ui/Icon';
import { useTableView, type ColumnDef } from '@/components/ui/table/useTableView';
import { SortableTh } from '@/components/ui/table/SortableTh';
import { ColumnsMenu } from '@/components/ui/table/ColumnsMenu';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { StarRating } from '@/components/studio/StarRating';
import { AssigneeUpdater } from '@/components/tickets/AssigneeUpdater';
import { loadMap, riskOf } from '@/lib/tickets/intel';
import { tierForEvent } from '@/lib/tickets/tiers';
import type { QueueTicket } from '@/lib/tickets/data';
import type { ScoringConfig } from '@/lib/scoring-config/config';

// Filterable, sortable, configurable queue table — ported to the prototype `.list`
// look. Mandated first five columns (CLAUDE.md §7): Title · Priority · Assigned ·
// Ticket Status · Priority Status — those are locked (always visible, always first).
// Sorting reorders rows only; optional columns append to the right when revealed.

type Dim = 'prioStatus' | 'ticketStatus' | 'eventType' | 'assetType' | 'typeOfRequest' | 'officialCalendar';
const FILTERS: { key: Dim; label: string }[] = [
  { key: 'eventType', label: 'All event types' },
  { key: 'assetType', label: 'All asset types' },
  { key: 'officialCalendar', label: 'All campaigns' },
  { key: 'prioStatus', label: 'All priority statuses' },
  { key: 'typeOfRequest', label: 'All request types' },
];

const EMPTY_SEL: Record<Dim, string> = {
  prioStatus: '', ticketStatus: '', eventType: '', assetType: '', typeOfRequest: '', officialCalendar: '',
};

const uniq = (rows: QueueTicket[], key: Dim) =>
  [...new Set(rows.map((r) => r[key]).filter((v): v is string => !!v))].sort((a, b) => a.localeCompare(b));

const TICKET_ORDER = ['Backlog', 'To Do', 'In Progress', 'In Revision', 'Review', 'Approved', 'Shipping', 'Done', "Won't Do"];
const orderIdx = (s: string) => { const i = TICKET_ORDER.indexOf(s); return i === -1 ? TICKET_ORDER.length : i; };
const lower = (v: string | null) => (v ?? '').toLowerCase();
const priorityVal = (t: QueueTicket) => Number(t.queueRank ?? t.priorityScore ?? 0);

const COLUMNS: ColumnDef<QueueTicket>[] = [
  { key: 'title', label: 'Title', locked: true, sortable: true, width: 300, sortAccessor: (t) => lower(t.title) },
  { key: 'priority', label: 'Priority', locked: true, sortable: true, numeric: true, width: 120, sortAccessor: priorityVal },
  { key: 'assigned', label: 'Assigned', locked: true, sortable: true, width: 150, sortAccessor: (t) => lower(t.assignee) },
  { key: 'ticketStatus', label: 'Ticket status', locked: true, sortable: true, width: 130, sortAccessor: (t) => orderIdx(t.ticketStatus ?? '') },
  { key: 'prioStatus', label: 'Priority status', locked: true, sortable: true, width: 150, sortAccessor: (t) => lower(t.prioStatus) },
  { key: 'eventType', label: 'Event type', sortable: true, width: 150, sortAccessor: (t) => lower(t.eventType) },
  { key: 'assetType', label: 'Asset type', sortable: true, width: 150, sortAccessor: (t) => lower(t.assetType) },
  { key: 'dueDate', label: 'Due date', sortable: true, numeric: true, width: 110, sortAccessor: (t) => (t.dueDate ? new Date(t.dueDate).getTime() : null) },
  { key: 'requester', label: 'Requester', sortable: true, width: 150, sortAccessor: (t) => lower(t.requester) },
  { key: 'campaign', label: 'Campaign', sortable: true, width: 160, sortAccessor: (t) => lower(t.officialCalendar) },
  { key: 'typeOfRequest', label: 'Request type', sortable: true, width: 150, sortAccessor: (t) => lower(t.typeOfRequest) },
];

// Unassigned rows in the manager view show a gold "Assign" pill (gold = attention);
// clicking it reveals the existing assignee picker inline, without leaving the queue.
function InlineAssign({ ticketId, assignees }: { ticketId: string; assignees: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button type="button" className="btn sm gold" style={{ borderRadius: 'var(--r-full)' }}
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}>
        Assign
      </button>
    );
  }
  return (
    <span onClick={(e) => e.stopPropagation()}>
      <AssigneeUpdater ticketId={ticketId} current={null} employees={assignees} />
    </span>
  );
}

function dueChip(due: string | null) {
  if (!due) return null;
  const d = Math.ceil((new Date(due).getTime() - Date.now()) / 86400000);
  if (Number.isNaN(d)) return null;
  if (d < 0) return <span className="due far">overdue</span>;
  const cls = d <= 2 ? 'soon' : d <= 6 ? 'mid' : 'far';
  return <span className={`due ${cls}`}>due {d}d</span>;
}

export function QueueTable({ tickets, basePath = '/tickets', storageKey = 'queue', scoringConfig, editableRank = false, showRank = false, assignees, initialFilters }: { tickets: QueueTicket[]; basePath?: string; storageKey?: string; scoringConfig?: ScoringConfig; editableRank?: boolean; showRank?: boolean; assignees?: { id: string; name: string }[]; initialFilters?: Partial<Record<Dim, string>> }) {
  const router = useRouter();
  const tableRef = useRef<HTMLTableElement>(null);
  const colRefs = useRef<Record<string, HTMLTableColElement | null>>({});
  const [sel, setSel] = useState<Record<Dim, string>>(() => {
    const base = { ...EMPTY_SEL };
    for (const k of Object.keys(base) as Dim[]) { const v = initialFilters?.[k]; if (v) base[k] = v; }
    return base;
  });
  const [q, setQ] = useState('');

  // A leading "#" position column (manager view). It's a non-data ornament that sits
  // *before* the mandated five — it never reorders or replaces them.
  const columns = useMemo<ColumnDef<QueueTicket>[]>(
    () => (showRank ? [{ key: 'rank', label: '#', locked: true, sortable: false, width: 52 }, ...COLUMNS] : COLUMNS),
    [showRank],
  );
  const view = useTableView({ columns, storageKey });

  // Faceted options: each filter only offers values that exist under the
  // currently selected status + other filters — so picking a status narrows
  // every other dropdown. A filter's own selection is ignored when computing
  // its own list, so the chosen value never disappears from it.
  const options = useMemo(
    () => Object.fromEntries(FILTERS.map((f) => {
      const scoped = tickets.filter((t) =>
        (Object.keys(sel) as Dim[]).every((k) => k === f.key || !sel[k] || t[k] === sel[k]),
      );
      return [f.key, uniq(scoped, f.key)];
    })) as Record<Dim, string[]>,
    [tickets, sel],
  );
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return tickets.filter((t) =>
      (Object.keys(sel) as Dim[]).every((k) => !sel[k] || t[k] === sel[k]) &&
      (!needle || t.title.toLowerCase().includes(needle)),
    );
  }, [tickets, sel, q]);
  const rows = useMemo(() => view.sortRows(filtered), [view, filtered]);

  const load = useMemo(() => loadMap(tickets, scoringConfig), [tickets, scoringConfig]);
  const funnel = useMemo(() => {
    const scoped = tickets.filter((t) => FILTERS.every((f) => !sel[f.key] || t[f.key] === sel[f.key]));
    const counts = new Map<string, number>();
    for (const t of scoped) { const s = t.ticketStatus; if (s) counts.set(s, (counts.get(s) ?? 0) + 1); }
    return [...counts.entries()].sort((a, b) => orderIdx(a[0]) - orderIdx(b[0])).map(([status, count]) => ({ status, count }));
  }, [tickets, sel]);

  const activeFilters = (Object.keys(sel) as Dim[]).filter((k) => sel[k]).length;

  // Live column resize: mutate the <col> + table width directly during the drag
  // (no React re-render per move), then commit the final width to state on release.
  function startResize(key: string, e: React.PointerEvent<HTMLElement>) {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startW = view.widthOf(key);
    const baseTotal = view.visibleColumns.reduce((sum, c) => sum + view.widthOf(c.key), 0);
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
      view.setWidth(key, compute(ev));
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }

  const tableWidth = view.visibleColumns.reduce((sum, c) => sum + view.widthOf(c.key), 0);

  function cell(key: string, t: QueueTicket, r: ReturnType<typeof riskOf>) {
    switch (key) {
      case 'title':
        return (
          <td key={key}>
            <div className="t-title">{t.title}</div>
            <div className="t-meta">
              <TierBadge event={t.eventType} /> <span>{t.assetType ?? '—'}</span>
              {r.level && (
                <span className={`risk ${r.level}`} title={r.why.join(' · ')}>
                  <Icon name="clock" size={11} /> {r.level === 'high' ? 'at risk' : 'watch'}
                </span>
              )}
            </div>
          </td>
        );
      case 'priority':
        return editableRank
          ? <td key={key}><StarRating ticketId={t.id} value={t.queueRank} /> {dueChip(t.dueDate)}</td>
          : <td key={key}><span className="score">{t.queueRank ?? t.priorityScore ?? '—'}</span> {dueChip(t.dueDate)}</td>;
      case 'assigned':
        if (t.assignee) return <td key={key}>{t.assignee}</td>;
        return (
          <td key={key}>
            {assignees && assignees.length > 0
              ? <InlineAssign ticketId={t.id} assignees={assignees} />
              : <span className="subtle">Unassigned</span>}
          </td>
        );
      case 'ticketStatus':
        return <td key={key}><TicketStatusBadge status={t.ticketStatus} /></td>;
      case 'prioStatus':
        return <td key={key}><PrioStatusBadge status={t.prioStatus} /></td>;
      case 'eventType':
        return <td key={key}>{t.eventType ?? <span className="subtle">—</span>}</td>;
      case 'assetType':
        return <td key={key}>{t.assetType ?? <span className="subtle">—</span>}</td>;
      case 'dueDate':
        return <td key={key}>{t.dueDate ?? <span className="subtle">—</span>}</td>;
      case 'requester':
        return <td key={key}>{t.requester ?? <span className="subtle">—</span>}</td>;
      case 'campaign':
        return <td key={key}>{t.officialCalendar ?? <span className="subtle">—</span>}</td>;
      case 'typeOfRequest':
        return <td key={key}>{t.typeOfRequest ?? <span className="subtle">—</span>}</td>;
      default:
        return <td key={key} />;
    }
  }

  return (
    <div>
      {funnel.length > 0 && (
        <div className="sortchips" style={{ marginBottom: 14 }}>
          {funnel.map(({ status, count }) => (
            <button key={status} className={cn('chipbtn', sel.ticketStatus === status && 'on')}
              onClick={() => setSel((s) => ({ ...s, ticketStatus: s.ticketStatus === status ? '' : status }))}>
              <b style={{ fontVariantNumeric: 'tabular-nums' }}>{count}</b> {status}
            </button>
          ))}
        </div>
      )}

      <div className="filters">
        <input className="qsearch" type="search" placeholder="Search tickets…" value={q} onChange={(e) => setQ(e.target.value)}
          style={{ width: 220, flex: '0 1 220px' }} aria-label="Search tickets by title" />
        {FILTERS.map((f) => (
          <SearchableSelect key={f.key} value={sel[f.key]} allLabel={f.label} placeholder={f.label}
            ariaLabel={f.label} searchPlaceholder="Search…"
            options={options[f.key].map((o) => ({ value: o, label: o }))}
            onChange={(v) => setSel((s) => ({ ...s, [f.key]: v }))} />
        ))}
        {(activeFilters > 0 || q) && (
          <button className="btn sm ghost" onClick={() => { setSel({ ...EMPTY_SEL }); setQ(''); }}>
            Clear{activeFilters > 0 ? ` (${activeFilters})` : ''}
          </button>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="subtle" style={{ fontSize: 12 }}>{rows.length} of {tickets.length}</span>
          <ColumnsMenu columns={COLUMNS} isVisible={view.isVisible} onToggle={view.toggleColumn} onReset={view.reset} hiddenCount={view.hiddenCount} />
        </div>
      </div>

      {/* Mobile (≤560px): stacked cards showing the mandated five fields. Same rows,
          same click-through; the desktop table below is hidden at this width. */}
      <div className="queue-cards">
        {rows.map((t) => {
          const r = riskOf(t, load, scoringConfig);
          return (
            <div key={t.id} className={cn('qcard', `tier-${tierForEvent(t.eventType)}`, !t.assignee && 'attn')}
              onClick={() => router.push(`${basePath}/${t.id}`)}>
              <div className="qc-title">{t.title}</div>
              <div className="qc-meta">
                <TierBadge event={t.eventType} /> <span className="subtle">{t.assetType ?? '—'}</span>
                {r.level && (
                  <span className={`risk ${r.level}`} title={r.why.join(' · ')}>
                    <Icon name="clock" size={11} /> {r.level === 'high' ? 'at risk' : 'watch'}
                  </span>
                )}
                {dueChip(t.dueDate)}
              </div>
              <div className="qc-fields">
                <span className="qc-k">Priority</span>
                <span className="qc-v" onClick={editableRank ? (e) => e.stopPropagation() : undefined}>
                  {editableRank
                    ? <StarRating ticketId={t.id} value={t.queueRank} />
                    : <span className="score">{t.queueRank ?? t.priorityScore ?? '—'}</span>}
                </span>
                <span className="qc-k">Assigned</span>
                <span className="qc-v">
                  {t.assignee
                    ? t.assignee
                    : assignees && assignees.length > 0
                      ? <span onClick={(e) => e.stopPropagation()}><InlineAssign ticketId={t.id} assignees={assignees} /></span>
                      : <span className="subtle">Unassigned</span>}
                </span>
                <span className="qc-k">Ticket</span>
                <span className="qc-v"><TicketStatusBadge status={t.ticketStatus} /></span>
                <span className="qc-k">Priority status</span>
                <span className="qc-v"><PrioStatusBadge status={t.prioStatus} /></span>
              </div>
            </div>
          );
        })}
        {rows.length === 0 && <div className="empty">No requests match these filters.</div>}
      </div>

      <div className="tw has-cards"><div className="tscroll"><table ref={tableRef} className="list" style={{ tableLayout: 'fixed', width: tableWidth, minWidth: tableWidth }}>
        <colgroup>
          {view.visibleColumns.map((c) => (
            <col key={c.key} ref={(el) => { colRefs.current[c.key] = el; }} style={{ width: view.widthOf(c.key) }} />
          ))}
        </colgroup>
        <thead><tr>
          {view.visibleColumns.map((c) => (
            <SortableTh key={c.key} label={c.label} sortKey={c.key} sort={view.sort}
              onSort={c.sortable ? view.toggleSort : undefined}
              onResizeStart={(e) => startResize(c.key, e)} />
          ))}
        </tr></thead>
        <tbody>
          {rows.map((t, i) => {
            const r = riskOf(t, load, scoringConfig);
            return (
              <tr key={t.id} className={cn(`tier-${tierForEvent(t.eventType)}`, !t.assignee && 'attn')} onClick={() => router.push(`${basePath}/${t.id}`)}>
                {view.visibleColumns.map((c) => (
                  c.key === 'rank'
                    ? <td key="rank" className="rankcell">{i + 1}</td>
                    : cell(c.key, t, r)
                ))}
              </tr>
            );
          })}
          {rows.length === 0 && <tr><td colSpan={view.visibleColumns.length} className="empty">No requests match these filters.</td></tr>}
        </tbody>
      </table></div></div>

      <div className="legend">
        <span style={{ display: 'inline-flex', gap: 7, alignItems: 'center' }}>
          <span className="tier high" style={{ padding: '2px 7px' }}>high</span>
          <span className="tier mid" style={{ padding: '2px 7px' }}>mid</span>
          <span className="tier low" style={{ padding: '2px 7px' }}>lower</span>
        </span>
        <span className="badge b-gold"><span className="dot" />needs attention</span>
        <span className="subtle">Click a column to sort · use Columns to show or hide fields</span>
      </div>
    </div>
  );
}
