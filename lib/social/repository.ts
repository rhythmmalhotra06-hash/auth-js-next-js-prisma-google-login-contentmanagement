// Social clip-suggestions repository — Airtable-direct against the 📣 Social table
// in the Content & Comms base. Mirrors lib/media/repository.ts (typed rows,
// AirtableResult returns, field-id mapping) but for the Marketing surface.
//
// Propose-only on generation: createSocialSuggestions writes "1: Proposal" rows.
// Tickets are created in the Creative Services Prio queue via the app's createTicket
// path (see app/social/actions.ts) — NOT in this base (the local 🎯 Prio table is a
// read-only synced mirror). We store the created ticket's recId in creativeTicketId
// and read its live status from the Creative Services base.

import { SOCIAL as S, TICKETS as T } from '@/lib/airtable/field-map';
import {
  listAll,
  listRecords,
  getRecord,
  createRecords,
  updateRecord,
  type AirtableRecord,
  type AirtableResult,
} from '@/lib/airtable/rest';
import type { ReelsClip } from '@/lib/clipping/schema';

const SF = S.fields;

type Raw = Record<string, unknown>;

const str = (v: unknown): string | null => (typeof v === 'string' && v ? v : null);
function selectName(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === 'string') return v || null;
  if (typeof v === 'object' && 'name' in (v as object)) return String((v as { name: unknown }).name);
  return String(v);
}

// ── Social suggestions ───────────────────────────────────────────────────────

export interface SocialSuggestion {
  id: string;
  title: string | null;
  notes: string | null;
  captions: string | null;
  status: string | null;
  clipSourceUrl: string | null;
  creativeTicketId: string | null; // recId of the ticket in the Creative Services Prio queue
  ticketRaised: boolean;
  createdTime: string;
}

function mapSuggestion(rec: AirtableRecord<Raw>): SocialSuggestion {
  const f = rec.fields;
  const ticketId = str(f[SF.creativeTicketId]);
  return {
    id: rec.id,
    title: str(f[SF.title]),
    notes: str(f[SF.notes]),
    captions: str(f[SF.captions]),
    status: selectName(f[SF.status]),
    clipSourceUrl: str(f[SF.clipSourceUrl]),
    creativeTicketId: ticketId,
    ticketRaised: !!ticketId,
    createdTime: rec.createdTime,
  };
}

const LIST_FIELDS = [SF.title, SF.notes, SF.captions, SF.status, SF.clipSourceUrl, SF.creativeTicketId];

/**
 * Engine-generated proposals — rows with a non-empty Clip Source URL (our origin
 * marker), newest first. Excludes rejected rows by default (retained for the
 * feedback loop but off the active board).
 */
export async function listSocialSuggestions(opts: { includeRejected?: boolean } = {}): Promise<AirtableResult<SocialSuggestion[]>> {
  const formula = opts.includeRejected
    ? `NOT({Clip Source URL} = '')`
    : `AND(NOT({Clip Source URL} = ''), {Status} != '${S.status_.reject}')`;
  const res = await listAll<Raw>(S.baseId, S.tableId, { filterByFormula: formula, fields: LIST_FIELDS });
  if (!res.ok) return res;
  const rows = res.data.map(mapSuggestion).sort((a, b) => (a.createdTime < b.createdTime ? 1 : -1));
  return { ok: true, data: rows };
}

export async function getSocialSuggestion(id: string): Promise<AirtableResult<SocialSuggestion>> {
  const res = await getRecord<Raw>(S.baseId, S.tableId, id);
  if (!res.ok) return res;
  return { ok: true, data: mapSuggestion(res.data) };
}

/**
 * Write one Proposal row per clip the engine returned. Status = "1: Proposal";
 * Clip Source URL stamps the origin. No ticket, no asset type yet.
 */
export async function createSocialSuggestions(
  sourceUrl: string,
  clips: ReelsClip[],
): Promise<AirtableResult<{ count: number; ids: string[] }>> {
  const records = clips.map((c) => {
    const brief = [
      c.rationale,
      `Suggested clip: ${c.timestampStart}–${c.timestampEnd} · virality ${c.viralityScore}/10`,
    ]
      .filter(Boolean)
      .join('\n\n');
    return {
      fields: {
        [SF.title]: c.hookLine,
        [SF.notes]: brief,
        [SF.captions]: c.caption,
        [SF.status]: S.status_.proposal,
        [SF.clipSourceUrl]: sourceUrl,
      } as Record<string, unknown>,
    };
  });
  const res = await createRecords<Raw>(S.baseId, S.tableId, records);
  if (!res.ok) return res;
  return { ok: true, data: { count: res.data.length, ids: res.data.map((r) => r.id) } };
}

/** Approve / reject a suggestion (status only). Reject is retained (not deleted). */
export async function setSocialStatus(id: string, status: 'approved' | 'reject'): Promise<AirtableResult<SocialSuggestion>> {
  const res = await updateRecord<Raw>(S.baseId, S.tableId, id, { [SF.status]: S.status_[status] });
  if (!res.ok) return res;
  return { ok: true, data: mapSuggestion(res.data) };
}

/** Stamp a suggestion as raised: store the Creative Services ticket recId + flip Status. */
export async function markSocialTicketRaised(id: string, ticketId: string): Promise<AirtableResult<SocialSuggestion>> {
  const res = await updateRecord<Raw>(S.baseId, S.tableId, id, {
    [SF.creativeTicketId]: ticketId,
    [SF.status]: S.status_.ticketRaised,
  });
  if (!res.ok) return res;
  return { ok: true, data: mapSuggestion(res.data) };
}

// ── Cross-base ticket status mirror ──────────────────────────────────────────

export interface TicketState {
  prioStatus: string | null;
  ticketStatus: string | null;
}

/**
 * Read live status for raised clips' tickets from the Creative Services Prio table.
 * One batched query keyed by record id. Returns a map: ticketRecId → state.
 */
export async function getSocialTicketStates(ticketIds: string[]): Promise<Record<string, TicketState>> {
  const ids = [...new Set(ticketIds.filter(Boolean))];
  if (!ids.length) return {};
  const formula = `OR(${ids.map((id) => `RECORD_ID() = '${id}'`).join(',')})`;
  const res = await listRecords<Raw>(T.baseId, T.tableId, {
    filterByFormula: formula,
    fields: [T.fields.prioStatus, T.fields.ticketStatus],
    pageSize: ids.length,
  });
  if (!res.ok) return {};
  const out: Record<string, TicketState> = {};
  for (const rec of res.data.records) {
    out[rec.id] = {
      prioStatus: selectName(rec.fields[T.fields.prioStatus]),
      ticketStatus: selectName(rec.fields[T.fields.ticketStatus]),
    };
  }
  return out;
}
