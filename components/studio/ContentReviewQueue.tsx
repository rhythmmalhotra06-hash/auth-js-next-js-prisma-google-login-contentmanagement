'use client';

import { useMemo, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { TicketStatusBadge } from '@/components/ui/Badge';
import { Icon } from '@/components/ui/Icon';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { useTableView, type ColumnDef } from '@/components/ui/table/useTableView';
import { SortableTh } from '@/components/ui/table/SortableTh';
import { ColumnsMenu } from '@/components/ui/table/ColumnsMenu';
import { starString } from '@/lib/studio/format';
import { approveContentReview, sendBackContentReview } from '@/app/studio/actions';
import type { ContentReviewItem } from '@/lib/studio/data';

// Vishen's sign-off queue: work in Review / In Revision, rendered as an Airtable-like
// grid. Defaults to Video requests only (design goes through a different reviewer),
// group by any field, sort + resize every column, and approve / send back inline.

const lower = (v: string | null) => (v ?? '').toLowerCase();

const TICKET_ORDER = ['Review', 'In Revision'];
const statusIdx = (s: string) => { const i = TICKET_ORDER.indexOf(s); return i === -1 ? TICKET_ORDER.length : i; };

// Dimensions the queue can filter by.
type Dim = 'typeOfRequest' | 'assignee' | 'event' | 'assetType' | 'ticketStatus';
const FILTERS: { key: Dim; label: string }[] = [
  { key: 'typeOfRequest', label: 'All request types' },
  { key: 'assignee', label: 'All editors' },
  { key: 'event', label: 'All event types' },
  { key: 'assetType', label: 'All asset types' },
];
const EMPTY_SEL: Record<Dim, string> = { typeOfRequest: '', assignee: '', event: '', assetType: '', ticketStatus: '' };

// Fields the user can group rows by, Airtable-style. `None` renders one flat list.
const GROUP_OPTIONS: { key: '' | Dim; label: string }[] = [
  { key: 'ticketStatus', label: 'Ticket status' },
  { key: 'typeOfRequest', label: 'Request type' },
  { key: 'event', label: 'Event type' },
  { key: 'assetType', label: 'Asset type' },
  { key: 'assignee', label: 'Editor' },
  { key: '', label: 'No grouping' },
];

const GROUP_FALLBACK: Record<Dim, string> = {
  ticketStatus: '—', typeOfRequest: 'Unspecified', event: 'No event', assetType: '—', assignee: 'Unassigned',
};
const groupValueOf = (it: ContentReviewItem, key: Dim) => it[key] ?? GROUP_FALLBACK[key];

const uniq = (items: ContentReviewItem[], key: Dim) =>
  [...new Set(items.map((i) => i[key]).filter((v): v is string => !!v))].sort((a, b) => a.localeCompare(b));

const COLUMNS: ColumnDef<ContentReviewItem>[] = [
  { key: 'title', label: 'Title', locked: true, sortable: true, width: 300, sortAccessor: (i) => lower(i.title) },
  { key: 'priority', label: 'Priority', locked: true, sortable: true, numeric: true, width: 120, sortAccessor: (i) => i.rank ?? 0 },
  { key: 'assignee', label: 'Assigned', locked: true, sortable: true, width: 150, sortAccessor: (i) => lower(i.assignee) },
  { key: 'ticketStatus', label: 'Status', locked: true, sortable: true, width: 120, sortAccessor: (i) => statusIdx(i.ticketStatus) },
  { key: 'typeOfRequest', label: 'Request type', sortable: true, defaultVisible: true, width: 130, sortAccessor: (i) => lower(i.typeOfRequest) },
  { key: 'event', label: 'Event type', sortable: true, defaultVisible: true, width: 160, sortAccessor: (i) => lower(i.event) },
  { key: 'assetType', label: 'Asset type', sortable: true, defaultVisible: true, width: 150, sortAccessor: (i) => lower(i.assetType) },
  { key: 'dueDate', label: 'Due date', sortable: true, numeric: true, width: 110, sortAccessor: (i) => (i.dueDate ? new Date(i.dueDate).getTime() : null) },
  { key: 'actions', label: 'Sign-off', locked: true, width: 200 },
];

function dueChip(due: string | null) {
  if (!due) return null;
  const d = Math.ceil((new Date(due).getTime() - Date.now()) / 86400000);
  if (Number.isNaN(d)) return null;
  if (d < 0) return <span className="due far">overdue</span>;
  const cls = d <= 2 ? 'soon' : d <= 6 ? 'mid' : 'far';
  return <span className={`due ${cls}`}>due {d}d</span>;
}

export function ContentReviewQueue({ items }: { items: ContentReviewItem[] }) {
  const tableRef = useRef<HTMLTableElement>(null);
  const colRefs = useRef<Record<string, HTMLTableColElement | null>>({});
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  // Default to Video — design work is signed off elsewhere.
  const [sel, setSel] = useState<Record<Dim, string>>({ ...EMPTY_SEL, typeOfRequest: 'Video' });
  const [q, setQ] = useState('');
  const [groupBy, setGroupBy] = useState<'' | Dim>('ticketStatus');

  const view = useTableView({ columns: COLUMNS, storageKey: 'review-queue' });

  const options = useMemo(
    () => Object.fromEntries(FILTERS.map((f) => [f.key, uniq(items, f.key)])) as Record<Dim, string[]>,
    [items],
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return items.filter((i) =>
      !hidden.has(i.id) &&
      (Object.keys(sel) as Dim[]).every((k) => !sel[k] || i[k] === sel[k]) &&
      (!needle || i.title.toLowerCase().includes(needle)),
    );
  }, [items, sel, q, hidden]);

  const sorted = useMemo(() => view.sortRows(filtered), [view, filtered]);

  // Bucket into groups (ordered) when a group field is chosen; else one flat group.
  const groups = useMemo(() => {
    if (!groupBy) return [{ label: null as string | null, rows: sorted }];
    const map = new Map<string, ContentReviewItem[]>();
    for (const it of sorted) {
      const key = groupValueOf(it, groupBy);
      (map.get(key) ?? map.set(key, []).get(key)!).push(it);
    }
    const entries = [...map.entries()];
    entries.sort((a, b) =>
      groupBy === 'ticketStatus' ? statusIdx(a[0]) - statusIdx(b[0]) : a[0].localeCompare(b[0]));
    return entries.map(([label, rows]) => ({ label, rows }));
  }, [sorted, groupBy]);

  const hide = (id: string) => setHidden((prev) => new Set(prev).add(id));
  const activeFilters = (Object.keys(sel) as Dim[]).filter((k) => sel[k]).length;

  // Live column resize: mutate the <col> + table width during the drag, commit on release.
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
  const colCount = view.visibleColumns.length;

  return (
    <div>
      <div className="filters">
        <input className="qsearch" type="search" placeholder="Search by title…" value={q}
          onChange={(e) => setQ(e.target.value)} style={{ width: 220, flex: '0 1 220px' }} aria-label="Search by title" />
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
          <label className="flab" htmlFor="review-groupby">Group by</label>
          <select id="review-groupby" value={groupBy} onChange={(e) => setGroupBy(e.target.value as '' | Dim)}
            aria-label="Group by field">
            {GROUP_OPTIONS.map((g) => <option key={g.key} value={g.key}>{g.label}</option>)}
          </select>
          <span className="subtle" style={{ fontSize: 12 }}>{filtered.length} of {items.length}</span>
          <ColumnsMenu columns={COLUMNS} isVisible={view.isVisible} onToggle={view.toggleColumn}
            onReset={view.reset} hiddenCount={view.hiddenCount} />
        </div>
      </div>

      <div className="tw"><div className="tscroll"><table ref={tableRef} className="list rq"
        style={{ tableLayout: 'fixed', width: tableWidth, minWidth: tableWidth }}>
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
          {groups.map((g) => (
            <GroupBlock key={g.label ?? '__all'} label={g.label} rows={g.rows} colCount={colCount}
              columns={view.visibleColumns} onDone={hide} />
          ))}
          {filtered.length === 0 && (
            <tr><td colSpan={colCount} className="empty">Nothing awaiting sign-off with these filters.</td></tr>
          )}
        </tbody>
      </table></div></div>

      <div className="legend">
        <span className="subtle">Click a column to sort · drag its edge to resize · use Columns to show or hide fields</span>
      </div>
    </div>
  );
}

