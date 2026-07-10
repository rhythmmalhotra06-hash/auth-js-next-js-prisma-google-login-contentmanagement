// Contractor/Freelancer repository — the second pool tickets get assigned to (alongside
// Employee creatives). Reads from Airtable OR the mirrored Postgres table by
// REFERENCE_BACKEND; edited in Airtable. Small table; cached ~60s.

import { CONTRACTORS } from '@/lib/airtable/field-map';
import { listAll } from '@/lib/airtable/rest';
import { referenceIsPostgres } from '@/lib/reference/backend';

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

async function loadAirtable(): Promise<ContractorRecord[]> {
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

// Postgres mirror — exposes airtableId as `id` (recId) so assignment writes keep working.
async function loadPostgres(): Promise<ContractorRecord[]> {
  const { prisma } = await import('@/lib/prisma');
  const rows = await prisma.contractor.findMany({ select: { airtableId: true, name: true, active: true, serviceLevel: true } });
  return rows
    .filter((r): r is typeof r & { airtableId: string } => !!r.airtableId)
    .map((r) => ({ id: r.airtableId, name: r.name, active: r.active, serviceLevel: r.serviceLevel }));
}

function load(): Promise<ContractorRecord[]> {
  return referenceIsPostgres() ? loadPostgres() : loadAirtable();
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
