// Upsert Airtable 📺 Media Sources records → Postgres `media_sources` (read-mirror). Shared by
// backfill, the pull, and the write-through after createMediaSource/updateMediaSource. Link fields
// are kept as Airtable recIds. Clip Suggestions are NOT mirrored (only their recId list is stored).

import { prisma } from '@/lib/prisma';
import { MEDIA_SOURCES } from './field-map';
import { type AirtableRecord } from './rest';

const F = MEDIA_SOURCES.fields;
const L = MEDIA_SOURCES.links;

const str = (v: unknown): string | null => (typeof v === 'string' && v ? v : null);
function selectName(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === 'string') return v || null;
  if (typeof v === 'object' && 'name' in (v as object)) return String((v as { name: unknown }).name);
  return String(v);
}
function linkedIds(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => (typeof x === 'string' ? x : x && typeof x === 'object' && 'id' in x ? String((x as { id: unknown }).id) : null))
    .filter((x): x is string => !!x);
}
const firstLinkedId = (v: unknown): string | null => linkedIds(v)[0] ?? null;

export function mediaSourceUpsertData(rec: AirtableRecord) {
  const f = rec.fields as Record<string, unknown>;
  return {
    title: str(f[F.title]),
    sourceUrl: str(f[F.sourceUrl]),
    downloadUrl: str(f[F.downloadUrl]),
    platform: selectName(f[F.platform]),
    status: selectName(f[F.status]),
    guestShow: str(f[F.guestShow]),
    audience: selectName(f[F.audience]),
    submittedVia: selectName(f[F.submittedVia]),
    usedWebSearch: f[F.usedWebSearch] === true,
    strategyJson: str(f[F.strategyJson]),
    transcript: str(f[F.transcript]),
    error: str(f[F.error]),
    submittedDate: str(f[F.submittedDate]),
    clipsAddedDate: str(f[F.clipsAddedDate]),
    clipSuggestionIds: linkedIds(f[L.clipSuggestions]),
    submittedById: firstLinkedId(f[L.submittedBy]),
    ticketEventTypeId: firstLinkedId(f[L.ticketEventType]),
    ticketAssetTypeId: firstLinkedId(f[L.ticketAssetType]),
    ticketOfficialCalendarId: firstLinkedId(f[L.ticketOfficialCalendar]),
    ticketDueDate: str(f[F.ticketDueDate]),
    sourceRecordId: str(f[F.sourceRecordId]),
    createdTime: rec.createdTime ?? null,
  };
}

export async function upsertMediaSourcesFromRecords(records: AirtableRecord[]): Promise<number> {
  for (const rec of records) {
    const data = mediaSourceUpsertData(rec);
    await prisma.mediaSource.upsert({
      where: { airtableId: rec.id },
      create: { airtableId: rec.id, ...data },
      update: { ...data, syncedAt: new Date() },
    });
  }
  return records.length;
}
