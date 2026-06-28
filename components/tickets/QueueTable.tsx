'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/cn';
import { TicketStatusBadge, PrioStatusBadge } from '@/components/ui/Badge';
import { TierBadge } from '@/components/ui/TierBadge';
import { Icon } from '@/components/ui/Icon';
import { useTableView, type ColumnDef } from '@/components/ui/table/useTableView';
import { SortableTh } from '@/components/ui/table/SortableTh';
import { ColumnsMenu } from '@/components/ui/table/ColumnsMenu';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { loadMap, riskOf } from '@/lib/tickets/intel';
import type { QueueTicket } from '@/lib/tickets/data';

// Filterable, sortable, configurable queue table — ported to the prototype `.list`
// look. Mandated first five columns (CLAUDE.md §7): Title · Priority · Assigned ·
// Ticket Status · Priority Status — those are locked (always visible, always first).
// Sorting reorders rows only; optional columns append to the right when revealed.

type Dim = 'prioStatus' | 'ticketStatus' | 'eventType' | 'assetType' | 'typeOfRequest';
const FILTERS: { key: Dim; label: string }[] = [
  { key: 'eventType', label: 'All event types' },
  { key: 'assetType', label: 'All asset types' },
  { key: 'prioStatus', label: 'All priority statuses' },
  { key: 'typeOfRequest', label: 'All request types' },
];

const uniq = (rows: QueueTicket[], key: Dim) =>
  [...new Set(rows.map((r) => r[key]).filter((v): v is string => !!v))].sort((a, b) => a.localeCompare(b));

const TICKET_ORDER = ['Backlog', 'To Do', 'In Progress', 'In Revision', 'Review', 'Approved', 'Shipping', 'Done', "Won't Do"];
const orderIdx = (s: string) => { const i = TICKET_ORDER.indexOf(s); return i === -1 ? TICKET_ORDER.length : i; };
const lower = (v: string | null) => (v ?? '').toLowerCase();
const priorityVal = (t: QueueTicket) => Number(t.queueRank ?? t.priorityScore ?? 0);

const COLUMNS: ColumnDef<QueueTicket>[] = [
  { key: 'title', label: 'Title', locked: true, sortable: true, sortAccessor: (t) => lower(t.title) },
  { key: 'priority', label: 'Priority', locked: true, sortable: true, numeric: true, sortAccessor: priorityVal },
  { key: 'assigned', label: 'Assigned', locked: true, sortable: true, sortAccessor: (t) => lower(t.assignee) },
  { key: 'ticketStatus', label: 'Ticket status', locked: true, sortable: true, sortAccessor: (t) => orderIdx(t.ticketStatus ?? '') },
  { key: 'prioStatus', label: 'Priority status', locked: true, sortable: true, sortAccessor: (t) => lower(t.prioStatus) },
  { key: 'eventType', label: 'Event type', sortable: true, sortAccessor: (t) => lower(t.eventType) },
  { key: 'assetType', label: 'Asset type', sortable: true, sortAccessor: (t) => lower(t.assetType) },
  { key: 'dueDate', label: 'Due date', sortable: true, numeric: true, sortAccessor: (t) => (t.dueDate ? new Date(t.dueDate).getTime() : null) },
  { key: 'requester', label: 'Requester', sortable: true, sortAccessor: (t) => lower(t.requester) },
  { key: 'typeOfRequest', label: 'Request type', sortable: true, sortAccessor: (t) => lower(t.typeOfRequest) },
];

function dueChip(due: string | null) {
  if (!due) return null;
  const d = Math.ceil((new Date(due).getTime() - Date.now()) / 86400000);
  if (Number.isNaN(d)) return null;
  if (d < 0) return <span className="due far">overdue</span>;
  const cls = d <= 2 ? 'soon' : d <= 6 ? 'mid' : 'far';
  return <span className={`due ${cls}`}>due {d}d</span>;
}

const COL_WIDTH: Record<string, number> = { priority: 120, assigned: 150, ticketStatus: 130, prioStatus: 150, dueDate: 110 };

