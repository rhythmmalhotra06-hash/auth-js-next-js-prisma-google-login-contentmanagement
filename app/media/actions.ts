'use server';

import { revalidatePath } from 'next/cache';
import { createTicket } from '@/app/intake/actions';
import { getEmployeeForSession } from '@/lib/employee';
import {
  createMediaSource,
  getClipsByIds,
  getMediaSource,
  listClipsToConvert,
  updateClipSuggestion,
  updateMediaSource,
  type ClipSuggestion,
  type MediaSource,
} from '@/lib/media/repository';
import { createMajorVideo, derivePlatform } from '@/lib/media/major-videos';
import { sliceTranscriptForClip } from '@/lib/clipping/transcript';

// ── Submit a media link (portal intake) ─────────────────────────────────────

export interface SubmitMediaInput {
  url: string;
  downloadUrl?: string; // optional editor download link (e.g. Dropbox) (E9.1)
  title?: string;
  guestShow?: string;
  audience?: string; // Cold | Warm
  transcript?: string; // optional — captured upfront so a blocked YouTube fetch never costs a round-trip
  type?: string; // content category (Major Videos "Select"); stored on Guest/Show when set
  writeBack?: boolean; // create + link a row in Vishen's Major Videos base. Default ON; pass false to skip.
}

export interface SubmitMediaResult {
  ok: boolean;
  id?: string;
  error?: string;
}

