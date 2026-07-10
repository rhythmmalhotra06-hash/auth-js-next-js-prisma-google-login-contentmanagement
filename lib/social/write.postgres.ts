// Social writes — Postgres is the system of record (SOCIAL_BACKEND=postgres). Each write
// mutates PG and enqueues an AirtableOutbox row (entity 'social'); the drainer mirrors state
// back to the 📣 Social table. Mirrors the Airtable repo's function shapes so callers are untouched.

import { prisma } from '@/lib/prisma';
import type { AirtableResult } from '@/lib/airtable/rest';
import { SOCIAL as S } from '@/lib/airtable/field-map';
import type { ReelsClip } from '@/lib/clipping/schema';
import type { SocialSuggestion } from '@/lib/social/repository';
import { getSocialSuggestion } from '@/lib/social/data.postgres';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function createSocialSuggestions(
  sourceUrl: string,
  sourceTitle: string,
  clips: ReelsClip[],
  opts: { calendarId?: string | null } = {},
): Promise<AirtableResult<{ count: number; ids: string[] }>> {
  const ids: string[] = [];
  for (const c of clips) {
    const timecode = [c.timestampStart, c.timestampEnd].filter(Boolean).join('–');
    const row = await prisma.socialPost.create({
      data: {
        title: c.hookLine,
        notes: c.rationale ?? '',
        captions: c.caption,
        status: S.status_.proposal,
        clipSourceUrl: sourceUrl,
        sourceTitle: sourceTitle || null,
        viralityScore: c.viralityScore,
        timecode,
        officialCalId: opts.calendarId ?? null,
      },
    });
    ids.push(row.id);
  }
  if (ids.length) {
    await prisma.airtableOutbox.createMany({ data: ids.map((id) => ({ entity: 'social', entityId: id, op: 'upsert' })) });
  }
  return { ok: true, data: { count: ids.length, ids } };
}

async function patchSocial(idOrRec: string, data: Record<string, unknown>): Promise<AirtableResult<SocialSuggestion>> {
  const where = UUID_RE.test(idOrRec) ? { id: idOrRec } : { airtableId: idOrRec };
  const current = await prisma.socialPost.findFirst({ where, select: { id: true } });
  if (!current) return { ok: false, error: { type: 'NOT_FOUND', message: 'Social suggestion not found' } };
  await prisma.$transaction([
    prisma.socialPost.update({ where: { id: current.id }, data }),
    prisma.airtableOutbox.create({ data: { entity: 'social', entityId: current.id, op: 'upsert' } }),
  ]);
  return getSocialSuggestion(current.id);
}

/** Approve / reject a suggestion (status only). */
export async function setSocialStatus(id: string, status: 'approved' | 'reject'): Promise<AirtableResult<SocialSuggestion>> {
  return patchSocial(id, { status: S.status_[status] });
}

/** Stamp a suggestion as raised: store the Creative Services ticket recId + flip Status. */
export async function markSocialTicketRaised(id: string, ticketId: string): Promise<AirtableResult<SocialSuggestion>> {
  return patchSocial(id, { creativeTicketId: ticketId, status: S.status_.ticketRaised });
}
