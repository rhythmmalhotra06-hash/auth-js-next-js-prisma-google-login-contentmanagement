// Mirror a Prio ticket's live fields onto its Vishen Clips row: Editor Assigned, Status, and Type.
// Runs on an ongoing basis from the ticket-link reconcile (every 5 min) so the founder's Clips view
// reflects who's editing, the production status, and the clip format as the ticket progresses — not
// just a stale snapshot from creation time.
//
// Cross-base note: the ticket's assigned creative lives in the Creative Services EMPLOYEES table,
// but "Editor Assigned" on Vishen's Clips links to HIS base's EMPLOYEES table — so we match by Work
// Email. Writes are diff-guarded (only when a value actually changed) so they can't ping-pong with
// Airtable's native two-way sync.

import { TICKETS, ASSET_TYPES, EMPLOYEES, VISHEN_CLIPS as VC, VISHEN_EMPLOYEES as VE } from '@/lib/airtable/field-map';
import { getRecord, listRecords, updateRecord } from '@/lib/airtable/rest';
import { vishenSyncEnabled } from '@/lib/media/vishen-sync';

type Raw = Record<string, unknown>;

const str = (v: unknown): string | null => (typeof v === 'string' && v ? v : null);
function selectName(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === 'string') return v || null;
  if (typeof v === 'object' && 'name' in (v as object)) return String((v as { name: unknown }).name);
  return null;
}
function linkIds(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => (typeof x === 'string' ? x : x && typeof x === 'object' && 'id' in x ? String((x as { id: unknown }).id) : null))
    .filter((x): x is string => !!x);
}
const firstLinkId = (v: unknown): string | null => linkIds(v)[0] ?? null;

// Ticket Status (CS Prio) → Vishen Clips Status. Anything not listed leaves the clip status untouched.
const STATUS_MAP: Record<string, string> = {
  Backlog: VC.status_.todo,
  'To Do': VC.status_.todo,
  'Request on Hold': VC.status_.todo,
  'In Progress': VC.status_.inProgress,
  Review: VC.status_.review,
  'In Revision': VC.status_.applyFeedback,
  Approved: VC.status_.done,
  Done: VC.status_.done,
  Shipping: VC.status_.published,
  "Won't Do": VC.status_.rejected,
};

// Asset type name → one of the 3 Vishen Clips Type buckets. Unmatched → don't set Type (the API
// token can't create new select options, so an unknown value would fail the write).
function mapAssetTypeToClipType(name: string | null): string | null {
  if (!name) return null;
  const n = name.toLowerCase();
  if (n.includes('reel') || n.includes('under 3')) return VC.type_.reel;
  if (n.includes('short form') || n.includes('under 7')) return VC.type_.shortForm;
  if (n.includes('youtube clip') || n.includes('5 to 20')) return VC.type_.youtubeClip;
  return null;
}

// Per-run memoization so a 60-clip reconcile doesn't re-fetch the same employee / asset type.
export interface SyncCaches {
  employeeEmail: Map<string, string | null>; // CS employee recId → Work Email
  vishenEmployee: Map<string, string | null>; // lowercased email → Vishen EMPLOYEES recId
  assetTypeName: Map<string, string | null>; // asset type recId → name
}
export function newSyncCaches(): SyncCaches {
  return { employeeEmail: new Map(), vishenEmployee: new Map(), assetTypeName: new Map() };
}

async function csEmployeeEmail(recId: string, cache: SyncCaches['employeeEmail']): Promise<string | null> {
  if (cache.has(recId)) return cache.get(recId) ?? null;
  const res = await getRecord<Raw>(EMPLOYEES.baseId, EMPLOYEES.tableId, recId);
  const email = res.ok ? str(res.data.fields[EMPLOYEES.fields.email]) : null;
  cache.set(recId, email);
  return email;
}

async function vishenEmployeeByEmail(email: string, cache: SyncCaches['vishenEmployee']): Promise<string | null> {
  const key = email.toLowerCase();
  if (cache.has(key)) return cache.get(key) ?? null;
  const res = await listRecords<Raw>(VE.baseId, VE.tableId, {
    filterByFormula: `LOWER({Work Email}) = '${key.replace(/'/g, "\\'")}'`,
    maxRecords: 1,
  });
  const id = res.ok ? (res.data.records[0]?.id ?? null) : null;
  cache.set(key, id);
  return id;
}

async function assetTypeName(recId: string, cache: SyncCaches['assetTypeName']): Promise<string | null> {
  if (cache.has(recId)) return cache.get(recId) ?? null;
  const res = await getRecord<Raw>(ASSET_TYPES.baseId, ASSET_TYPES.tableId, recId);
  const name = res.ok ? str(res.data.fields[ASSET_TYPES.fields.name]) ?? str(res.data.fields[ASSET_TYPES.fields.fullName]) : null;
  cache.set(recId, name);
  return name;
}

/**
 * Push a ticket's Editor Assigned / Status / Type onto its Vishen Clips row. Diff-guarded and
 * best-effort. Returns what happened so the caller can report/log.
 */
export async function syncTicketFieldsToVishenClip(
  ticketRecId: string,
  vishenClipId: string,
  caches: SyncCaches,
): Promise<'updated' | 'nochange' | 'skip' | 'error'> {
  if (!vishenSyncEnabled()) return 'skip';

  const tRes = await getRecord<Raw>(TICKETS.baseId, TICKETS.tableId, ticketRecId);
  if (!tRes.ok) return 'error';
  const tf = tRes.data.fields;

  // Resolve the desired values from the ticket.
  const assignedCreativeId = firstLinkId(tf[TICKETS.links.assignedCreative]);
  let editorVishenId: string | null = null;
  if (assignedCreativeId) {
    const email = await csEmployeeEmail(assignedCreativeId, caches.employeeEmail);
    if (email) editorVishenId = await vishenEmployeeByEmail(email, caches.vishenEmployee);
  }
  const mappedStatus = STATUS_MAP[selectName(tf[TICKETS.fields.ticketStatus]) ?? ''] ?? null;
  const assetTypeId = firstLinkId(tf[TICKETS.links.assetTypes]);
  const mappedType = assetTypeId ? mapAssetTypeToClipType(await assetTypeName(assetTypeId, caches.assetTypeName)) : null;

  if (!editorVishenId && !mappedStatus && !mappedType) return 'nochange';

  // Read the current Vishen clip to diff (never write a value that's already there → no sync echo).
  const cRes = await getRecord<Raw>(VC.baseId, VC.tableId, vishenClipId);
  if (!cRes.ok) return 'error';
  const cf = cRes.data.fields;

  const patch: Record<string, unknown> = {};
  if (editorVishenId) {
    const current = linkIds(cf[VC.links.editorAssigned]);
    // Reflect the single assigned creative; only rewrite when it isn't already the sole editor.
    if (!(current.length === 1 && current[0] === editorVishenId)) patch[VC.links.editorAssigned] = [editorVishenId];
  }
  if (mappedStatus && selectName(cf[VC.fields.status]) !== mappedStatus) patch[VC.fields.status] = mappedStatus;
  if (mappedType && selectName(cf[VC.fields.type]) !== mappedType) patch[VC.fields.type] = mappedType;

  if (Object.keys(patch).length === 0) return 'nochange';
  const up = await updateRecord(VC.baseId, VC.tableId, vishenClipId, patch);
  return up.ok ? 'updated' : 'error';
}
