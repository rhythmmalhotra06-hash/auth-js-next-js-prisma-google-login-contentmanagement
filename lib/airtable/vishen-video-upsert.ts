// Upsert Airtable 🎬 Videos records → Postgres `vishen_videos`. Shared by backfill + pull.

import { prisma } from '@/lib/prisma';
import { VISHEN_VIDEOS } from './field-map';
import { type AirtableRecord } from './rest';

const F = VISHEN_VIDEOS.fields;

const str = (v: unknown): string | null => (typeof v === 'string' && v ? v : null);
const num = (v: unknown): number | null => (typeof v === 'number' && !Number.isNaN(v) ? v : null);
function selectName(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === 'string') return v || null;
  if (typeof v === 'object' && 'name' in (v as object)) return String((v as { name: unknown }).name);
  return String(v);
}

export function vishenVideoUpsertData(rec: AirtableRecord) {
  const f = rec.fields as Record<string, unknown>;
  return {
    name: str(f[F.name]),
    source: selectName(f[F.source]),
    medium: selectName(f[F.medium]),
    format: selectName(f[F.format]),
    product: selectName(f[F.product]),
    status: selectName(f[F.status]),
    approval: selectName(f[F.approval]),
    publishedLink: str(f[F.publishedLink]),
    liveDate: str(f[F.liveDate]),
    rating: num(f[F.rating]),
    views24h: str(f[F.views24h]),
    createdTime: rec.createdTime ?? null,
  };
}

export async function upsertVishenVideosFromRecords(records: AirtableRecord[]): Promise<number> {
  for (const rec of records) {
    const data = vishenVideoUpsertData(rec);
    await prisma.vishenVideo.upsert({
      where: { airtableId: rec.id },
      create: { airtableId: rec.id, ...data },
      update: { ...data, syncedAt: new Date() },
    });
  }
  return records.length;
}
