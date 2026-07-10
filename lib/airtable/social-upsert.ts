// Upsert Airtable 📣 Social records → Postgres `social_posts`. Shared backbone for the
// backfill (all engine-origin rows) and the inbound pull (changed rows). Only app-managed
// fields are mapped; the officialCal same-base link is kept as a recId.

import { prisma } from '@/lib/prisma';
import { SOCIAL } from './field-map';
import { type AirtableRecord } from './rest';

const F = SOCIAL.fields;
const L = SOCIAL.links;

const str = (v: unknown): string | null => (typeof v === 'string' && v ? v : null);
const num = (v: unknown): number | null => (typeof v === 'number' && !Number.isNaN(v) ? v : null);
function selectName(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === 'string') return v || null;
  if (typeof v === 'object' && 'name' in (v as object)) return String((v as { name: unknown }).name);
  return String(v);
}
const firstLinkId = (v: unknown): string | null =>
  Array.isArray(v) && typeof v[0] === 'string' && v[0] ? v[0] : null;

export function socialUpsertData(rec: AirtableRecord) {
  const f = rec.fields as Record<string, unknown>;
  return {
    title: str(f[F.title]),
    notes: str(f[F.notes]),
    captions: str(f[F.captions]),
    status: selectName(f[F.status]),
    clipSourceUrl: str(f[F.clipSourceUrl]),
    sourceTitle: str(f[F.sourceTitle]),
    viralityScore: num(f[F.virality]),
    timecode: str(f[F.timecode]),
    creativeTicketId: str(f[F.creativeTicketId]),
    officialCalId: firstLinkId(f[L.officialCal]),
    createdTime: rec.createdTime ?? null,
  };
}

export async function upsertSocialFromRecords(records: AirtableRecord[]): Promise<number> {
  for (const rec of records) {
    const data = socialUpsertData(rec);
    await prisma.socialPost.upsert({
      where: { airtableId: rec.id },
      create: { airtableId: rec.id, ...data },
      update: { ...data, syncedAt: new Date() },
    });
  }
  return records.length;
}
