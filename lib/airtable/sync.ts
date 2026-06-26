// Reference-data sync: one-way Airtable → Postgres (read-only source).
//
// v1 scope: employees, dimensions, event_types, asset_types (+ asset_type link
// join tables), official_calendar, authors. Upsert-on-airtable_id makes it
// idempotent. DNA + tickets + webhooks + two-way push are out of scope.
//
// Two passes are required because Airtable links are arrays of record IDs:
//   pass 1 — upsert all reference rows (establishes airtable_id → our uuid)
//   pass 2 — resolve asset_type link arrays to our uuids, fill join tables.

import { listRecords, type AirtableRecord } from './client';
import { EMPLOYEES, DIMENSIONS, EVENT_TYPES, ASSET_TYPES, OFFICIAL_CALENDARS, AUTHORS } from './field-map';

/** First string out of an Airtable value (handles scalar / array / null). */
function str(v: unknown): string | null {
  if (typeof v === 'string') return v.length ? v : null;
  if (Array.isArray(v)) return typeof v[0] === 'string' ? v[0] : null;
  if (v == null) return null;
  if (typeof v === 'object' && 'email' in (v as object)) return String((v as { email: unknown }).email);
  return String(v);
}

/** Array of linked record IDs from a multipleRecordLinks value. */
function linkIds(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}

/** Parse an Airtable date string into a Date, or null. */
function dateVal(v: unknown): Date | null {
  return typeof v === 'string' && v ? new Date(v) : null;
}

export interface SyncReport {
  dryRun: boolean;
  counts: { employees: number; dimensions: number; eventTypes: number; assetTypes: number; officialCalendars: number; authors: number };
  linkEdges: { eventTypes: number; teamLeads: number; preferredEditors: number; dimensions: number };
  samples: { employee?: string; eventType?: string; assetType?: string };
}

