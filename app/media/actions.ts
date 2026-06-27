'use server';

import { revalidatePath } from 'next/cache';
import { createTicket } from '@/app/intake/actions';
import { getEmployeeForSession } from '@/lib/employee';
import {
  createMediaSource,
  getClipsByIds,
  updateClipSuggestion,
  updateMediaSource,
} from '@/lib/media/repository';

// ── Submit a media link (portal intake) ─────────────────────────────────────

export interface SubmitMediaInput {
  url: string;
  title?: string;
  guestShow?: string;
  audience?: string; // Cold | Warm
}

export interface SubmitMediaResult {
  ok: boolean;
  id?: string;
  error?: string;
}

const YT_RE = /(?:youtube\.com\/(?:watch\?v=|live\/|embed\/|shorts\/)|youtu\.be\/)[A-Za-z0-9_-]{11}/;

export async function submitMediaLink(input: SubmitMediaInput): Promise<SubmitMediaResult> {
  const url = input.url?.trim();
  if (!url) return { ok: false, error: 'Paste a YouTube link.' };
  if (!YT_RE.test(url)) return { ok: false, error: 'That doesn’t look like a YouTube URL (v1 supports YouTube only).' };

  const employee = await getEmployeeForSession();

  const res = await createMediaSource({
    url,
    title: input.title?.trim() || null,
    platform: 'YouTube',
    guestShow: input.guestShow?.trim() || null,
    audience: input.audience?.trim() || null,
    submittedVia: 'Portal',
    submittedByRecId: employee?.airtableId ?? null,
  });

  if (!res.ok) return { ok: false, error: res.error.message };
  revalidatePath('/media');
  return { ok: true, id: res.data.id };
}

export async function archiveMediaSource(id: string): Promise<{ ok: boolean; error?: string }> {
  const res = await updateMediaSource(id, { status: 'Archived' });
  if (!res.ok) return { ok: false, error: res.error.message };
  revalidatePath('/media');
  return { ok: true };
}

// ── Batch clip → ticket conversion (propose → approve) ───────────────────────
// Ports app/content-engine/actions.ts:convertClipsToTickets to Airtable-direct
// clip rows; reuses the same createTicket() invariant (required taxonomy + scoring).

export interface ConvertClipsInput {
  clipIds: string[]; // Airtable Clip Suggestion recIds
  eventTypeId: string;
  assetTypeId: string;
  officialCalendarId: string;
  dueDate: string; // ISO date
  sourceUrl?: string; // for provenance in the ticket
  teamServiceLevel?: string; // defaults Social Media Video
  requesterId?: string; // Airtable Employee recId; defaults to session employee
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

function ticketTitle(c: { hookLine: string | null; name: string | null }): string {
  const base = (c.hookLine || c.name || 'Reels clip').trim();
  return base.length > 40 ? base.slice(0, 40).trim() : base;
}

export async function convertClipsToTickets(input: ConvertClipsInput): Promise<ConvertClipsResult> {
  if (!input.clipIds?.length) return { ok: false, created: 0, failed: [], error: 'No clips selected' };
  for (const [k, label] of [
    ['eventTypeId', 'Event Type'],
    ['assetTypeId', 'Asset Type'],
    ['officialCalendarId', 'Official Calendar'],
    ['dueDate', 'Due date'],
  ] as const) {
    if (!input[k]?.trim()) return { ok: false, created: 0, failed: [], error: `${label} is required` };
  }

  const requesterId = input.requesterId?.trim() || (await getEmployeeForSession())?.airtableId;
  if (!requesterId) {
    return { ok: false, created: 0, failed: [], error: 'No requester — pick who is requesting these tickets.' };
  }

  const clipsRes = await getClipsByIds(input.clipIds);
  if (!clipsRes.ok) return { ok: false, created: 0, failed: [], error: clipsRes.error.message };

  let created = 0;
  const failed: { clipId: string; error: string }[] = [];

  for (const c of clipsRes.data) {
    if (c.status === 'Approved' && c.ticketId) continue; // already converted — skip silently

    const range = c.timestampStart || c.timestampEnd ? ` (${c.timestampStart ?? '?'}–${c.timestampEnd ?? '?'})` : '';
    const sourceLinks = [input.sourceUrl, input.sourceUrl ? range.trim() : range.trim()].filter(Boolean).join(' ').trim();

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
      await updateClipSuggestion(c.id, { status: 'Approved', ticketRecId: res.ticketId });
      created += 1;
    } else {
      failed.push({ clipId: c.id, error: res.error ?? 'Failed to create ticket' });
    }
  }

  revalidatePath('/media');
  return { ok: failed.length === 0, created, failed };
}

export async function dismissClip(clipId: string): Promise<{ ok: boolean; error?: string }> {
  const res = await updateClipSuggestion(clipId, { status: 'Dismissed' });
  if (!res.ok) return { ok: false, error: res.error.message };
  revalidatePath('/media');
  return { ok: true };
}
