'use server';

import { prisma } from '@/lib/prisma';
import { createTicket } from '@/app/intake/actions';
import { getEmployeeForSession } from '@/lib/employee';
import { fetchYouTubeTranscript, TranscriptFetchError } from '@/lib/clipping/transcript';

// ── YouTube fetch (form's URL tab) ─────────────────────────────────────────

export interface FetchYouTubeResult {
  ok: boolean;
  transcript?: string;
  error?: string;
}

export async function fetchYouTube(url: string): Promise<FetchYouTubeResult> {
  try {
    const transcript = await fetchYouTubeTranscript(url);
    return { ok: true, transcript };
  } catch (e) {
    const error = e instanceof TranscriptFetchError ? e.message : 'Failed to fetch the YouTube transcript.';
    return { ok: false, error };
  }
}

// ── Batch clip → ticket conversion (propose → approve) ─────────────────────

export interface ConvertClipsInput {
  clipIds: string[];
  eventTypeId: string;
  assetTypeId: string;
  officialCalendarId: string;
  dueDate: string; // ISO date
  teamServiceLevel?: string; // defaults to Social Media Video
  requesterId?: string; // defaults to the session employee
}

export interface ConvertClipsResult {
  ok: boolean;
  created: number;
  failed: { clipId: string; error: string }[];
  error?: string;
}

function brief(c: {
  rationale: string | null;
  caption: string | null;
  hookLine: string | null;
  timestampStart: string | null;
  timestampEnd: string | null;
}): string {
  const parts: string[] = [];
  if (c.hookLine) parts.push(`Hook: ${c.hookLine}`);
  if (c.rationale) parts.push(`Why this clip: ${c.rationale}`);
  if (c.caption) parts.push(`Suggested caption: ${c.caption}`);
  if (c.timestampStart || c.timestampEnd) parts.push(`Clip range: ${c.timestampStart ?? '?'}–${c.timestampEnd ?? '?'}`);
  return parts.join('\n\n');
}

function ticketTitle(c: { hookLine: string | null; title: string }): string {
  const base = (c.hookLine || c.title || 'Reels clip').trim();
  return base.length > 40 ? base.slice(0, 40).trim() : base;
}

export async function convertClipsToTickets(input: ConvertClipsInput): Promise<ConvertClipsResult> {
  if (!input.clipIds?.length) return { ok: false, created: 0, failed: [], error: 'No clips selected' };
  for (const [k, label] of [
    ['eventTypeId', 'Event Type'],
    ['assetTypeId', 'Asset Type'],
    // Official Calendar is optional (matches the intake form + createTicket).
    ['dueDate', 'Due date'],
  ] as const) {
    if (!input[k]?.trim()) return { ok: false, created: 0, failed: [], error: `${label} is required` };
  }

  const requesterId = input.requesterId?.trim() || (await getEmployeeForSession())?.id;
  if (!requesterId) {
    return { ok: false, created: 0, failed: [], error: 'No requester — pick who is requesting these tickets.' };
  }

  const clips = await prisma.clipSuggestion.findMany({
    where: { id: { in: input.clipIds } },
    include: { clipStrategy: { include: { contentSource: { select: { sourceUrl: true, title: true } } } } },
  });

  let created = 0;
  const failed: { clipId: string; error: string }[] = [];

  for (const c of clips) {
    if (c.status === 'approved' && c.ticketId) {
      continue; // already converted — skip silently
    }
    const src = c.clipStrategy.contentSource;
    const range = c.timestampStart || c.timestampEnd ? ` (${c.timestampStart ?? '?'}–${c.timestampEnd ?? '?'})` : '';
    const sourceLinks = [src.sourceUrl, src.sourceUrl ? range.trim() : `${src.title}${range}`].filter(Boolean).join(' ');

    const res = await createTicket({
      requesterId,
      title: ticketTitle(c),
      teamServiceLevel: input.teamServiceLevel?.trim() || 'Social Media Video',
      typeOfRequest: 'Video',
      eventTypeId: input.eventTypeId,
      assetTypeId: input.assetTypeId,
      officialCalendarId: input.officialCalendarId,
      authorIds: [],
      creativeBrief: brief(c),
      dueDate: input.dueDate,
      sourceLinks: sourceLinks || undefined,
    });

    if (res.ok && res.ticketId) {
      await prisma.clipSuggestion.update({
        where: { id: c.id },
        data: { status: 'approved', ticketId: res.ticketId },
      });
      created += 1;
    } else {
      failed.push({ clipId: c.id, error: res.error ?? 'Failed to create ticket' });
    }
  }

  return { ok: failed.length === 0, created, failed };
}

export async function dismissClip(clipId: string): Promise<{ ok: boolean }> {
  await prisma.clipSuggestion.update({ where: { id: clipId }, data: { status: 'dismissed' } });
  return { ok: true };
}
