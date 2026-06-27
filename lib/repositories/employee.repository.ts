// Employee repository — Airtable-direct. Resolves the signed-in user (by email) to
// an Employees record. Cached ~60s; the Employees table is small.

import { EMPLOYEES } from '@/lib/airtable/field-map';
import { listAll, updateRecord, type AirtableResult } from '@/lib/airtable/rest';

const E = EMPLOYEES.fields;

export interface EmployeeRecord {
  id: string;        // Airtable recId
  airtableId: string; // same recId (kept for callers that read .airtableId)
  name: string;
  email: string | null;
  active: boolean;
  roles: string[];   // app access roles (Editor, Manager, Admin, …)
}

let cache: { at: number; rows: EmployeeRecord[] } | null = null;
let inflight: Promise<EmployeeRecord[]> | null = null;
const TTL_MS = 60_000;

const str = (v: unknown): string | null => (typeof v === 'string' && v ? v : null);

// multipleSelects come back as an array of name strings (returnFieldsByFieldId)
// or an array of {id,name} objects — tolerate both.
function selectNames(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => (typeof x === 'string' ? x : x && typeof x === 'object' && 'name' in x ? String((x as { name: unknown }).name) : null))
    .filter((x): x is string => !!x);
}

async function load(): Promise<EmployeeRecord[]> {
  const res = await listAll(EMPLOYEES.baseId, EMPLOYEES.tableId, { fields: [E.name, E.email, E.activeStatus, E.roles] });
  if (!res.ok) return [];
  return res.data.map((rec) => {
    const f = rec.fields as Record<string, unknown>;
    return {
      id: rec.id,
      airtableId: rec.id,
      name: str(f[E.name]) ?? '(unnamed)',
      email: str(f[E.email]),
      active: str(f[E.activeStatus]) === 'Active',
      roles: selectNames(f[E.roles]),
    };
  });
}

async function all(): Promise<EmployeeRecord[]> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.rows;
  if (inflight) return inflight;
  inflight = load()
    .then((rows) => { cache = { at: Date.now(), rows }; return rows; })
    .finally(() => { inflight = null; });
  return inflight;
}

export async function findEmployeeByEmail(email: string): Promise<EmployeeRecord | null> {
  const target = email.trim().toLowerCase();
  if (!target) return null;
  const rows = await all();
  return rows.find((r) => r.email?.toLowerCase() === target) ?? null;
}

export async function listActiveEmployeeRecords(): Promise<EmployeeRecord[]> {
  return (await all()).filter((r) => r.active);
}

/** All employees (incl. inactive) — for the admin/team role panel. Active first, then by name. */
export async function listAllEmployeeRecords(): Promise<EmployeeRecord[]> {
  return [...(await all())].sort((a, b) => {
    if (a.active !== b.active) return a.active ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

/** Overwrite an employee's app roles (multi-select). Busts the cache on success. */
export async function updateEmployeeRoles(id: string, roles: string[]): Promise<AirtableResult<true>> {
  const res = await updateRecord(EMPLOYEES.baseId, EMPLOYEES.tableId, id, { [E.roles]: roles });
  if (!res.ok) return res;
  cache = null; // force a fresh read so gating/UI reflect the change immediately
  return { ok: true, data: true };
}
