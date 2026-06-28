// Contractor/Freelancer repository — Airtable-direct. The second pool tickets get
// assigned to (alongside Employee creatives). Small table; cached ~60s.

import { CONTRACTORS } from '@/lib/airtable/field-map';
import { listAll } from '@/lib/airtable/rest';

const C = CONTRACTORS.fields;

export interface ContractorRecord {
  id: string; // Airtable recId
  name: string;
  active: boolean;
  serviceLevel: string | null;
}

let cache: { at: number; rows: ContractorRecord[] } | null = null;
let inflight: Promise<ContractorRecord[]> | null = null;
const TTL_MS = 60_000;

const str = (v: unknown): string | null => (typeof v === 'string' && v ? v : null);
const selectOne = (v: unknown): string | null => {
  if (v == null) return null;
  if (typeof v === 'string') return v.trim() || null;
  if (typeof v === 'object' && 'name' in (v as object)) return String((v as { name: unknown }).name).trim() || null;
  return null;
};

async function load(): Promise<ContractorRecord[]> {
  const res = await listAll(CONTRACTORS.baseId, CONTRACTORS.tableId, {
    fields: [C.name, C.status, C.serviceLevel],
  });
  if (!res.ok) return [];
  return res.data.map((rec) => {
    const f = rec.fields as Record<string, unknown>;
    return {
      id: rec.id,
      name: str(f[C.name]) ?? '(unnamed)',
      active: selectOne(f[C.status]) === 'Active',
      serviceLevel: selectOne(f[C.serviceLevel]),
    };
  });
}

async function all(): Promise<ContractorRecord[]> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.rows;
  if (inflight) return inflight;
  inflight = load()
    .then((rows) => { cache = { at: Date.now(), rows }; return rows; })
    .finally(() => { inflight = null; });
  return inflight;
}

export async function listActiveContractorRecords(): Promise<ContractorRecord[]> {
  return (await all()).filter((r) => r.active);
}