export async function syncReference(opts: { dryRun?: boolean } = {}): Promise<SyncReport> {
  const dryRun = opts.dryRun ?? false;

  // Fetch sequentially — all four tables share the creative_services base, so
  // concurrent calls would blow the per-base rate limit.
  const empRecs = await listRecords(EMPLOYEES.baseId, EMPLOYEES.tableId);
  const dimRecs = await listRecords(DIMENSIONS.baseId, DIMENSIONS.tableId);
  const evtRecs = await listRecords(EVENT_TYPES.baseId, EVENT_TYPES.tableId);
  const atRecs = await listRecords(ASSET_TYPES.baseId, ASSET_TYPES.tableId);
  const ocRecs = await listRecords(OFFICIAL_CALENDARS.baseId, OFFICIAL_CALENDARS.tableId);
  const auRecs = await listRecords(AUTHORS.baseId, AUTHORS.tableId);

  const employees = empRecs.map((r) => ({
    airtableId: r.id,
    name: str(r.fields[EMPLOYEES.fields.name]) ?? '(unnamed)',
    email: str(r.fields[EMPLOYEES.fields.email]),
    team: str(r.fields[EMPLOYEES.fields.team]),
    division: str(r.fields[EMPLOYEES.fields.division]),
    employmentType: str(r.fields[EMPLOYEES.fields.employmentStatus]) ?? 'employee',
    active: str(r.fields[EMPLOYEES.fields.activeStatus]) === 'Active',
  }));

  const dimensions = dimRecs.map((r) => ({
    airtableId: r.id,
    label: str(r.fields[DIMENSIONS.fields.label]) ?? '(unnamed)',
  }));

  const eventTypes = evtRecs.map((r) => ({
    airtableId: r.id,
    name: str(r.fields[EVENT_TYPES.fields.name]) ?? '(unnamed)',
    active: str(r.fields[EVENT_TYPES.fields.status]) === 'Active',
  }));

  const assetTypes = atRecs.map((r) => ({
    airtableId: r.id,
    name: str(r.fields[ASSET_TYPES.fields.name]) ?? str(r.fields[ASSET_TYPES.fields.fullName]) ?? '(unnamed)',
    category: str(r.fields[ASSET_TYPES.fields.category]),
    active: str(r.fields[ASSET_TYPES.fields.status]) === 'Active',
    links: {
      eventTypes: linkIds(r.fields[ASSET_TYPES.links.eventTypes]),
      teamLeads: linkIds(r.fields[ASSET_TYPES.links.teamLeads]),
      preferredEditors: linkIds(r.fields[ASSET_TYPES.links.preferredEditors]),
      dimensions: linkIds(r.fields[ASSET_TYPES.links.dimensions]),
    },
  }));

  const officialCalendars = ocRecs.map((r) => ({
    airtableId: r.id,
    name: str(r.fields[OFFICIAL_CALENDARS.fields.name]) ?? '(unnamed)',
    status: str(r.fields[OFFICIAL_CALENDARS.fields.status]),
    startDate: dateVal(r.fields[OFFICIAL_CALENDARS.fields.startDate]),
    endDate: dateVal(r.fields[OFFICIAL_CALENDARS.fields.endDate]),
  }));

  const authors = auRecs.map((r) => ({
    airtableId: r.id,
    name: str(r.fields[AUTHORS.fields.name]) ?? '(unnamed)',
    title: str(r.fields[AUTHORS.fields.title]),
  }));

  const linkEdges = {
    eventTypes: assetTypes.reduce((n, a) => n + a.links.eventTypes.length, 0),
    teamLeads: assetTypes.reduce((n, a) => n + a.links.teamLeads.length, 0),
    preferredEditors: assetTypes.reduce((n, a) => n + a.links.preferredEditors.length, 0),
    dimensions: assetTypes.reduce((n, a) => n + a.links.dimensions.length, 0),
  };

  if (!dryRun) {
    // Lazy import so dry-run never needs a DB connection.
    const { prisma } = await import('../prisma');

    // Pass 1 — scalar reference rows, upsert on airtable_id.
    for (const e of employees) {
      await prisma.employee.upsert({
        where: { airtableId: e.airtableId },
        create: e,
        update: { name: e.name, email: e.email, team: e.team, division: e.division, employmentType: e.employmentType, active: e.active, syncedAt: new Date() },
      });
    }
    for (const d of dimensions) {
      await prisma.dimension.upsert({ where: { airtableId: d.airtableId }, create: d, update: { label: d.label, syncedAt: new Date() } });
    }
    for (const ev of eventTypes) {
      await prisma.eventType.upsert({ where: { airtableId: ev.airtableId }, create: ev, update: { name: ev.name, active: ev.active, syncedAt: new Date() } });
    }
    for (const a of assetTypes) {
      await prisma.assetType.upsert({
        where: { airtableId: a.airtableId },
        create: { airtableId: a.airtableId, name: a.name, category: a.category, active: a.active },
        update: { name: a.name, category: a.category, active: a.active, syncedAt: new Date() },
      });
    }

    for (const oc of officialCalendars) {
      await prisma.officialCalendar.upsert({ where: { airtableId: oc.airtableId }, create: oc, update: { name: oc.name, status: oc.status, startDate: oc.startDate, endDate: oc.endDate, syncedAt: new Date() } });
    }
    for (const au of authors) {
      await prisma.author.upsert({ where: { airtableId: au.airtableId }, create: au, update: { name: au.name, title: au.title, syncedAt: new Date() } });
    }

    // Build airtable_id → our uuid maps for link resolution.
    const idMap = async (model: 'employee' | 'eventType' | 'dimension' | 'assetType') => {
      const rows = await (prisma[model] as { findMany: (a: unknown) => Promise<{ id: string; airtableId: string | null }[]> }).findMany({ select: { id: true, airtableId: true } });
      return new Map(rows.filter((r) => r.airtableId).map((r) => [r.airtableId as string, r.id]));
    };
    const [empMap, evtMap, dimMap, atMap] = [await idMap('employee'), await idMap('eventType'), await idMap('dimension'), await idMap('assetType')];

    // Pass 2 — rebuild each asset_type's join rows from the resolved links.
    for (const a of assetTypes) {
      const atId = atMap.get(a.airtableId);
      if (!atId) continue;
      const resolve = (ids: string[], m: Map<string, string>) => ids.map((x) => m.get(x)).filter((x): x is string => !!x);

      await prisma.assetTypeEventType.deleteMany({ where: { assetTypeId: atId } });
      await prisma.assetTypeEventType.createMany({ data: resolve(a.links.eventTypes, evtMap).map((eventTypeId) => ({ assetTypeId: atId, eventTypeId })), skipDuplicates: true });

      await prisma.assetTypeTeamLead.deleteMany({ where: { assetTypeId: atId } });
      await prisma.assetTypeTeamLead.createMany({ data: resolve(a.links.teamLeads, empMap).map((employeeId) => ({ assetTypeId: atId, employeeId })), skipDuplicates: true });

      await prisma.assetTypePreferredEditor.deleteMany({ where: { assetTypeId: atId } });
      await prisma.assetTypePreferredEditor.createMany({ data: resolve(a.links.preferredEditors, empMap).map((employeeId) => ({ assetTypeId: atId, employeeId })), skipDuplicates: true });

      await prisma.assetTypeDimension.deleteMany({ where: { assetTypeId: atId } });
      await prisma.assetTypeDimension.createMany({ data: resolve(a.links.dimensions, dimMap).map((dimensionId) => ({ assetTypeId: atId, dimensionId })), skipDuplicates: true });
    }
  }

  return {
    dryRun,
    counts: { employees: employees.length, dimensions: dimensions.length, eventTypes: eventTypes.length, assetTypes: assetTypes.length, officialCalendars: officialCalendars.length, authors: authors.length },
    linkEdges,
    samples: { employee: employees[0]?.name, eventType: eventTypes[0]?.name, assetType: assetTypes[0]?.name },
  };
}
