// Media pipeline repository — Airtable-direct (📺 Media Sources + 🎬 Clip Suggestions).
// Mirrors the vendor-portal / ticket.repository pattern: typed rows, AirtableResult
// returns, field-id mapping via field-map.ts. No Postgres.

import { MEDIA_SOURCES as M, CLIP_SUGGESTIONS as C } from '@/lib/airtable/field-map';
import {
  listRecords,
  listAll,
  getRecord,
  createRecord,
  createRecords,
  updateRecord,
  type AirtableRecord,
  type AirtableResult,
} from '@/lib/airtable/rest';
import type { ReelsClip } from '@/lib/clipping/schema';
import { pushMediaSourceToMajorVideo, pushClipStatusToVishen } from '@/lib/media/vishen-sync';

const MF = M.fields;
const ML = M.links;
const CF = C.fields;
const CL = C.links;

type Raw = Record<string, unknown>;

function selectName(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === 'string') return v || null;
  if (typeof v === 'object' && 'name' in (v as object)) return String((v as { name: unknown }).name);
  return String(v);
}
const str = (v: unknown): string | null => (typeof v === 'string' && v ? v : null);
const num = (v: unknown): number | null => (typeof v === 'number' ? v : null);

// Airtable link fields come back as an array of recId strings via the REST API
// (returnFieldsByFieldId=true); tolerate the {id,name} object shape too.
function linkedIds(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => (typeof x === 'string' ? x : x && typeof x === 'object' && 'id' in x ? String((x as { id: unknown }).id) : null))
    .filter((x): x is string => !!x);
}
const firstLinkedId = (v: unknown): string | null => linkedIds(v)[0] ?? null;

// ── Media Sources ──────────────────────────────────────────────────────────

export interface MediaSource {
  id: string;
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
  clipCount: number;
  clipSuggestionIds: string[];
  createdTime: string;
  // Default taxonomy for tickets created from this source's clips (checkbox convert).
  submittedById: string | null;
  ticketEventTypeId: string | null;
  ticketAssetTypeId: string | null;
  ticketOfficialCalendarId: string | null;
  ticketDueDate: string | null;
  // Provenance: originating record id when synced from / written back to another base (Major Videos).
  sourceRecordId: string | null;
}

function mapSource(rec: AirtableRecord<Raw>): MediaSource {
  const f = rec.fields;
  return {
    id: rec.id,
    title: str(f[MF.title]),
    sourceUrl: str(f[MF.sourceUrl]),
    downloadUrl: str(f[MF.downloadUrl]),
    platform: selectName(f[MF.platform]),
    status: selectName(f[MF.status]),
    guestShow: str(f[MF.guestShow]),
    audience: selectName(f[MF.audience]),
    submittedVia: selectName(f[MF.submittedVia]),
    usedWebSearch: f[MF.usedWebSearch] === true,
    strategyJson: str(f[MF.strategyJson]),
    transcript: str(f[MF.transcript]),
    error: str(f[MF.error]),
    submittedDate: str(f[MF.submittedDate]),
    clipsAddedDate: str(f[MF.clipsAddedDate]),
    clipCount: Array.isArray(f[ML.clipSuggestions]) ? (f[ML.clipSuggestions] as unknown[]).length : 0,
    clipSuggestionIds: linkedIds(f[ML.clipSuggestions]),
    createdTime: rec.createdTime,
    submittedById: firstLinkedId(f[ML.submittedBy]),
    ticketEventTypeId: firstLinkedId(f[ML.ticketEventType]),
    ticketAssetTypeId: firstLinkedId(f[ML.ticketAssetType]),
    ticketOfficialCalendarId: firstLinkedId(f[ML.ticketOfficialCalendar]),
    ticketDueDate: str(f[MF.ticketDueDate]),
    sourceRecordId: str(f[MF.sourceRecordId]),
  };
}

const LIST_FIELDS = [
  MF.title, MF.sourceUrl, MF.downloadUrl, MF.platform, MF.status, MF.guestShow, MF.audience,
  MF.submittedVia, MF.usedWebSearch, MF.error, MF.submittedDate, MF.clipsAddedDate, ML.clipSuggestions,
  MF.sourceRecordId,
];

