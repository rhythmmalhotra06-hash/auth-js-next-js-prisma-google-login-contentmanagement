// Historical migration: one-time (re-runnable) backfill of transactional data
// from Airtable → Postgres. Airtable-only for now (no Jira CSV).
//
// Scope:
//   Stage 1 — tickets from 🎯 Prio: Creatives Requests (two-pass, like sync.ts).
//   Stage 2a — raw/final assets derived from each ticket's file/link fields.
//   Stage 2b — standalone library assets (Ad Creatives, Final Ad Asset, Best Videos).
//   Stage 3 — performance metrics: DEFERRED (stub only; see note at bottom).
//
// Idempotent: every row carries a stable airtable_id (real recId, or a synthetic
// `${ticketRecId}:raw` / `prefix:recId` for derived/library rows) so re-runs
// upsert instead of duplicating. Reference sync MUST run first so the link
// targets (employees, event_types, asset_types, …) already exist.

import { listRecords } from './client';
import { TICKETS, AD_CREATIVES, FINAL_AD_ASSET, BEST_VIDEOS } from './field-map';

/** First string out of an Airtable value (handles scalar / array / null). */
function str(v: unknown): string | null {
  if (typeof v === 'string') return v.length ? v : null;
  if (typeof v === 'number') return String(v);
  if (Array.isArray(v)) return v.length ? str(v[0]) : null;
  if (v == null) return null;
  if (typeof v === 'object' && 'name' in (v as object)) return String((v as { name: unknown }).name);
  return String(v);
}

/** Numeric value from an Airtable scalar (rating/number/formula), or null. */
function numVal(v: unknown): number | null {
  if (typeof v === 'number') return v;
  if (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))) return Number(v);
  if (Array.isArray(v) && v.length) return numVal(v[0]);
  return null;
}

/** Array of linked record IDs from a multipleRecordLinks value. */
function linkIds(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}

/** Parse an Airtable date string into a Date, or null. */
function dateVal(v: unknown): Date | null {
  return typeof v === 'string' && v ? new Date(v) : null;
}

/** First attachment URL from a multipleAttachments value, or null. */
function attachmentUrl(v: unknown): string | null {
  if (Array.isArray(v) && v.length && typeof v[0] === 'object' && v[0] && 'url' in v[0]) {
    return String((v[0] as { url: unknown }).url);
  }
  return null;
}

/** Use a value only if it looks like an http(s) URL. */
function urlLike(v: unknown): string | null {
  const s = str(v);
  return s && /^https?:\/\//i.test(s) ? s : null;
}

export interface MigrateReport {
  dryRun: boolean;
  tickets: { fetched: number; linkEdges: { eventType: number; assetType: number; assignee: number; requester: number; officialCalendar: number; authors: number }; unresolved: number };
  assets: { fromTickets: number; adCreatives: number; finalAdAssets: number; bestVideos: number };
  samples: { ticket?: string; asset?: string };
}

