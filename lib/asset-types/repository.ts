// Asset-type DNA repository — Airtable-direct (🛎️ Creative Asset Type). Reads/writes
// the app-owned DNA fields (E9.7) plus read-only reference links for display. Mirrors
// the clip-rules / scoring-config repository pattern: typed rows, AirtableResult, field-id
// mapping via field-map.ts. No Postgres — DNA lives on the Asset Type table.

import { ASSET_TYPES as A } from '@/lib/airtable/field-map';
import { listAll, getRecord, updateRecord, type AirtableResult } from '@/lib/airtable/rest';
import { nameMap } from '@/lib/repositories/reference.repository';

const AF = A.fields;
const AL = A.links;

const str = (v: unknown): string | null => {
  if (v == null) return null;
  if (typeof v === 'string') return v || null;
  if (typeof v === 'object' && 'name' in (v as object)) return String((v as { name: unknown }).name);
  return String(v);
};
const linkIds = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
const namesFrom = (v: unknown, map: Map<string, string>): string[] =>
  linkIds(v).map((id) => map.get(id)).filter((n): n is string => !!n);

export interface AssetTypeDnaRow {
  id: string;
  name: string;
  active: boolean;
  requirements: string | null;
  feedbackStandards: string | null;
  updatedBy: string | null;
  teamLeadIds: string[]; // for per-row edit-permission checks
  teamLeads: string[]; // display
  preferredEditors: string[]; // display
  dimensions: string[]; // display
  eventTypes: string[]; // display
}

/** Active asset types with their DNA + read-only reference links, name-sorted. */
export async function listAssetTypeDna(): Promise<AirtableResult<AssetTypeDnaRow[]>> {
  const [res, employees, dimensions, eventTypes] = await Promise.all([
    listAll(A.baseId, A.tableId),
    nameMap('employees'), nameMap('dimensions'), nameMap('eventTypes'),
  ]);
  if (!res.ok) return res;
  const rows = res.data
    .map((rec) => {
      const f = rec.fields as Record<string, unknown>;
      return {
        id: rec.id,
        name: str(f[AF.name]) ?? str(f[AF.fullName]) ?? '(unnamed)',
        active: str(f[AF.status]) === 'Active',
        requirements: str(f[AF.dnaRequirements]),
        feedbackStandards: str(f[AF.feedbackStandards]),
        updatedBy: str(f[AF.dnaUpdatedBy]),
        teamLeadIds: linkIds(f[AL.teamLeads]),
        teamLeads: namesFrom(f[AL.teamLeads], employees),
        preferredEditors: namesFrom(f[AL.preferredEditors], employees),
        dimensions: namesFrom(f[AL.dimensions], dimensions),
        eventTypes: namesFrom(f[AL.eventTypes], eventTypes),
      };
    })
    .filter((r) => r.active)
    .sort((a, b) => a.name.localeCompare(b.name));
  return { ok: true, data: rows };
}

/** Team-lead recIds for one asset type — used to authorize a DNA edit server-side. */
export async function getAssetTypeLeadIds(recId: string): Promise<string[]> {
  const res = await getRecord(A.baseId, A.tableId, recId);
  return res.ok ? linkIds((res.data.fields as Record<string, unknown>)[AL.teamLeads]) : [];
}

/** Write the DNA fields. Empty string clears a field. Caller must authorize first. */
export async function updateAssetTypeDna(
  recId: string,
  values: { requirements: string; feedbackStandards: string },
  updatedBy: string | null,
): Promise<AirtableResult<true>> {
  const fields: Record<string, unknown> = {
    [AF.dnaRequirements]: values.requirements,
    [AF.feedbackStandards]: values.feedbackStandards,
  };
  if (updatedBy) fields[AF.dnaUpdatedBy] = updatedBy;
  const res = await updateRecord(A.baseId, A.tableId, recId, fields);
  if (!res.ok) return res;
  return { ok: true, data: true };
}