/**
 * Inbox list — newest first. Excludes Archived. Paginates: the non-archived set is
 * small today but grows over time, and a single page caps at 100 — without paging,
 * the newest sources could fall beyond page 1 (default order) and vanish before the
 * client-side createdTime sort. `limit` still caps the total.
 */
export async function listMediaSources(limit = 100): Promise<AirtableResult<MediaSource[]>> {
  const res = await listAll<Raw>(M.baseId, M.tableId, {
    fields: LIST_FIELDS,
    filterByFormula: `NOT({Status} = 'Archived')`,
    maxRecords: limit,
  });
  if (!res.ok) return res;
  const rows = res.data
    .map(mapSource)
    .sort((a, b) => (a.createdTime < b.createdTime ? 1 : -1));
  return { ok: true, data: rows };
}

/** Single source (full fields incl. Strategy JSON). */
export async function getMediaSource(id: string): Promise<AirtableResult<MediaSource>> {
  const res = await getRecord<Raw>(M.baseId, M.tableId, id);
  if (!res.ok) return res;
  return { ok: true, data: mapSource(res.data) };
}

export interface CreateMediaSourceInput {
  url?: string | null; // optional — pasted/uploaded transcripts (Content Engine) have no URL
  downloadUrl?: string | null; // optional editor download link (e.g. Dropbox) (E9.1)
  title?: string | null;
  platform?: string; // defaults YouTube
  guestShow?: string | null;
  audience?: string | null; // Cold | Warm
  submittedVia: string; // Portal | Airtable | Slack | Auto-discover
  submittedByRecId?: string | null; // Employee recId
  transcript?: string | null; // captured source transcript
  status?: string; // defaults New
  sourceRecordId?: string | null; // originating record id (Major Videos) — provenance/dedupe
}

export async function createMediaSource(input: CreateMediaSourceInput): Promise<AirtableResult<MediaSource>> {
  const fields: Record<string, unknown> = {
    [MF.platform]: input.platform ?? 'YouTube',
    [MF.status]: input.status ?? M.status_.new,
    [MF.submittedVia]: input.submittedVia,
    [MF.submittedDate]: new Date().toISOString(), // capture submission timestamp
  };
  if (input.url) fields[MF.sourceUrl] = input.url;
  if (input.downloadUrl) fields[MF.downloadUrl] = input.downloadUrl;
  if (input.title) fields[MF.title] = input.title;
  if (input.guestShow) fields[MF.guestShow] = input.guestShow;
  if (input.audience) fields[MF.audience] = input.audience;
  if (input.transcript) fields[MF.transcript] = input.transcript.slice(0, 95000);
  if (input.submittedByRecId) fields[ML.submittedBy] = [input.submittedByRecId];
  if (input.sourceRecordId) fields[MF.sourceRecordId] = input.sourceRecordId;

  const res = await createRecord<Raw>(M.baseId, M.tableId, fields);
  if (!res.ok) return res;
  return { ok: true, data: mapSource(res.data) };
}

export async function updateMediaSource(
  id: string,
  patch: Partial<Record<keyof typeof MF, unknown>>,
): Promise<AirtableResult<MediaSource>> {
  const fields: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(patch)) fields[MF[k as keyof typeof MF]] = v;
  const res = await updateRecord<Raw>(M.baseId, M.tableId, id, fields);
  if (!res.ok) return res;
  const updated = mapSource(res.data);
  // Outbound: mirror shared fields onto the linked Major Video (best-effort, diff-guarded).
  if (updated.sourceRecordId) {
    try { await pushMediaSourceToMajorVideo(updated); } catch { /* sync is best-effort */ }
  }
  return { ok: true, data: updated };
}