export async function submitMediaLink(input: SubmitMediaInput): Promise<SubmitMediaResult> {
  const url = input.url?.trim();
  if (!url) return { ok: false, error: 'Paste a media link first.' };

  const employee = await getEmployeeForSession();
  const platform = derivePlatform(url);
  const title = input.title?.trim() || null;
  // The type doubles as Guest/Show context when an explicit guestShow isn't given.
  const guestShow = input.guestShow?.trim() || input.type?.trim() || null;

  // Every portal add creates + links a row in Vishen's Major Videos base, so it never orphans
  // (the reverse Airtable automation is update-only and won't create from the portal side).
  // Best-effort: a Vishen-base write hiccup must not fail the user's add — we just leave it
  // unlinked, and the row can be linked later. Pass writeBack:false to opt out.
  let sourceRecordId: string | null = null;
  if (input.writeBack !== false) {
    const back = await createMajorVideo({ title: title ?? url, url, type: input.type?.trim() || null });
    if (back.ok) sourceRecordId = back.data.id;
    else console.error('submitMediaLink: Major Videos write-back failed:', back.error.message);
  }

  const res = await createMediaSource({
    url,
    // A non-YouTube link (Dropbox, Vimeo…) is also the editor's download link.
    downloadUrl: input.downloadUrl?.trim() || (platform === 'Other' ? url : null),
    title,
    platform,
    guestShow,
    audience: input.audience?.trim() || null,
    submittedVia: 'Portal',
    submittedByRecId: employee?.airtableId ?? null,
    transcript: input.transcript?.trim() || null,
    sourceRecordId,
  });

  if (!res.ok) return { ok: false, error: res.error.message };
  revalidatePath('/media');
  revalidatePath('/studio');
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

function brief(
  c: {
    rationale: string | null;
    caption: string | null;
    hookLine: string | null;
    timestampStart: string | null;
    timestampEnd: string | null;
  },
  verbatim?: { text: string; approximate: boolean } | null,
): string {
  const parts: string[] = [];
  if (c.hookLine) parts.push(`Hook: ${c.hookLine}`);
  if (c.rationale) parts.push(`Why this clip: ${c.rationale}`);
  if (c.caption) parts.push(`Suggested caption: ${c.caption}`);
  if (c.timestampStart || c.timestampEnd) parts.push(`Clip range: ${c.timestampStart ?? '?'}–${c.timestampEnd ?? '?'}`);
  // E9.1 — verbatim transcript excerpt so the editor can cut without chasing the source.
  if (verbatim) {
    const label = verbatim.approximate
      ? 'Verbatim (approx — locate the clip range in the full transcript)'
      : 'Verbatim (around the hook)';
    parts.push(`${label}:\n${verbatim.text}`);
  }
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
    // Official Calendar is optional (matches the intake form + createTicket).
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

  // E9.1 — load each clip's parent Media Source once (for the transcript + download link).
  const sources = new Map<string, MediaSource>();
  for (const sid of [...new Set(clipsRes.data.map((c) => c.mediaSourceId).filter((s): s is string => !!s))]) {
    const r = await getMediaSource(sid);
    if (r.ok) sources.set(sid, r.data);
  }

  let created = 0;
  const failed: { clipId: string; error: string }[] = [];

  for (const c of clipsRes.data) {
    if (c.status === 'Approved' && c.ticketId) continue; // already converted — skip silently

    const range = c.timestampStart || c.timestampEnd ? ` (${c.timestampStart ?? '?'}–${c.timestampEnd ?? '?'})` : '';
    const sourceLinks = [input.sourceUrl, input.sourceUrl ? range.trim() : range.trim()].filter(Boolean).join(' ').trim();

    const src = c.mediaSourceId ? sources.get(c.mediaSourceId) : undefined;
    const verbatim = sliceTranscriptForClip(src?.transcript, { hookLine: c.hookLine });

    const res = await createTicket({
      requesterId,
      title: ticketTitle(c),
      teamServiceLevel: input.teamServiceLevel?.trim() || 'Social Media Video',
      typeOfRequest: 'Video',
      eventTypeId: input.eventTypeId,
      assetTypeId: input.assetTypeId,
      officialCalendarId: input.officialCalendarId,
      authorIds: [],
      creativeBrief: brief(c, verbatim),
      dueDate: input.dueDate,
      sourceLinks: sourceLinks || undefined,
      downloadLink: src?.downloadUrl ?? undefined,
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

// ── Airtable checkbox → ticket (polled by /api/clips/convert) ────────────────
// Mirrors the portal modal, but taxonomy is inherited from the parent Media Source
// instead of typed in. A human ticks "Create Ticket" on a clip in Airtable; the
// hourly convert cron picks it up, creates the ticket (same createTicket invariant),
// links it back, and unticks the box so it doesn't re-fire.

export interface ConvertCheckedResult {
  ok: boolean;
  scanned: number; // ticked, non-dismissed clips found
  created: number; // tickets created this run
  failed: { clipId: string; error: string }[];
  error?: string;
}

function defaultDueDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString().slice(0, 10);
}

export async function convertCheckedClips(): Promise<ConvertCheckedResult> {
  const listRes = await listClipsToConvert();
  if (!listRes.ok) return { ok: false, scanned: 0, created: 0, failed: [], error: listRes.error.message };

  // Skip rows already converted (Approved + linked ticket) — they're tolerated by the
  // query but shouldn't create a second ticket; just untick them so they stop matching.
  const scanned = listRes.data.length;
  const fallbackRequester = process.env.DEFAULT_TICKET_REQUESTER_ID?.trim();
  const failed: { clipId: string; error: string }[] = [];
  let created = 0;

  const pending: ClipSuggestion[] = [];
  for (const c of listRes.data) {
    if (c.status === 'Approved' && c.ticketId) {
      await updateClipSuggestion(c.id, { createTicket: false });
      continue;
    }
    pending.push(c);
  }

  // Group by parent media source — all of a source's clips share its default taxonomy.
  const bySource = new Map<string, ClipSuggestion[]>();
  for (const c of pending) {
    if (!c.mediaSourceId) {
      failed.push({ clipId: c.id, error: 'Clip has no parent Media Source — cannot inherit taxonomy.' });
      continue;
    }
    const arr = bySource.get(c.mediaSourceId) ?? [];
    arr.push(c);
    bySource.set(c.mediaSourceId, arr);
  }

  for (const [sourceId, clips] of bySource) {
    const srcRes = await getMediaSource(sourceId);
    if (!srcRes.ok) {
      for (const c of clips) failed.push({ clipId: c.id, error: `Couldn't load Media Source: ${srcRes.error.message}` });
      continue;
    }
    const src = srcRes.data;

    const missing: string[] = [];
    if (!src.ticketEventTypeId) missing.push('Ticket Event Type');
    if (!src.ticketAssetTypeId) missing.push('Ticket Asset Type');
    const requesterId = src.submittedById || fallbackRequester;
    if (!requesterId) missing.push('a requester (set Submitted By on the source or DEFAULT_TICKET_REQUESTER_ID)');
    if (missing.length) {
      for (const c of clips) failed.push({ clipId: c.id, error: `Media Source is missing ${missing.join(', ')}.` });
      continue;
    }

    const res = await convertClipsToTickets({
      clipIds: clips.map((c) => c.id),
      eventTypeId: src.ticketEventTypeId!,
      assetTypeId: src.ticketAssetTypeId!,
      officialCalendarId: src.ticketOfficialCalendarId ?? '',
      dueDate: src.ticketDueDate || defaultDueDate(),
      sourceUrl: src.sourceUrl ?? undefined,
      requesterId,
    });

    const failedIds = new Set(res.failed.map((f) => f.clipId));
    for (const f of res.failed) failed.push(f);
    // Untick the box on every clip that converted cleanly so the cron won't re-fire it.
    for (const c of clips) {
      if (!failedIds.has(c.id)) {
        await updateClipSuggestion(c.id, { createTicket: false });
        created += 1;
      }
    }
  }

  revalidatePath('/media');
  return { ok: failed.length === 0, scanned, created, failed };
}

export async function dismissClip(clipId: string): Promise<{ ok: boolean; error?: string }> {
  const res = await updateClipSuggestion(clipId, { status: 'Dismissed' });
  if (!res.ok) return { ok: false, error: res.error.message };
  revalidatePath('/media');
  return { ok: true };
}