export function QueueTable({ tickets, basePath = '/tickets', storageKey = 'queue' }: { tickets: QueueTicket[]; basePath?: string; storageKey?: string }) {
  const router = useRouter();
  const [sel, setSel] = useState<Record<Dim, string>>({
    prioStatus: '', ticketStatus: '', eventType: '', assetType: '', typeOfRequest: '',
  });
  const [q, setQ] = useState('');

  const view = useTableView({ columns: COLUMNS, storageKey });

  const options = useMemo(
    () => Object.fromEntries(FILTERS.map((f) => [f.key, uniq(tickets, f.key)])) as Record<Dim, string[]>,
    [tickets],
  );
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return tickets.filter((t) =>
      (Object.keys(sel) as Dim[]).every((k) => !sel[k] || t[k] === sel[k]) &&
      (!needle || t.title.toLowerCase().includes(needle)),
    );
  }, [tickets, sel, q]);
  const rows = useMemo(() => view.sortRows(filtered), [view, filtered]);

  const load = useMemo(() => loadMap(tickets), [tickets]);
  const funnel = useMemo(() => {
    const scoped = tickets.filter((t) => FILTERS.every((f) => !sel[f.key] || t[f.key] === sel[f.key]));
    const counts = new Map<string, number>();
    for (const t of scoped) { const s = t.ticketStatus; if (s) counts.set(s, (counts.get(s) ?? 0) + 1); }
    return [...counts.entries()].sort((a, b) => orderIdx(a[0]) - orderIdx(b[0])).map(([status, count]) => ({ status, count }));
  }, [tickets, sel]);

  const activeFilters = (Object.keys(sel) as Dim[]).filter((k) => sel[k]).length;

  function cell(key: string, t: QueueTicket, r: ReturnType<typeof riskOf>) {
    const w = COL_WIDTH[key];
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
        return <td key={key} style={{ width: w }}><span className="score">{t.queueRank ?? t.priorityScore ?? '—'}</span> {dueChip(t.dueDate)}</td>;
      case 'assigned':
        return <td key={key} style={{ width: w }}>{t.assignee ?? <span className="subtle">Unassigned</span>}</td>;
      case 'ticketStatus':
        return <td key={key} style={{ width: w }}><TicketStatusBadge status={t.ticketStatus} /></td>;
      case 'prioStatus':
        return <td key={key} style={{ width: w }}><PrioStatusBadge status={t.prioStatus} /></td>;
      case 'eventType':
        return <td key={key}>{t.eventType ?? <span className="subtle">—</span>}</td>;
      case 'assetType':
        return <td key={key}>{t.assetType ?? <span className="subtle">—</span>}</td>;
      case 'dueDate':
        return <td key={key} style={{ width: w }}>{t.dueDate ?? <span className="subtle">—</span>}</td>;
      case 'requester':
        return <td key={key}>{t.requester ?? <span className="subtle">—</span>}</td>;
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
          <button className="btn sm ghost" onClick={() => { setSel({ prioStatus: '', ticketStatus: '', eventType: '', assetType: '', typeOfRequest: '' }); setQ(''); }}>
            Clear{activeFilters > 0 ? ` (${activeFilters})` : ''}
          </button>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="subtle" style={{ fontSize: 12 }}>{rows.length} of {tickets.length}</span>
          <ColumnsMenu columns={COLUMNS} isVisible={view.isVisible} onToggle={view.toggleColumn} onReset={view.reset} hiddenCount={view.hiddenCount} />
        </div>
      </div>

      <div className="tw"><div className="tscroll"><table className="list">
        <thead><tr>
          {view.visibleColumns.map((c) => (
            <SortableTh key={c.key} label={c.label} sortKey={c.key} sort={view.sort}
              onSort={c.sortable ? view.toggleSort : undefined} style={COL_WIDTH[c.key] ? { width: COL_WIDTH[c.key] } : undefined} />
          ))}
        </tr></thead>
        <tbody>
          {rows.map((t) => {
            const r = riskOf(t, load);
            return (
              <tr key={t.id} className={cn(!t.assignee && 'attn')} onClick={() => router.push(`${basePath}/${t.id}`)}>
                {view.visibleColumns.map((c) => cell(c.key, t, r))}
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