/** Existing source URLs (for auto-discover dedupe). */
export async function existingSourceUrls(): Promise<AirtableResult<Set<string>>> {
  const res = await listAll<Raw>(M.baseId, M.tableId, { fields: [MF.sourceUrl] });
  if (!res.ok) return res;
  const set = new Set<string>();
  for (const rec of res.data) {
    const u = str(rec.fields[MF.sourceUrl]);
    if (u) set.add(u);
  }
  return { ok: true, data: set };
}

/** Existing Source Record IDs (for cross-base dedupe — Major Videos sync + write-back). */
export async function existingSourceRecordIds(): Promise<AirtableResult<Set<string>>> {
  const res = await listAll<Raw>(M.baseId, M.tableId, { fields: [MF.sourceRecordId] });
  if (!res.ok) return res;
  const set = new Set<string>();
  for (const rec of res.data) {
    const id = str(rec.fields[MF.sourceRecordId]);
    if (id) set.add(id);
  }
  return { ok: true, data: set };
}

// ── Clip Suggestions ─────────────────────────────────────────────────────────

export interface ClipSuggestion {
  id: string;
  index: number | null;
  name: string | null;
  timestampStart: string | null;
  timestampEnd: string | null;
  hookLine: string | null;
  rationale: string | null;
  caption: string | null;
  format: string | null;
  viralityScore: number | null;
  status: string | null;
  ticketId: string | null;
  mediaSourceId: string | null;
  vishenClipId: string | null;
  appTicketId: string | null; // ticket id created from this clip (Airtable recId or PG uuid) — reconcile key
}

function mapClip(rec: AirtableRecord<Raw>): ClipSuggestion {
  const f = rec.fields;
  return {
    id: rec.id,
    index: num(f[CF.index]),
    name: str(f[CF.name]),
    timestampStart: str(f[CF.timestampStart]),
    timestampEnd: str(f[CF.timestampEnd]),
    hookLine: str(f[CF.hookLine]),
    rationale: str(f[CF.rationale]),
    caption: str(f[CF.caption]),
    format: selectName(f[CF.format]),
    viralityScore: num(f[CF.viralityScore]),
    status: selectName(f[CF.status]),
    ticketId: firstLinkedId(f[CL.ticket]),
    mediaSourceId: firstLinkedId(f[CL.mediaSource]),
    vishenClipId: str(f[CF.vishenClipId]),
    appTicketId: str(f[CF.appTicketId]),
  };
}

/**
 * All clips with a given Status (across sources), highest virality first. For the cockpit.
 * Sorts by Virality Score server-side so the single page (capped at `limit` ≤100) holds
 * the genuinely top clips — without it, a status with >100 clips would return an arbitrary
 * page and the most-viral ones could be missing. The client re-sort is then a no-op safety.
 */
export async function listClipsByStatus(status: string, limit = 60): Promise<AirtableResult<ClipSuggestion[]>> {
  const res = await listRecords<Raw>(C.baseId, C.tableId, {
    filterByFormula: `{Status} = '${status.replace(/'/g, "\\'")}'`,
    sort: [{ field: CF.viralityScore, direction: 'desc' }],
    maxRecords: limit,
  });
  if (!res.ok) return res;
  const rows = res.data.records.map(mapClip).sort((a, b) => (b.viralityScore ?? 0) - (a.viralityScore ?? 0));
  return { ok: true, data: rows };
}

/**
 * Clips for a source, ordered by Index. Airtable can't filter a link field by
 * recId via filterByFormula (formulas match the linked record's primary text, not
 * its id), so we read the parent's reverse-link array and fetch those clip rows.
 *
 * Pass `linkedClipIds` to skip the parent re-fetch when the caller already holds
 * the source record (e.g. the media detail page just called getMediaSource).
 */
export async function listClipSuggestions(
  mediaSourceId: string,
  linkedClipIds?: string[],
): Promise<AirtableResult<ClipSuggestion[]>> {
  let ids = linkedClipIds;
  if (!ids) {
    const parent = await getRecord<Raw>(M.baseId, M.tableId, mediaSourceId);
    if (!parent.ok) return parent;
    ids = linkedIds(parent.data.fields[ML.clipSuggestions]);
  }
  if (ids.length === 0) return { ok: true, data: [] };
  const res = await getClipsByIds(ids);
  if (!res.ok) return res;
  return { ok: true, data: res.data.sort((a, b) => (a.index ?? 0) - (b.index ?? 0)) };
}

