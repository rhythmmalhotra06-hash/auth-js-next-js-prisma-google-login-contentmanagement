'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { setEmployeeRoles } from '@/app/settings/team/actions';

const inputCls =
  'rounded-[8px] border border-border-default px-3 py-2 text-sm text-text outline-none focus-visible:border-brand focus-visible:shadow-[var(--mv-shadow-focus)]';

export interface TeamEmployee {
  id: string;
  name: string;
  email: string | null;
  active: boolean;
  roles: string[];
  division: string | null;
  team: string | null;
}

export interface TeamRolesEditorProps {
  employees: TeamEmployee[];
  allRoles: readonly string[];
  roleDescriptions: Record<string, string>;
  divisions: string[];
  defaultDivision: string; // 'All' or a division name
  canEdit: boolean;
}

const ALL = 'All';

function EmployeeRow({
  employee,
  allRoles,
  roleDescriptions,
  canEdit,
}: {
  employee: TeamEmployee;
  allRoles: readonly string[];
  roleDescriptions: Record<string, string>;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [roles, setRoles] = useState<string[]>(employee.roles);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function toggle(role: string) {
    if (!canEdit || pending) return;
    const next = roles.includes(role) ? roles.filter((r) => r !== role) : [...roles, role];
    const prev = roles;
    setRoles(next); // optimistic
    setErr(null);
    start(async () => {
      const res = await setEmployeeRoles(employee.id, next);
      if (!res.ok) {
        setRoles(prev); // revert
        setErr(res.error ?? 'Failed to update roles.');
      } else {
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-col gap-2 border-b border-border-default py-3 last:border-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium text-text">{employee.name}</span>
          {!employee.active && <span className="rounded-full bg-bg-subtle px-2 py-0.5 text-[11px] text-text-subtle">Inactive</span>}
        </div>
        <div className="truncate text-xs text-text-muted">{employee.email ?? 'no email'}</div>
        <div className="mt-0.5 flex flex-wrap gap-1 text-[11px] text-text-subtle">
          {employee.division && <span className="rounded bg-bg-subtle px-1.5 py-0.5">{employee.division}</span>}
          {employee.team && <span className="rounded bg-bg-subtle px-1.5 py-0.5">{employee.team}</span>}
        </div>
        {err && <div className="mt-1 text-xs text-danger">{err}</div>}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {allRoles.map((role) => {
          const on = roles.includes(role);
          return (
            <button
              key={role}
              type="button"
              title={roleDescriptions[role] ?? role}
              onClick={() => toggle(role)}
              disabled={!canEdit || pending}
              className={
                'rounded-full px-2.5 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed ' +
                (on
                  ? 'bg-brand text-white'
                  : 'bg-bg-subtle text-text-muted ring-1 ring-border-default hover:bg-bg-muted ' +
                    (canEdit ? '' : 'opacity-70'))
              }
            >
              {role}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function TeamRolesEditor({
  employees,
  allRoles,
  roleDescriptions,
  divisions,
  defaultDivision,
  canEdit,
}: TeamRolesEditorProps) {
  const [division, setDivision] = useState(defaultDivision);
  const [team, setTeam] = useState(ALL);
  const [query, setQuery] = useState('');

  // Teams available within the current division (only Creatives have teams set).
  const teamOptions = useMemo(() => {
    const pool = division === ALL ? employees : employees.filter((e) => (e.division ?? '') === division);
    return Array.from(new Set(pool.map((e) => e.team).filter((t): t is string => !!t))).sort();
  }, [employees, division]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return employees.filter((e) => {
      if (division !== ALL && (e.division ?? '') !== division) return false;
      if (team !== ALL && (e.team ?? '') !== team) return false;
      if (q && !(e.name.toLowerCase().includes(q) || (e.email ?? '').toLowerCase().includes(q))) return false;
      return true;
    });
  }, [employees, division, team, query]);

  function onDivisionChange(value: string) {
    setDivision(value);
    setTeam(ALL); // reset team — its options depend on the division
  }

  return (
    <div className="space-y-4">
      {!canEdit && (
        <div className="rounded-[8px] bg-amber-50 px-3 py-2 text-sm text-text">
          Read-only — managing roles requires the <strong>Admin</strong> role.
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3 rounded-[12px] bg-surface p-4 shadow-sm ring-1 ring-border-default">
        <label className="flex flex-col gap-1 text-xs font-medium text-text-muted">
          Division
          <select className={inputCls} value={division} onChange={(e) => onDivisionChange(e.target.value)}>
            <option value={ALL}>All divisions</option>
            {divisions.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-text-muted">
          Team
          <select
            className={inputCls}
            value={team}
            onChange={(e) => setTeam(e.target.value)}
            disabled={teamOptions.length === 0}
          >
            <option value={ALL}>All teams</option>
            {teamOptions.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-1 flex-col gap-1 text-xs font-medium text-text-muted">
          Search
          <input
            className={`${inputCls} w-full`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Name or email…"
          />
        </label>
      </div>

      {/* People */}
      <div className="rounded-[12px] bg-surface p-5 shadow-sm ring-1 ring-border-default">
        <div className="mb-1 flex items-baseline justify-between">
          <h2 className="text-sm font-semibold text-text">People & roles</h2>
          <span className="text-xs text-text-subtle">
            {filtered.length} of {employees.length}
          </span>
        </div>
        <p className="mb-2 text-xs text-text-muted">Click a role to toggle it. Changes save instantly. A person can hold multiple roles.</p>
        <div>
          {filtered.map((e) => (
            <EmployeeRow key={e.id} employee={e} allRoles={allRoles} roleDescriptions={roleDescriptions} canEdit={canEdit} />
          ))}
          {filtered.length === 0 && <p className="py-6 text-center text-sm text-text-muted">No people match these filters.</p>}
        </div>
      </div>
    </div>
  );
}
