// Lazy reference resolution for ticket creation. The intake form serves option
// values as Airtable recIds (see reference-live.ts). Before inserting a ticket we
// must turn those into our Postgres UUIDs — and if a chosen row hasn't been
// mirrored yet (e.g. a brand-new asset type), fetch + upsert it on the spot so the
// ticket's foreign keys resolve. Reuses the bulk-sync mappers so field logic is
// never duplicated.

import { prisma } from '@/lib/prisma';
import { getRecord } from './client';
import { EMPLOYEES, EVENT_TYPES, ASSET_TYPES, OFFICIAL_CALENDARS, AUTHORS } from './field-map';
import { mapEmployee, mapEventType, mapAssetType, mapOfficialCalendar, mapAuthor } from './sync';

/** Airtable record IDs look like `rec…` (17 chars); our IDs are UUIDs. */
const isRecId = (v: string) => /^rec[A-Za-z0-9]{14}$/.test(v);

interface ResolveInput {
  eventTypeRecId: string;
  assetTypeRecId: string;
  requesterRecId: string;
  officialCalendarRecId?: string | null;
  authorRecIds?: string[];
}

interface ResolveResult {
  eventTypeId: string;
  assetTypeId: string;
  requesterId: string;
  officialCalendarId: string | null;
  authorIds: string[];
}

async function resolveEventType(value: string): Promise<string> {
  if (!isRecId(value)) return value; // already our UUID (Postgres fallback path)
  const existing = await prisma.eventType.findUnique({ where: { airtableId: value }, select: { id: true } });
  if (existing) return existing.id;
  const m = mapEventType(await getRecord(EVENT_TYPES.baseId, EVENT_TYPES.tableId, value));
  const row = await prisma.eventType.upsert({
    where: { airtableId: value },
    create: { airtableId: m.airtableId, name: m.name, active: m.active },
    update: { name: m.name, active: m.active, syncedAt: new Date() },
    select: { id: true },
  });
  return row.id;
}

async function resolveAssetType(value: string): Promise<string> {
  if (!isRecId(value)) return value;
  const existing = await prisma.assetType.findUnique({ where: { airtableId: value }, select: { id: true } });
  if (existing) return existing.id;
  const m = mapAssetType(await getRecord(ASSET_TYPES.baseId, ASSET_TYPES.tableId, value));
  // Scalar row only — join tables (event types / dimensions) aren't needed for the
  // ticket FK, and the intake filter reads them live from Airtable. The next full
  // reference sync backfills the joins.
  const row = await prisma.assetType.upsert({
    where: { airtableId: value },
    create: { airtableId: m.airtableId, name: m.name, category: m.category, active: m.active },
    update: { name: m.name, category: m.category, active: m.active, syncedAt: new Date() },
    select: { id: true },
  });
  return row.id;
}

async function resolveEmployee(value: string): Promise<string> {
  if (!isRecId(value)) return value;
  const existing = await prisma.employee.findUnique({ where: { airtableId: value }, select: { id: true } });
  if (existing) return existing.id;
  const m = mapEmployee(await getRecord(EMPLOYEES.baseId, EMPLOYEES.tableId, value));
  const row = await prisma.employee.upsert({
    where: { airtableId: value },
    create: m,
    update: { name: m.name, email: m.email, team: m.team, division: m.division, employmentType: m.employmentType, active: m.active, syncedAt: new Date() },
    select: { id: true },
  });
  return row.id;
}

async function resolveOfficialCalendar(value: string): Promise<string> {
  if (!isRecId(value)) return value;
  const existing = await prisma.officialCalendar.findUnique({ where: { airtableId: value }, select: { id: true } });
  if (existing) return existing.id;
  const m = mapOfficialCalendar(await getRecord(OFFICIAL_CALENDARS.baseId, OFFICIAL_CALENDARS.tableId, value));
  const row = await prisma.officialCalendar.upsert({
    where: { airtableId: value },
    create: m,
    update: { name: m.name, status: m.status, startDate: m.startDate, endDate: m.endDate, syncedAt: new Date() },
    select: { id: true },
  });
  return row.id;
}

async function resolveAuthor(value: string): Promise<string> {
  if (!isRecId(value)) return value;
  const existing = await prisma.author.findUnique({ where: { airtableId: value }, select: { id: true } });
  if (existing) return existing.id;
  const m = mapAuthor(await getRecord(AUTHORS.baseId, AUTHORS.tableId, value));
  const row = await prisma.author.upsert({
    where: { airtableId: value },
    create: m,
    update: { name: m.name, title: m.title, syncedAt: new Date() },
    select: { id: true },
  });
  return row.id;
}

/**
 * Resolve the intake form's reference recIds to our Postgres UUIDs, upserting any
 * row that isn't mirrored yet. Values that are already UUIDs (Postgres fallback)
 * pass through unchanged.
 */
export async function ensureReferenceRows(input: ResolveInput): Promise<ResolveResult> {
  const [eventTypeId, assetTypeId, requesterId] = await Promise.all([
    resolveEventType(input.eventTypeRecId),
    resolveAssetType(input.assetTypeRecId),
    resolveEmployee(input.requesterRecId),
  ]);

  const officialCalendarId = input.officialCalendarRecId
    ? await resolveOfficialCalendar(input.officialCalendarRecId)
    : null;

  const authorIds = input.authorRecIds?.length
    ? await Promise.all(input.authorRecIds.map(resolveAuthor))
    : [];

  return { eventTypeId, assetTypeId, requesterId, officialCalendarId, authorIds };
}