/**
 * Clips whose "Create Ticket" checkbox is ticked and that aren't dismissed — the
 * Airtable-driven convert queue (polled by /api/clips/convert). Already-converted
 * rows (Status Approved + linked ticket) are tolerated here and skipped downstream
 * by convertClipsToTickets; the convert cron also unticks the box after success.
 */
export async function listClipsToConvert(limit = 100): Promise<AirtableResult<ClipSuggestion[]>> {
  const res = await listAll<Raw>(C.baseId, C.tableId, {
    filterByFormula: `AND({Create Ticket} = TRUE(), {Status} != '${C.status_.dismissed}')`,
    maxRecords: limit,
  });
  if (!res.ok) return res;
  return { ok: true, data: res.data.map(mapClip) };
}

/**
 * Get clip rows by recId (for convert-to-ticket and the source detail view).
 * Batched: a single list call per ≤50 ids via RECORD_ID() instead of one GET per
 * id — collapses what used to be an N+1 (50 clips = 51 requests) down to ~1.
 */
export async function getClipsByIds(ids: string[]): Promise<AirtableResult<ClipSuggestion[]>> {
  if (ids.length === 0) return { ok: true, data: [] };
  const out: ClipSuggestion[] = [];
  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50);
    const formula = `OR(${chunk.map((id) => `RECORD_ID()='${id}'`).join(',')})`;
    const res = await listAll<Raw>(C.baseId, C.tableId, { filterByFormula: formula });
    if (!res.ok) return res;
    out.push(...res.data.map(mapClip));
  }
  return { ok: true, data: out };
}

/** Batch-create clip rows from a generated strategy's reelsClips. */
export async function createClipSuggestions(
  mediaSourceId: string,
  clips: ReelsClip[],
): Promise<AirtableResult<{ count: number; ids: string[] }>> {
  const now = new Date().toISOString();
  const records = clips.map((c, i) => ({
    fields: {
      [CF.name]: (c.hookLine || `Clip ${i + 1}`).slice(0, 200),
      [CL.mediaSource]: [mediaSourceId],
      [CF.index]: i + 1,
      [CF.addedDate]: now,
      [CF.timestampStart]: c.timestampStart ?? '',
      [CF.timestampEnd]: c.timestampEnd ?? '',
      [CF.hookLine]: c.hookLine ?? '',
      [CF.rationale]: c.rationale ?? '',
      [CF.caption]: c.caption ?? '',
      [CF.format]: c.format,
      [CF.viralityScore]: c.viralityScore,
      [CF.status]: C.status_.proposed,
    },
  }));
  const res = await createRecords(C.baseId, C.tableId, records);
  if (!res.ok) return res;
  // ids are in clip order — the caller zips them with `clips` to mirror into Vishen's base.
  return { ok: true, data: { count: res.data.length, ids: res.data.map((r) => r.id) } };
}

export async function updateClipSuggestion(
  id: string,
  patch: { status?: string; ticketRecId?: string; createTicket?: boolean; appTicketId?: string },
): Promise<AirtableResult<ClipSuggestion>> {
  const fields: Record<string, unknown> = {};
  if (patch.status) fields[CF.status] = patch.status;
  if (patch.ticketRecId) fields[CL.ticket] = [patch.ticketRecId];
  if (patch.createTicket !== undefined) fields[CF.createTicket] = patch.createTicket;
  if (patch.appTicketId !== undefined) fields[CF.appTicketId] = patch.appTicketId;
  const res = await updateRecord<Raw>(C.baseId, C.tableId, id, fields);
  if (!res.ok) return res;
  const clip = mapClip(res.data);
  // Outbound: when status changes, mirror it onto the linked Vishen Clips row (best-effort).
  if (patch.status) {
    try { await pushClipStatusToVishen(clip.vishenClipId, clip.status); } catch { /* best-effort */ }
  }
  return { ok: true, data: clip };
}
