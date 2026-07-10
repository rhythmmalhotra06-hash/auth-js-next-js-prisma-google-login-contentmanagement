// Media Sources reads — POSTGRES-backed read-mirror (MEDIA_BACKEND=postgres). Same MediaSource
// shape as the Airtable repo. Exposes airtableId as `id` (recId) because writes still go to
// Airtable (updateMediaSource by recId) and downstream links/vishen-sync use recIds. Rows without
// an airtableId (shouldn't happen — all mirrored rows have one) are skipped.

import { prisma } from '@/lib/prisma';
import type { AirtableResult } from '@/lib/airtable/rest';
import type { MediaSource } from '@/lib/media/repository';
import { normalizeMediaUrl } from '@/lib/media/repository';
import { MEDIA_SOURCES } from '@/lib/airtable/field-map';

type Row = {
  airtableId: string | null;
  title: string | null;
  sourceUrl: string | null;
  downloadUrl: string | null;
  platform: string | null;
  status: string | null;
  guestShow: string | null;
  audience: string | null;
  submittedVia: string | null;
  usedWebSearch: boolean;
  strategyJson: string | null;
  transcript: string | null;
  error: string | null;
  submittedDate: string | null;
  clipsAddedDate: string | null;
  clipSuggestionIds: string[];
  submittedById: string | null;
  ticketEventTypeId: string | null;
  ticketAssetTypeId: string | null;
  ticketOfficialCalendarId: string | null;
  ticketDueDate: string | null;
  sourceRecordId: string | null;
  createdTime: string | null;
};

function toSource(s: Row): MediaSource {
  return {
    id: s.airtableId as string,
    title: s.title,
    sourceUrl: s.sourceUrl,
    downloadUrl: s.downloadUrl,
    platform: s.platform,
    status: s.status,
    guestShow: s.guestShow,
    audience: s.audience,
    submittedVia: s.submittedVia,
    usedWebSearch: s.usedWebSearch,
    strategyJson: s.strategyJson,
    transcript: s.transcript,
    error: s.error,
    submittedDate: s.submittedDate,
    clipsAddedDate: s.clipsAddedDate,
    clipCount: s.clipSuggestionIds.length,
    clipSuggestionIds: s.clipSuggestionIds,
    createdTime: s.createdTime ?? '',
    submittedById: s.submittedById,
    ticketEventTypeId: s.ticketEventTypeId,
    ticketAssetTypeId: s.ticketAssetTypeId,
    ticketOfficialCalendarId: s.ticketOfficialCalendarId,
    ticketDueDate: s.ticketDueDate,
    sourceRecordId: s.sourceRecordId,
  };
}

const SELECT = {
  airtableId: true, title: true, sourceUrl: true, downloadUrl: true, platform: true, status: true,
  guestShow: true, audience: true, submittedVia: true, usedWebSearch: true, strategyJson: true,
  transcript: true, error: true, submittedDate: true, clipsAddedDate: true, clipSuggestionIds: true,
  submittedById: true, ticketEventTypeId: true, ticketAssetTypeId: true, ticketOfficialCalendarId: true,
  ticketDueDate: true, sourceRecordId: true, createdTime: true,
} as const;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ARCHIVED = MEDIA_SOURCES.status_.archived;

export async function listMediaSources(limit = 100): Promise<AirtableResult<MediaSource[]>> {
  const rows = await prisma.mediaSource.findMany({
    where: { NOT: { status: ARCHIVED } },
    orderBy: [{ createdTime: 'desc' }],
    take: limit,
    select: SELECT,
  });
  return { ok: true, data: rows.filter((r) => r.airtableId).map(toSource) };
}

export async function getMediaSource(idOrRec: string): Promise<AirtableResult<MediaSource>> {
  const where = UUID_RE.test(idOrRec) ? { id: idOrRec } : { airtableId: idOrRec };
  const s = await prisma.mediaSource.findFirst({ where, select: SELECT });
  if (!s || !s.airtableId) return { ok: false, error: { type: 'NOT_FOUND', message: 'Media source not found' } };
  return { ok: true, data: toSource(s) };
}

export async function findMediaSourceByUrl(url: string): Promise<AirtableResult<MediaSource | null>> {
  const target = normalizeMediaUrl(url);
  if (!target) return { ok: true, data: null };
  const rows = await prisma.mediaSource.findMany({ select: SELECT }); // small table; scan incl. Archived
  const match = rows.filter((r) => r.airtableId).map(toSource).find((s) => normalizeMediaUrl(s.sourceUrl) === target);
  return { ok: true, data: match ?? null };
}

export async function existingSourceUrls(): Promise<AirtableResult<Set<string>>> {
  const rows = await prisma.mediaSource.findMany({ select: { sourceUrl: true } });
  const set = new Set<string>();
  for (const r of rows) if (r.sourceUrl) set.add(r.sourceUrl);
  return { ok: true, data: set };
}

export async function existingNormalizedSourceUrls(): Promise<AirtableResult<Set<string>>> {
  const rows = await prisma.mediaSource.findMany({ select: { sourceUrl: true } });
  const set = new Set<string>();
  for (const r of rows) { const u = normalizeMediaUrl(r.sourceUrl); if (u) set.add(u); }
  return { ok: true, data: set };
}

export async function existingSourceRecordIds(): Promise<AirtableResult<Set<string>>> {
  const rows = await prisma.mediaSource.findMany({ select: { sourceRecordId: true } });
  const set = new Set<string>();
  for (const r of rows) if (r.sourceRecordId) set.add(r.sourceRecordId);
  return { ok: true, data: set };
}
