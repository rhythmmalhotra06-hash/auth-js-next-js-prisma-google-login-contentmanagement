// Employee repository — Airtable-direct. Resolves the signed-in user (by email) to
// an Employees record. Cached ~60s; the Employees table is small.

import { EMPLOYEES } from '@/lib/airtable/field-map';
import { listAll } from '@/lib/airtable/rest';

const E = EMPLOYEES.fields;

export interface EmployeeRecord {
  id: string;        // Airtable recId
  airtableId: string; // same recId (kept for callers that read .airtableId)
  name: string;
  email: string | null;
  active: boolean;
}

let cache: { at: number; rows: EmployeeRecord[] } | null = null;
let inflight: Promise<EmployeeRecord[]> | null = null;
const TTL_MS = 60_000;

const str = (v: unknown): string | null => (typeof v === 'string' && v ? v : null);

async function load(): Promise<EmployeeRecord[]> {
  const res = await listAll(EMPLOYEES.baseId, EMPLOYEES.tableId, { fields: [E.name, E.email, E.activeStatus] });
  if (!res.ok) return [];
  return res.data.map((rec) => {
    const f = rec.fields as Record<string, unknown>;
    return {
      id: rec.id,
      airtableId: rec.id,
      name: str(f[E.name]) ?? '(unnamed)',
      email: str(f[E.email]),
      active: str(f[E.activeStatus]) === 'Active',
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
