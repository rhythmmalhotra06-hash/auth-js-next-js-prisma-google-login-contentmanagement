// Social board reads — POSTGRES-backed (SOCIAL_BACKEND=postgres). Same shapes as the
// Airtable repo. Suggestions expose the PG uuid as `id` (like tickets/shoots) so freshly
// engine-created proposals are actionable before the drainer assigns a recId; getSocialSuggestion
// accepts a uuid OR recId. The comms calendar exposes airtableId as `id` (it's a picker whose
// value is written into the Airtable officialCal link).

import { prisma } from '@/lib/prisma';
import type { AirtableResult } from '@/lib/airtable/rest';
import type { SocialSuggestion, CommsCalendarEntry } from '@/lib/social/repository';
import { SOCIAL } from '@/lib/airtable/field-map';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type SocialRow = {
  id: string;
  title: string | null;
  notes: string | null;
  captions: string | null;
  status: string | null;
  clipSourceUrl: string | null;
  sourceTitle: string | null;
  viralityScore: number | null;
  timecode: string | null;
  creativeTicketId: string | null;
  createdTime: string | null;
};

function toSuggestion(s: SocialRow): SocialSuggestion {
  return {
    id: s.id,
    title: s.title,
    notes: s.notes,
    captions: s.captions,
    status: s.status,
    clipSourceUrl: s.clipSourceUrl,
    sourceTitle: s.sourceTitle,
    viralityScore: s.viralityScore,
    timecode: s.timecode,
    creativeTicketId: s.creativeTicketId,
    ticketRaised: !!s.creativeTicketId,
    createdTime: s.createdTime ?? '',
  };
}

const SUG_SELECT = {
  id: true, title: true, notes: true, captions: true, status: true, clipSourceUrl: true,
  sourceTitle: true, viralityScore: true, timecode: true, creativeTicketId: true, createdTime: true,
} as const;

export async function listSocialSuggestions(opts: { includeRejected?: boolean } = {}): Promise<AirtableResult<SocialSuggestion[]>> {
  // Engine-origin rows carry a Clip Source URL (stored non-empty → not null). Exclude rejected
  // unless asked (retained for the feedback loop).
  const rows = await prisma.socialPost.findMany({
    where: {
      clipSourceUrl: { not: null },
      ...(opts.includeRejected ? {} : { status: { not: SOCIAL.status_.reject } }),
    },
    orderBy: [{ createdTime: 'desc' }],
    select: SUG_SELECT,
  });
  return { ok: true, data: rows.map(toSuggestion) };
}

export async function getSocialSuggestion(idOrRec: string): Promise<AirtableResult<SocialSuggestion>> {
  const where = UUID_RE.test(idOrRec) ? { id: idOrRec } : { airtableId: idOrRec };
  const s = await prisma.socialPost.findFirst({ where, select: SUG_SELECT });
  if (!s) return { ok: false, error: { type: 'NOT_FOUND', message: 'Social suggestion not found' } };
  return { ok: true, data: toSuggestion(s) };
}

export async function listCommsCalendarEntries(): Promise<AirtableResult<CommsCalendarEntry[]>> {
  const rows = await prisma.commsCalendar.findMany({
    select: { airtableId: true, name: true, status: true, startDate: true, endDate: true },
  });
  const data: CommsCalendarEntry[] = rows
    .filter((r): r is typeof r & { airtableId: string } => !!r.airtableId)
    .map((r) => ({ id: r.airtableId, name: r.name, status: r.status, startDate: r.startDate, endDate: r.endDate }))
    .sort((a, b) => (b.startDate ?? '').localeCompare(a.startDate ?? ''));
  return { ok: true, data };
}
