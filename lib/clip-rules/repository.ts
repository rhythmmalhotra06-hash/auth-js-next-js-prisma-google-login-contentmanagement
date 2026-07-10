// Clip Rules repository — Airtable-direct (🧠 Clip Rules). Mirrors the
// media/repository pattern: typed rows, AirtableResult returns, field-id mapping
// via field-map.ts. Source of truth for the editable clip-generation prompt.

import { CLIP_RULES as R } from '@/lib/airtable/field-map';
import {
  listAll,
  createRecord,
  updateRecord,
  type AirtableRecord,
  type AirtableResult,
} from '@/lib/airtable/rest';
import { referenceIsPostgres } from '@/lib/reference/backend';

const RF = R.fields;

type Raw = Record<string, unknown>;

const str = (v: unknown): string | null => (typeof v === 'string' && v ? v : null);
const num = (v: unknown): number | null => (typeof v === 'number' ? v : null);
function selectName(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === 'string') return v || null;
  if (typeof v === 'object' && 'name' in (v as object)) return String((v as { name: unknown }).name);
  return String(v);
}

export type ClipRuleKind = 'Base Prompt' | 'Brand Pillars' | 'Rule';

export interface ClipRule {
  id: string;
  name: string | null;
  kind: ClipRuleKind | null;
  clipType: string | null; // All | Reel | Stage Talk | Short
  content: string | null;
  active: boolean;
  order: number | null;
  section: string | null;
  note: string | null;
  updatedBy: string | null;
  updatedAt: string | null; // Last Modified — auto-stamped on any edit (portal or Airtable)
  createdTime: string;
}

function mapRule(rec: AirtableRecord<Raw>): ClipRule {
  const f = rec.fields;
  return {
    id: rec.id,
    name: str(f[RF.name]),
    kind: selectName(f[RF.kind]) as ClipRuleKind | null,
    clipType: selectName(f[RF.clipType]),
    content: str(f[RF.content]),
    active: f[RF.active] === true,
    order: num(f[RF.order]),
    section: selectName(f[RF.section]),
    note: str(f[RF.note]),
    updatedBy: str(f[RF.updatedBy]),
    updatedAt: str(f[RF.updatedAt]),
    createdTime: rec.createdTime,
  };
}

const byOrderThenCreated = (a: ClipRule, b: ClipRule) => {
  const o = (a.order ?? 0) - (b.order ?? 0);
  return o !== 0 ? o : a.createdTime < b.createdTime ? -1 : 1;
};

// Postgres mirror (REFERENCE_BACKEND=postgres). id = airtableId (recId) so the editor's
// per-row writes (which go to Airtable) still target the right record.
async function listClipRulesPg(): Promise<AirtableResult<ClipRule[]>> {
  const { prisma } = await import('@/lib/prisma');
  const rows = await prisma.clipRule.findMany();
  const mapped: ClipRule[] = rows
    .filter((r): r is typeof r & { airtableId: string } => !!r.airtableId)
    .map((r) => ({
      id: r.airtableId,
      name: r.name,
      kind: (r.kind as ClipRuleKind | null),
      clipType: r.clipType,
      content: r.content,
      active: r.active,
      order: r.order,
      section: r.section,
      note: r.note,
      updatedBy: r.updatedBy,
      updatedAt: r.airtableUpdatedAt,
      createdTime: r.createdTime ?? '',
    }))
    .sort(byOrderThenCreated);
  return { ok: true, data: mapped };
}

/** All rows (small config table). Sorted by Order then creation for stable display. */
export async function listClipRules(): Promise<AirtableResult<ClipRule[]>> {
  if (referenceIsPostgres()) return listClipRulesPg();
  const res = await listAll<Raw>(R.baseId, R.tableId);
  if (!res.ok) return res;
  const rows = res.data.map(mapRule).sort(byOrderThenCreated);
  return { ok: true, data: rows };
}

export interface ClipRulePatch {
  content?: string;
  clipType?: string;
  section?: string;
  note?: string;
  active?: boolean;
  order?: number;
  updatedBy?: string | null;
}

function patchFields(patch: ClipRulePatch): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  if (patch.content !== undefined) fields[RF.content] = patch.content;
  if (patch.clipType !== undefined) fields[RF.clipType] = patch.clipType;
  if (patch.section !== undefined) fields[RF.section] = patch.section;
  if (patch.note !== undefined) fields[RF.note] = patch.note;
  if (patch.active !== undefined) fields[RF.active] = patch.active;
  if (patch.order !== undefined) fields[RF.order] = patch.order;
  if (patch.updatedBy !== undefined && patch.updatedBy) fields[RF.updatedBy] = patch.updatedBy;
  return fields;
}

export async function updateClipRule(id: string, patch: ClipRulePatch): Promise<AirtableResult<ClipRule>> {
  const res = await updateRecord<Raw>(R.baseId, R.tableId, id, patchFields(patch));
  if (!res.ok) return res;
  return { ok: true, data: mapRule(res.data) };
}

export interface CreateClipRuleInput {
  name: string;
  content: string;
  clipType: string; // All | Reel | Stage Talk | Short
  section?: string;
  note?: string;
  order?: number;
  updatedBy?: string | null;
  /** Defaults to true. Set false for "proposed" learnings awaiting admin approval. */
  active?: boolean;
}

export async function createClipRule(input: CreateClipRuleInput): Promise<AirtableResult<ClipRule>> {
  const fields: Record<string, unknown> = {
    [RF.name]: input.name.slice(0, 200),
    [RF.kind]: R.kind_.rule,
    [RF.clipType]: input.clipType,
    [RF.content]: input.content,
    [RF.active]: input.active ?? true,
    [RF.order]: input.order ?? 0,
  };
  if (input.section) fields[RF.section] = input.section;
  if (input.note) fields[RF.note] = input.note;
  if (input.updatedBy) fields[RF.updatedBy] = input.updatedBy;
  const res = await createRecord<Raw>(R.baseId, R.tableId, fields);
  if (!res.ok) return res;
  return { ok: true, data: mapRule(res.data) };
}