function GroupBlock({ label, rows, colCount, columns, onDone }: {
  label: string | null; rows: ContentReviewItem[]; colCount: number;
  columns: ColumnDef<ContentReviewItem>[]; onDone: (id: string) => void;
}) {
  return (
    <>
      {label !== null && (
        <tr className="grouprow">
          <td colSpan={colCount}>
            {label} <span className="grouprow-count">{rows.length}</span>
          </td>
        </tr>
      )}
      {rows.map((it) => <ReviewRow key={it.id} item={it} columns={columns} onDone={() => onDone(it.id)} />)}
    </>
  );
}

function ReviewRow({ item, columns, onDone }: {
  item: ContentReviewItem; columns: ColumnDef<ContentReviewItem>[]; onDone: () => void;
}) {
  const [mode, setMode] = useState<'idle' | 'note'>('idle');
  const [note, setNote] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function approve() {
    setErr(null);
    start(async () => {
      const r = await approveContentReview(item.id);
      if (r.ok) onDone(); else setErr(r.error ?? 'Failed');
    });
  }
  function sendBack() {
    if (!note.trim()) { setErr('Add a note before sending back'); return; }
    setErr(null);
    start(async () => {
      const r = await sendBackContentReview(item.id, note);
      if (r.ok) onDone(); else setErr(r.error ?? 'Failed');
    });
  }

  const subtle = <span className="subtle">—</span>;

  function cell(key: string) {
    switch (key) {
      case 'title':
        return (
          <td key={key}>
            <Link href={`/tickets/${item.id}`} className="t-title st-rowlink">{item.title}</Link>
            {item.folderUrl && (
              <a className="t-meta" href={item.folderUrl} target="_blank" rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()} title="Open asset folder">
                <Icon name="ext" size={11} /> Folder
              </a>
            )}
          </td>
        );
      case 'priority':
        return (
          <td key={key}>
            <span className="st-stars" title="Priority ranking">{starString(item.rank)}</span> {dueChip(item.dueDate)}
          </td>
        );
      case 'assignee':
        return <td key={key}>{item.assignee ?? <span className="subtle">Unassigned</span>}</td>;
      case 'ticketStatus':
        return <td key={key}><TicketStatusBadge status={item.ticketStatus} /></td>;
      case 'typeOfRequest':
        return <td key={key}>{item.typeOfRequest ?? subtle}</td>;
      case 'event':
        return <td key={key}>{item.event ?? subtle}</td>;
      case 'assetType':
        return <td key={key}>{item.assetType ?? subtle}</td>;
      case 'dueDate':
        return <td key={key}>{item.dueDate ?? subtle}</td>;
      case 'actions':
        return (
          <td key={key}>
            <div className="st-rowacts">
              {mode === 'idle' ? (
                <>
                  <button className="st-sendback" onClick={() => setMode('note')} disabled={pending}>Send back</button>
                  <button className="st-approve" onClick={approve} disabled={pending}>Approve</button>
                </>
              ) : (
                <>
                  <button className="st-sendback" onClick={() => setMode('idle')} disabled={pending}>Cancel</button>
                  <button className="st-approve" onClick={sendBack} disabled={pending}>Submit note</button>
                </>
              )}
            </div>
          </td>
        );
      default:
        return <td key={key} />;
    }
  }

  return (
    <>
      <tr>{columns.map((c) => cell(c.key))}</tr>
      {mode === 'note' && (
        <tr>
          <td colSpan={columns.length} style={{ paddingTop: 0 }}>
            <textarea autoFocus value={note} onChange={(e) => setNote(e.target.value)}
              placeholder="What needs changing? Saved to V's Notes and sent back for revision." />
          </td>
        </tr>
      )}
      {err && (
        <tr><td colSpan={columns.length} style={{ paddingTop: 0, color: 'var(--red-content)', fontSize: 12 }}>{err}</td></tr>
      )}
    </>
  );
}
