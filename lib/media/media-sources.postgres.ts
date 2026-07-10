// Media Sources reads — POSTGRES-backed read-mirror (MEDIA_BACKEND=postgres). Same MediaSource
// shape as the Airtable repo. Exposes airtableId as `id` (recId) because writes still go to
// Airtable (updateMediaSource by recId) and downstream links/vishen-sync use recIds. Rows without
// an airtableId (shouldn't happen — all mirrored rows have one) are skipped.

import { prisma } from '@/lib/prisma';
import type { AirtableResult } from '@/lib/airtable/rest';
import type { MediaSource } from '@/lib/media/repository';
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
    // Match Airtable's NOT({Status}='Archived'), which includes blank-status rows; Prisma's `not`
    // excludes nulls, so add them back.
    where: { OR: [{ status: null }, { status: { not: ARCHIVED } }] },
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

// NOTE: the dedupe reads (findMediaSourceByUrl / existing*SourceUrls / existingSourceRecordIds)
// intentionally stay Airtable-direct in the repository even under MEDIA_BACKEND=postgres — the PG
// mirror lags, so a not-yet-pulled Airtable duplicate could slip past the guard. Only the fast
// dashboard reads (listMediaSources/getMediaSource) come from PG here.
