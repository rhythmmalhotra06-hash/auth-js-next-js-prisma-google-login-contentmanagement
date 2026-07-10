// Vishen Videos — POSTGRES-backed (VISHEN_VIDEOS_BACKEND=postgres). Read list + the narrow
// approval/rating/views24h write-back (PG + outbox 'vishenVideo'). Same VishenVideo shape as the
// Airtable repo, incl. the derived stage/channel. Exposes the PG uuid as `id`; updateVishenVideo
// accepts a uuid OR recId.

import { prisma } from '@/lib/prisma';
import type { AirtableResult } from '@/lib/airtable/rest';
import { type VishenVideo, stageOf, deriveChannel } from '@/lib/media/vishen-videos';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Row = {
  id: string;
  name: string | null;
  source: string | null;
  medium: string | null;
  format: string | null;
  product: string | null;
  status: string | null;
  approval: string | null;
  publishedLink: string | null;
  liveDate: string | null;
  rating: number | null;
  views24h: string | null;
  createdTime: string | null;
};

const SELECT = {
  id: true, name: true, source: true, medium: true, format: true, product: true, status: true,
  approval: true, publishedLink: true, liveDate: true, rating: true, views24h: true, createdTime: true,
} as const;

function toVideo(v: Row): VishenVideo {
  const rawStage = stageOf(v.status);
  const stage = rawStage === 'other' && v.publishedLink ? 'published' : rawStage;
  return {
    id: v.id,
    name: v.name,
    source: v.source,
    medium: v.medium,
    format: v.format,
    product: v.product,
    status: v.status,
    stage,
    approval: v.approval,
    publishedLink: v.publishedLink,
    channel: deriveChannel(v.publishedLink, v.medium),
    liveDate: v.liveDate,
    rating: v.rating,
    views24h: v.views24h,
    createdTime: v.createdTime ?? '',
  };
}

export async function listVishenVideos(limit = 200): Promise<AirtableResult<VishenVideo[]>> {
  const rows = await prisma.vishenVideo.findMany({ where: { NOT: { status: 'Rejected' } }, take: limit, select: SELECT });
  const data = rows.map(toVideo).sort((a, b) => {
    const ad = a.liveDate ?? '', bd = b.liveDate ?? '';
    if (ad !== bd) return ad < bd ? 1 : -1; // live date desc; empty last
    return a.createdTime < b.createdTime ? 1 : -1;
  });
  return { ok: true, data };
}

export async function updateVishenVideo(
  idOrRec: string,
  patch: { approval?: string; rating?: number; views24h?: string },
): Promise<AirtableResult<VishenVideo>> {
  const where = UUID_RE.test(idOrRec) ? { id: idOrRec } : { airtableId: idOrRec };
  const current = await prisma.vishenVideo.findFirst({ where, select: { id: true } });
  if (!current) return { ok: false, error: { type: 'NOT_FOUND', message: 'Video not found' } };

  const data: Record<string, unknown> = {};
  if (patch.approval !== undefined) data.approval = patch.approval;
  if (patch.rating !== undefined) data.rating = patch.rating;
  if (patch.views24h !== undefined) data.views24h = patch.views24h;

  await prisma.$transaction([
    prisma.vishenVideo.update({ where: { id: current.id }, data }),
    prisma.airtableOutbox.create({ data: { entity: 'vishenVideo', entityId: current.id, op: 'upsert' } }),
  ]);
  const updated = await prisma.vishenVideo.findUnique({ where: { id: current.id }, select: SELECT });
  return { ok: true, data: toVideo(updated as Row) };
}
