'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  setGlobalValue, setEventTypeValue, setAssetTypeValue, setCapacity, recomputeScores,
  type ActionResult,
} from '@/app/settings/scoring/actions';

const inputCls =
  'w-full rounded-sm border border-border-default px-3 py-2 text-sm text-text outline-none focus-visible:border-brand focus-visible:shadow-[var(--mv-shadow-focus)] disabled:opacity-60';
const numCls = `${inputCls} max-w-[110px] tabular-nums`;

export interface GlobalRow { id: string; key: string; value: number | null; label: string | null; group: string | null; note: string | null }
export interface TypeRow { id: string; name: string; loadWeight: number | null; secondary: number | null }
export interface PersonRow { id: string; name: string; group: 'Creatives' | 'Freelancers & contractors'; capacity: number | null }

export interface ScoringConfigEditorProps {
  globals: GlobalRow[];
  eventTypes: TypeRow[];
  assetTypes: TypeRow[];
  people: PersonRow[];
  defaultCapacity: number;
  canEdit: boolean;
}

function Msg({ msg }: { msg: { ok: boolean; text: string } | null }) {
  if (!msg) return null;
  return (
    <span className={`ml-2 text-xs ${msg.ok ? 'text-brand-content' : 'text-danger'}`}>{msg.text}</span>
  );
}

/** A single numeric cell with inline save. `optional` allows clearing back to a default. */
function NumField({
  initial, placeholder, canEdit, optional, save,
}: {
  initial: number | null;
  placeholder?: string;
  canEdit: boolean;
  optional?: boolean;
  save: (raw: string) => Promise<ActionResult>;
}) {
  const router = useRouter();
  const initStr = initial == null ? '' : String(initial);
  const [value, setValue] = useState(initStr);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const dirty = value.trim() !== initStr;

  function run() {
    setMsg(null);
    start(async () => {
      const res = await save(value);
      setMsg(res.ok ? { ok: true, text: 'Saved' } : { ok: false, text: res.error ?? 'Failed' });
      if (res.ok) router.refresh();
    });
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      <input
        className={numCls}
        inputMode="decimal"
        value={value}
        disabled={!canEdit}
        placeholder={placeholder}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && dirty) run(); }}
      />
      {canEdit && dirty && (
        <button
          onClick={run}
          disabled={pending}
          className="rounded-sm bg-brand px-2.5 py-1.5 text-xs font-medium text-white hover:bg-brand-bright disabled:opacity-50"
        >
          {pending ? '…' : optional ? 'Set' : 'Save'}
        </button>
      )}
      <Msg msg={msg} />
    </span>
  );
}

function GlobalSection({ title, hint, rows, canEdit, children }: {
  title: string; hint?: string; rows: GlobalRow[]; canEdit: boolean; children?: React.ReactNode;
}) {
  return (
    <section className="rounded-md bg-surface p-6 shadow-sm ring-1 ring-border-default">
      <h2 className="text-sm font-semibold text-text">{title}</h2>
      {hint && <p className="mt-1 text-xs text-text-muted">{hint}</p>}
      <div className="mt-4 space-y-3">
        {rows.map((r) => (
          <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-border-default pb-3 last:border-0 last:pb-0">
            <div className="min-w-0">
              <div className="text-sm font-medium text-text">{r.label ?? r.key}</div>
              {r.note && <div className="text-xs text-text-subtle">{r.note}</div>}
            </div>
            <NumField initial={r.value} canEdit={canEdit} save={(raw) => setGlobalValue(r.id, raw)} />
          </div>
        ))}
      </div>
      {children}
    </section>
  );
}

function TypeTable({ title, hint, rows, secondaryLabel, secondaryPlaceholder, canEdit, onLoad, onSecondary }: {
  title: string; hint: string; rows: TypeRow[]; secondaryLabel: string; secondaryPlaceholder: string; canEdit: boolean;
  onLoad: (id: string, raw: string) => Promise<ActionResult>;
  onSecondary: (id: string, raw: string) => Promise<ActionResult>;
}) {
  const [q, setQ] = useState('');
  const filtered = rows.filter((r) => r.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <section className="rounded-md bg-surface p-6 shadow-sm ring-1 ring-border-default">
      <h2 className="text-sm font-semibold text-text">{title}</h2>
      <p className="mt-1 text-xs text-text-muted">{hint}</p>
      <input className={`${inputCls} mt-3 max-w-xs`} placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-2xs uppercase tracking-wide text-text-subtle">
              <th className="py-1.5 pr-3 font-semibold">Name</th>
              <th className="py-1.5 pr-3 font-semibold">Load weight</th>
              <th className="py-1.5 font-semibold">{secondaryLabel}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="border-t border-border-default">
                <td className="py-2 pr-3 text-text">{r.name}</td>
                <td className="py-2 pr-3"><NumField initial={r.loadWeight} placeholder="1" optional canEdit={canEdit} save={(raw) => onLoad(r.id, raw)} /></td>
                <td className="py-2"><NumField initial={r.secondary} placeholder={secondaryPlaceholder} optional canEdit={canEdit} save={(raw) => onSecondary(r.id, raw)} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <p className="mt-2 text-sm text-text-muted">No matches.</p>}
      </div>
    </section>
  );
}

