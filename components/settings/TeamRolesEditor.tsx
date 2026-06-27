'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { setEmployeeRoles } from '@/app/settings/team/actions';

export interface TeamEmployee {
  id: string;
  name: string;
  email: string | null;
  active: boolean;
  roles: string[];
}

export interface TeamRolesEditorProps {
  employees: TeamEmployee[];
  allRoles: readonly string[];
  roleDescriptions: Record<string, string>;
  canEdit: boolean;
}

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

export function TeamRolesEditor({ employees, allRoles, roleDescriptions, canEdit }: TeamRolesEditorProps) {
  return (
    <div className="space-y-4">
      {!canEdit && (
        <div className="rounded-[8px] bg-amber-50 px-3 py-2 text-sm text-text">
          Read-only — managing roles requires the <strong>Admin</strong> role.
        </div>
      )}
      <div className="rounded-[12px] bg-surface p-5 shadow-sm ring-1 ring-border-default">
        <div className="mb-1 flex items-baseline justify-between">
          <h2 className="text-sm font-semibold text-text">People & roles</h2>
          <span className="text-xs text-text-subtle">{employees.length} employees</span>
        </div>
        <p className="mb-2 text-xs text-text-muted">Click a role to toggle it. Changes save instantly. A person can hold multiple roles.</p>
        <div>
          {employees.map((e) => (
            <EmployeeRow
              key={e.id}
              employee={e}
              allRoles={allRoles}
              roleDescriptions={roleDescriptions}
              canEdit={canEdit}
            />
          ))}
          {employees.length === 0 && <p className="py-6 text-center text-sm text-text-muted">No employees found.</p>}
        </div>
      </div>
    </div>
  );
}
