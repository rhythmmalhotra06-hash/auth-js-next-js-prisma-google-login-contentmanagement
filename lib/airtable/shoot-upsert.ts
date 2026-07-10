// Upsert Airtable 📺 Shoots records → Postgres `shoots`. Shared backbone for both the
// backfill (all rows) and the inbound pull (changed rows) — one mapping of Shoots →
// the shoots table. Link fields are kept as Airtable recId arrays (the shoot's own state
// is authoritative in PG; the drainer pushes these back as link arrays).

import { prisma } from '@/lib/prisma';
import { SHOOTS } from './field-map';
import { type AirtableRecord } from './rest';

const F = SHOOTS.fields;
const L = SHOOTS.links;

const str = (v: unknown): string | null => (typeof v === 'string' && v ? v : null);
const num = (v: unknown): number | null => (typeof v === 'number' && !Number.isNaN(v) ? v : null);
function selectName(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === 'string') return v || null;
  if (typeof v === 'object' && 'name' in (v as object)) return String((v as { name: unknown }).name);
  return String(v);
}
function selectNames(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map(selectName).filter((x): x is string => !!x);
}
function linkedIds(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => (typeof x === 'string' ? x : x && typeof x === 'object' && 'id' in x ? String((x as { id: unknown }).id) : null))
    .filter((x): x is string => !!x);
}

/** Airtable Shoots record → the PG `shoots` scalar/link payload. */
export function shootUpsertData(rec: AirtableRecord) {
  const f = rec.fields as Record<string, unknown>;
  return {
    title: str(f[F.title]),
    status: selectName(f[F.status]),
    format: selectName(f[F.format]),
    filmingDate: str(f[F.filmingDate]),
    filmingLocation: selectName(f[F.filmingLocation]),
    brief: str(f[F.notes]),
    productionSupport: str(f[F.productionSupport]),
    vishenApproved: f[F.vishenApproval] === true,
    priorityRanking: num(f[F.priorityRanking]),
    rawFiles: str(f[F.rawFiles]),
    platforms: selectNames(f[F.platforms]),
    newPrioTicket: f[F.newPrioTicket] === true,
    requestedById: linkedIds(f[L.requestedBy])[0] ?? null,
    authorIds: linkedIds(f[L.authors]),
    eventTypeIds: linkedIds(f[L.eventTypes]),
    assetTypeIds: linkedIds(f[L.assetTypes]),
    assetLibraryIds: linkedIds(f[L.assetLibrary]),
    ticketIds: linkedIds(f[L.postProductionTicket]),
    createdTime: rec.createdTime ?? null,
  };
}

/** Upsert the given Shoots records into PG (keyed on airtable_id). Small table — per-row
 *  upsert is fine (the backfill excludes nothing; the pull passes only changed rows). */
export async function upsertShootsFromRecords(records: AirtableRecord[]): Promise<number> {
  for (const rec of records) {
    const data = shootUpsertData(rec);
    await prisma.shoot.upsert({
      where: { airtableId: rec.id },
      create: { airtableId: rec.id, ...data },
      update: { ...data, syncedAt: new Date() },
    });
  }
  return records.length;
}