export async function migrateHistory(opts: { dryRun?: boolean } = {}): Promise<MigrateReport> {
  const dryRun = opts.dryRun ?? false;

  // --- Fetch (sequential; client.ts paces requests under the per-base limit) ---
  const ticketRecs = await listRecords(TICKETS.baseId, TICKETS.tableId);
  const adRecs = await listRecords(AD_CREATIVES.baseId, AD_CREATIVES.tableId);
  const finalRecs = await listRecords(FINAL_AD_ASSET.baseId, FINAL_AD_ASSET.tableId);
  const bestRecs = await listRecords(BEST_VIDEOS.baseId, BEST_VIDEOS.tableId);

  const T = TICKETS.fields;
  const TL = TICKETS.links;

  // Shape ticket rows (scalars) + keep raw link arrays for pass 2.
  const tickets = ticketRecs.map((r) => ({
    airtableId: r.id,
    title: str(r.fields[T.name]) ?? `Ticket ${r.id}`,
    creativeBrief: str(r.fields[T.creativeBrief]),
    cta: str(r.fields[T.cta]),
    dueDate: dateVal(r.fields[T.dueDate]),
    prioStatus: str(r.fields[T.prioStatus]),
    ticketStatus: str(r.fields[T.ticketStatus]),
    queueRank: numVal(r.fields[T.queueRank]),
    priorityScore: numVal(r.fields[T.score]),
    publishedAt: dateVal(r.fields[T.publishedAt]),
    typeOfRequest: str(r.fields[T.typeOfRequest]),
    teamServiceLevel: str(r.fields[T.teamServiceLevel]),
    notes: str(r.fields[T.notes]),
    // link arrays
    links: {
      eventTypes: linkIds(r.fields[TL.eventTypes]),
      assetTypes: linkIds(r.fields[TL.assetTypes]),
      assignedCreative: linkIds(r.fields[TL.assignedCreative]),
      assignedContractor: linkIds(r.fields[TL.assignedContractor]),
      requestedBy: linkIds(r.fields[TL.requestedBy]),
      officialCalendar: linkIds(r.fields[TL.officialCalendar]),
      speakers: linkIds(r.fields[TL.speakers]),
    },
    // raw asset link fields (Stage 2a)
    assetLinks: {
      raw: urlLike(r.fields[T.rawFileUrl]),
      output: str(r.fields[T.outputLink]),
      folder: urlLike(r.fields[T.assetFolderLink]),
      finals: [
        { dim: '16x9', url: str(r.fields[T.final16x9]) },
        { dim: '9x16', url: str(r.fields[T.final9x16]) },
        { dim: '4x5', url: str(r.fields[T.final4x5]) },
      ].filter((f) => f.url),
    },
  }));

  // Shape standalone library assets (Stage 2b). kind='final', no ticket link.
  const libAdCreatives = adRecs.map((r) => ({
    airtableId: `adcreative:${r.id}`,
    kind: 'final',
    name: str(r.fields[AD_CREATIVES.fields.name]) ?? str(r.fields[AD_CREATIVES.fields.title]),
    fileUrl: attachmentUrl(r.fields[AD_CREATIVES.fields.reference]) ?? urlLike(r.fields[AD_CREATIVES.fields.finalAsset]),
    publishedAt: dateVal(r.fields[AD_CREATIVES.fields.liveDate]),
    sourceTable: 'Ad Creatives',
  }));
  const libFinalAssets = finalRecs.map((r) => ({
    airtableId: `finaladasset:${r.id}`,
    kind: 'final',
    name: str(r.fields[FINAL_AD_ASSET.fields.code]),
    fileUrl: urlLike(r.fields[FINAL_AD_ASSET.fields.facebookPost]) ?? attachmentUrl(r.fields[FINAL_AD_ASSET.fields.image]) ?? str(r.fields[FINAL_AD_ASSET.fields.videoLink]),
    publishedAt: dateVal(r.fields[FINAL_AD_ASSET.fields.created]),
    sourceTable: '(VSL) Final Ad Asset',
  }));
  const libBestVideos = bestRecs.map((r) => ({
    airtableId: `bestvideo:${r.id}`,
    kind: 'final',
    name: str(r.fields[BEST_VIDEOS.fields.name]),
    fileUrl: urlLike(r.fields[BEST_VIDEOS.fields.videoUrl]) ?? attachmentUrl(r.fields[BEST_VIDEOS.fields.file]),
    publishedAt: dateVal(r.fields[BEST_VIDEOS.fields.releaseDate]),
    sourceTable: 'Best Videos',
  }));

  const report: MigrateReport = {
    dryRun,
    tickets: {
      fetched: tickets.length,
      linkEdges: {
        eventType: tickets.filter((t) => t.links.eventTypes.length).length,
        assetType: tickets.filter((t) => t.links.assetTypes.length).length,
        assignee: tickets.filter((t) => t.links.assignedCreative.length || t.links.assignedContractor.length).length,
        requester: tickets.filter((t) => t.links.requestedBy.length).length,
        officialCalendar: tickets.filter((t) => t.links.officialCalendar.length).length,
        authors: tickets.reduce((n, t) => n + t.links.speakers.length, 0),
      },
      unresolved: 0,
    },
    assets: {
      fromTickets: tickets.reduce((n, t) => n + (t.assetLinks.raw ? 1 : 0) + t.assetLinks.finals.length + (!t.assetLinks.finals.length && (t.assetLinks.output || t.assetLinks.folder) ? 1 : 0), 0),
      adCreatives: libAdCreatives.length,
      finalAdAssets: libFinalAssets.length,
      bestVideos: libBestVideos.length,
    },
    samples: { ticket: tickets[0]?.title, asset: libBestVideos[0]?.name ?? undefined },
  };

  if (dryRun) return report;

  // Lazy import so dry-run never needs a DB connection.
  const { prisma } = await import('../prisma');

  // --- Pass 1: upsert ticket scalars on airtable_id ---
  for (const t of tickets) {
    await prisma.ticket.upsert({
      where: { airtableId: t.airtableId },
      create: {
        airtableId: t.airtableId,
        title: t.title,
        creativeBrief: t.creativeBrief,
        cta: t.cta,
        dueDate: t.dueDate,
        prioStatus: t.prioStatus,
        ticketStatus: t.ticketStatus,
        queueRank: t.queueRank,
        priorityScore: t.priorityScore,
        typeOfRequest: t.typeOfRequest,
        teamServiceLevel: t.teamServiceLevel,
        notes: t.notes,
        source: 'airtable',
      },
      update: {
        title: t.title,
        creativeBrief: t.creativeBrief,
        cta: t.cta,
        dueDate: t.dueDate,
        prioStatus: t.prioStatus,
        ticketStatus: t.ticketStatus,
        queueRank: t.queueRank,
        priorityScore: t.priorityScore,
        typeOfRequest: t.typeOfRequest,
        teamServiceLevel: t.teamServiceLevel,
        notes: t.notes,
        syncedAt: new Date(),
      },
    });
  }

  // Build airtable_id → our uuid maps for link resolution.
  const idMap = async (model: 'employee' | 'eventType' | 'assetType' | 'officialCalendar' | 'author' | 'ticket') => {
    const rows = await (prisma[model] as { findMany: (a: unknown) => Promise<{ id: string; airtableId: string | null }[]> }).findMany({ select: { id: true, airtableId: true } });
    return new Map(rows.filter((r) => r.airtableId).map((r) => [r.airtableId as string, r.id]));
  };
  const [empMap, evtMap, atMap, ocMap, auMap, tkMap] = [
    await idMap('employee'),
    await idMap('eventType'),
    await idMap('assetType'),
    await idMap('officialCalendar'),
    await idMap('author'),
    await idMap('ticket'),
  ];
  const first = (ids: string[], m: Map<string, string>) => ids.map((x) => m.get(x)).find((x): x is string => !!x) ?? null;

  // --- Pass 2: resolve links + scalar FKs, seed first ticket_event ---
  let unresolved = 0;
  for (const t of tickets) {
    const tkId = tkMap.get(t.airtableId);
    if (!tkId) continue;

    const eventTypeId = first(t.links.eventTypes, evtMap);
    const assetTypeId = first(t.links.assetTypes, atMap);
    // Assigned Creative (employee) first; fall back to contractor link (also → employees where present).
    const assigneeId = first(t.links.assignedCreative, empMap) ?? first(t.links.assignedContractor, empMap);
    const requesterId = first(t.links.requestedBy, empMap);
    const officialCalendarId = first(t.links.officialCalendar, ocMap);
    if (t.links.assignedCreative.length && !assigneeId) unresolved++;

    await prisma.ticket.update({
      where: { id: tkId },
      data: { eventTypeId, assetTypeId, assigneeId, requesterId, officialCalendarId },
    });

    // ticket_authors join (rebuild from resolved speaker links).
    const authorIds = t.links.speakers.map((x) => auMap.get(x)).filter((x): x is string => !!x);
    if (authorIds.length) {
      await prisma.ticketAuthor.deleteMany({ where: { ticketId: tkId } });
      await prisma.ticketAuthor.createMany({ data: authorIds.map((authorId) => ({ ticketId: tkId, authorId })), skipDuplicates: true });
    }

    // Seed one audit-trail event only if the ticket has none (keeps re-runs idempotent).
    const eventCount = await prisma.ticketEvent.count({ where: { ticketId: tkId } });
    if (eventCount === 0) {
      await prisma.ticketEvent.create({
        data: { ticketId: tkId, toState: t.ticketStatus ?? 'Imported', note: 'imported from Airtable', actorId: requesterId },
      });
    }

    // --- Stage 2a: assets derived from this ticket's file/link fields ---
    if (t.assetLinks.raw) {
      await prisma.asset.upsert({
        where: { airtableId: `${t.airtableId}:raw` },
        create: { airtableId: `${t.airtableId}:raw`, ticketId: tkId, kind: 'raw', fileUrl: t.assetLinks.raw, sourceTable: 'Prio: raw file' },
        update: { ticketId: tkId, fileUrl: t.assetLinks.raw, syncedAt: new Date() },
      });
    }
    const distributionUrl = t.assetLinks.output ?? t.assetLinks.folder;
    if (t.assetLinks.finals.length) {
      for (const f of t.assetLinks.finals) {
        await prisma.asset.upsert({
          where: { airtableId: `${t.airtableId}:final:${f.dim}` },
          create: { airtableId: `${t.airtableId}:final:${f.dim}`, ticketId: tkId, kind: 'final', name: `${t.title} (${f.dim})`, fileUrl: f.url, distributionUrl, publishedAt: t.publishedAt, sourceTable: 'Prio: final link' },
          update: { ticketId: tkId, fileUrl: f.url, distributionUrl, publishedAt: t.publishedAt, syncedAt: new Date() },
        });
      }
    } else if (distributionUrl) {
      // No per-dimension final links, but there is an output/folder link.
      await prisma.asset.upsert({
        where: { airtableId: `${t.airtableId}:final` },
        create: { airtableId: `${t.airtableId}:final`, ticketId: tkId, kind: 'final', name: t.title, distributionUrl, publishedAt: t.publishedAt, sourceTable: 'Prio: output link' },
        update: { ticketId: tkId, distributionUrl, publishedAt: t.publishedAt, syncedAt: new Date() },
      });
    }
  }
  report.tickets.unresolved = unresolved;

  // --- Stage 2b: standalone library assets (no ticket link) ---
  for (const a of [...libAdCreatives, ...libFinalAssets, ...libBestVideos]) {
    await prisma.asset.upsert({
      where: { airtableId: a.airtableId },
      create: { airtableId: a.airtableId, kind: a.kind, name: a.name, fileUrl: a.fileUrl, publishedAt: a.publishedAt, sourceTable: a.sourceTable },
      update: { kind: a.kind, name: a.name, fileUrl: a.fileUrl, publishedAt: a.publishedAt, sourceTable: a.sourceTable, syncedAt: new Date() },
    });
  }

  // Stage 3 (performance metrics) is intentionally NOT wired here. The Prio table
  // and (VSL) Final Ad Asset carry ROAS/CTR/views columns; mapping those into the
  // `performance` table is a follow-on and must not block this backfill.

  return report;
}
