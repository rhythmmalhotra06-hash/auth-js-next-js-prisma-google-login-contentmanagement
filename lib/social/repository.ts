// Social clip-suggestions repository — Airtable-direct against the 📣 Social table
// in the Content & Comms base. Mirrors lib/media/repository.ts (typed rows,
// AirtableResult returns, field-id mapping) but for the Marketing surface.
//
// Propose-only: this module writes Proposal rows and updates their status / asset
// type. It NEVER creates Prio tickets — the Airtable fan-out automation owns that
// (docs/airtable-automations/social-proposals-to-prio.js).

import { SOCIAL as S, SOCIAL_ASSET_TYPES as A } from '@/lib/airtable/field-map';
import {
  listAll,
  getRecord,
  createRecords,
  updateRecord,
  type AirtableRecord,
  type AirtableResult,
} from '@/lib/airtable/rest';
import type { ReelsClip } from '@/lib/clipping/schema';

const SF = S.fields;
const SL = S.links;

type Raw = Record<string, unknown>;

const str = (v: unknown): string | null => (typeof v === 'string' && v ? v : null);
function selectName(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === 'string') return v || null;
  if (typeof v === 'object' && 'name' in (v as object)) return String((v as { name: unknown }).name);
  return String(v);
}
// Lookups come back as arrays; flatten to the first display string.
function lookupOne(v: unknown): string | null {
  if (Array.isArray(v)) {
    const first = v[0];
    if (first == null) return null;
    return typeof first === 'object' && 'name' in (first as object)
      ? String((first as { name: unknown }).name)
      : String(first);
  }
  return selectName(v);
}
function linkedIds(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => (typeof x === 'string' ? x : x && typeof x === 'object' && 'id' in x ? String((x as { id: unknown }).id) : null))
    .filter((x): x is string => !!x);
}

// ── Social suggestions ───────────────────────────────────────────────────────

export interface SocialSuggestion {
  id: string;
  title: string | null;
  notes: string | null;
  captions: string | null;
  status: string | null;
  clipSourceUrl: string | null;
  raiseRequested: boolean;
  assetTypeId: string | null;
  ticketRaised: boolean; // has a linked Creative Request
  // Read-only mirror of the linked ticket's state.
  ticketStatus: string | null;
  prioStatus: string | null;
  assignedCreative: string | null;
  assetLink: string | null;
  createdTime: string;
}

function mapSuggestion(rec: AirtableRecord<Raw>): SocialSuggestion {
  const f = rec.fields;
  return {
    id: rec.id,
    title: str(f[SF.title]),
    notes: str(f[SF.notes]),
    captions: str(f[SF.captions]),
    status: selectName(f[SF.status]),
    clipSourceUrl: str(f[SF.clipSourceUrl]),
    raiseRequested: f[SF.raiseRequest] === true,
    assetTypeId: linkedIds(f[SL.assetType])[0] ?? null,
    ticketRaised: linkedIds(f[SL.creativeRequest]).length > 0,
    ticketStatus: lookupOne(f[SF.ticketStatusLookup]),
    prioStatus: lookupOne(f[SF.prioStatusLookup]),
    assignedCreative: lookupOne(f[SF.assignedCreativeLookup]),
    assetLink: lookupOne(f[SF.assetLinkLookup]),
    createdTime: rec.createdTime,
  };
}

const LIST_FIELDS = [
  SF.title, SF.notes, SF.captions, SF.status, SF.clipSourceUrl, SF.raiseRequest,
  SL.assetType, SL.creativeRequest,
  SF.ticketStatusLookup, SF.prioStatusLookup, SF.assignedCreativeLookup, SF.assetLinkLookup,
];

/**
 * Engine-generated proposals — rows with a non-empty Clip Source URL (our origin
 * marker), newest first. Excludes rejected rows by default (they're retained for
 * the feedback loop but not shown on the active board).
 */
export async function listSocialSuggestions(opts: { includeRejected?: boolean } = {}): Promise<AirtableResult<SocialSuggestion[]>> {
  const notRejected = `{${'Status'}} != '${S.status_.reject}'`;
  const formula = opts.includeRejected
    ? `NOT({Clip Source URL} = '')`
    : `AND(NOT({Clip Source URL} = ''), ${notRejected})`;
  const res = await listAll<Raw>(S.baseId, S.tableId, { filterByFormula: formula, fields: LIST_FIELDS });
  if (!res.ok) return res;
  const rows = res.data
    .map(mapSuggestion)
    .sort((a, b) => (a.createdTime < b.createdTime ? 1 : -1));
  return { ok: true, data: rows };
}

export async function getSocialSuggestion(id: string): Promise<AirtableResult<SocialSuggestion>> {
  const res = await getRecord<Raw>(S.baseId, S.tableId, id);
  if (!res.ok) return res;
  return { ok: true, data: mapSuggestion(res.data) };
}

/**
 * Write one Proposal row per clip the engine returned. Status = "1: Proposal",
 * Raise Request unchecked, no Creative Request. Clip Source URL stamps the origin.
 */
export async function createSocialSuggestions(
  sourceUrl: string,
  clips: ReelsClip[],
): Promise<AirtableResult<{ count: number; ids: string[] }>> {
  const records = clips.map((c) => {
    const briefParts = [
      c.rationale,
      `Suggested clip: ${c.timestampStart}–${c.timestampEnd} · virality ${c.viralityScore}/10`,
    ].filter(Boolean);
    return {
      fields: {
        [SF.title]: c.hookLine,
        [SF.notes]: briefParts.join('\n\n'),
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

/**
 * Commit a suggestion for ticket fan-out: set the Asset Type, ensure status is
 * Approved, and check the Raise Request box. Checking the box is what the Airtable
 * automation listens for — it then creates the Prio ticket(s). The portal does not
 * create tickets itself.
 */
export async function raiseSocialRequest(id: string, assetTypeId: string): Promise<AirtableResult<SocialSuggestion>> {
  const res = await updateRecord<Raw>(S.baseId, S.tableId, id, {
    [SL.assetType]: [assetTypeId],
    [SF.status]: S.status_.approved,
    [SF.raiseRequest]: true,
  });
  if (!res.ok) return res;
  return { ok: true, data: mapSuggestion(res.data) };
}

// ── Asset types (for the "raise request" picker) ─────────────────────────────

export interface SocialAssetType {
  id: string;
  name: string;
}

/** Asset types from the Content & Comms base, for the raise-request picker. */
export async function listSocialAssetTypes(): Promise<AirtableResult<SocialAssetType[]>> {
  const res = await listAll<Raw>(A.baseId, A.tableId, { fields: [A.fields.name, A.fields.shortName] });
  if (!res.ok) return res;
  const rows = res.data
    .map((rec) => ({
      id: rec.id,
      name: str(rec.fields[A.fields.name]) ?? str(rec.fields[A.fields.shortName]) ?? '(unnamed)',
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return { ok: true, data: rows };
}