function CapacitySection({ people, defaultCapacity, canEdit }: { people: PersonRow[]; defaultCapacity: number; canEdit: boolean }) {
  const [q, setQ] = useState('');
  const [group, setGroup] = useState<'All' | PersonRow['group']>('All');
  const filtered = people.filter((p) =>
    (group === 'All' || p.group === group) && p.name.toLowerCase().includes(q.toLowerCase()),
  );
  return (
    <section className="rounded-md bg-surface p-6 shadow-sm ring-1 ring-border-default">
      <h2 className="text-sm font-semibold text-text">Per-person capacity</h2>
      <p className="mt-1 text-xs text-text-muted">Overrides the default for one person. Blank uses the default ({defaultCapacity}). Capacity is the weighted load that fills them to 100%.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <input className={`${inputCls} max-w-xs`} placeholder="Search people…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className={`${inputCls} max-w-[220px]`} value={group} onChange={(e) => setGroup(e.target.value as typeof group)}>
          <option value="All">All</option>
          <option value="Creatives">Creatives</option>
          <option value="Freelancers & contractors">Freelancers &amp; contractors</option>
        </select>
      </div>
      <div className="mt-3 space-y-2">
        {filtered.map((p) => (
          <div key={`${p.group}:${p.id}`} className="flex flex-wrap items-center justify-between gap-3 border-b border-border-default pb-2 last:border-0">
            <div className="min-w-0">
              <span className="text-sm font-medium text-text">{p.name}</span>
              <span className="ml-2 rounded-full bg-bg-subtle px-2 py-0.5 text-2xs text-text-muted ring-1 ring-border-default">{p.group}</span>
            </div>
            <NumField initial={p.capacity} placeholder={String(defaultCapacity)} optional canEdit={canEdit} save={(raw) => setCapacity(p.group, p.id, raw)} />
          </div>
        ))}
        {filtered.length === 0 && <p className="text-sm text-text-muted">No matches.</p>}
      </div>
    </section>
  );
}

function RecomputeButton({ canEdit }: { canEdit: boolean }) {
  const router = useRouter();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  if (!canEdit) return null;
  return (
    <div className="mt-4 flex items-center gap-2 border-t border-border-default pt-4">
      <button
        onClick={() => start(async () => {
          setMsg(null);
          const res = await recomputeScores();
          setMsg(res.ok ? { ok: true, text: `Recomputed ${res.count ?? 0} tickets.` } : { ok: false, text: res.error ?? 'Failed.' });
          if (res.ok) router.refresh();
        })}
        disabled={pending}
        className="rounded-sm bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-bright disabled:opacity-50"
      >
        {pending ? 'Recomputing…' : 'Recompute scores now'}
      </button>
      <span className="text-xs text-text-muted">Priority weights only take effect on saved scores after a recompute.</span>
      <Msg msg={msg} />
    </div>
  );
}

export function ScoringConfigEditor({ globals, eventTypes, assetTypes, people, defaultCapacity, canEdit }: ScoringConfigEditorProps) {
  const byGroup = useMemo(() => ({
    capacity: globals.filter((g) => g.group === 'Capacity'),
    priority: globals.filter((g) => g.group === 'Priority weights'),
    thresholds: globals.filter((g) => g.group === 'Thresholds'),
  }), [globals]);

  return (
    <div className="space-y-5">
      {!canEdit && (
        <div className="rounded-sm bg-warning-soft px-3 py-2 text-sm text-text">
          Read-only — editing capacity &amp; scoring requires the <strong>Admin</strong> role. Ask an admin to grant it in the Admin panel.
        </div>
      )}

      <GlobalSection
        title="Editor capacity"
        hint="How much work an editor can hold. Per-ticket cost is set by event/asset type weights below."
        rows={byGroup.capacity}
        canEdit={canEdit}
      />

      <CapacitySection people={people} defaultCapacity={defaultCapacity} canEdit={canEdit} />

      <TypeTable
        title="Load weight by event type"
        hint="What one ticket of this event type costs against an editor's capacity. Blank = 1. Asset-type weight (below) wins when both are set."
        rows={eventTypes}
        secondaryLabel="Tier (0–1)"
        secondaryPlaceholder="0.5"
        canEdit={canEdit}
        onLoad={(id, raw) => setEventTypeValue(id, 'loadWeight', raw)}
        onSecondary={(id, raw) => setEventTypeValue(id, 'tierNorm', raw)}
      />

      <TypeTable
        title="Load weight by asset type"
        hint="Overrides the event-type weight for tickets of this asset type. Blank = 1. Effort (0–1) feeds the priority score."
        rows={assetTypes}
        secondaryLabel="Effort (0–1)"
        secondaryPlaceholder="0.5"
        canEdit={canEdit}
        onLoad={(id, raw) => setAssetTypeValue(id, 'loadWeight', raw)}
        onSecondary={(id, raw) => setAssetTypeValue(id, 'effortNorm', raw)}
      />

      <GlobalSection
        title="Priority weights"
        hint="urgency = w_due·dueProximity + w_event·eventTier · complexity = w_effort·effort + w_variants·variants + w_shoot·shoot · score = urgency + leadtime·complexity."
        rows={byGroup.priority}
        canEdit={canEdit}
      >
        <RecomputeButton canEdit={canEdit} />
      </GlobalSection>

      <GlobalSection
        title="Thresholds & risk windows"
        hint="When the capacity bars change colour and when the “at capacity” risk flag fires."
        rows={byGroup.thresholds}
        canEdit={canEdit}
      />
    </div>
  );
}
