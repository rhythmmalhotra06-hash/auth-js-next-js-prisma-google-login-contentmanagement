// Scoring & capacity config — Airtable-direct, mirrors the clip-rules pattern.
// Global knobs live in the ⚙️ Scoring Config table; per-type weights on Event
// Type / Asset Type; per-person capacity on Employees / Contractors. Read here
// (cached, with a hardcoded fallback equal to today's behaviour) and fed into the
// capacity insights (lib/tickets/intel.ts, FunnelCapacity, /performance) and the
// priority scorer (lib/tickets/scoring.ts). Edited from /settings/scoring.
//
// Pure types/resolvers + DEFAULTS live in ./config (no Airtable imports) so they
// can be bundled into client components and passed across the server boundary.

import {
  SCORING_CONFIG as C, EVENT_TYPES, ASSET_TYPES, EMPLOYEES, CONTRACTORS,
} from '@/lib/airtable/field-map';
import { listAll, updateRecord, type AirtableResult } from '@/lib/airtable/rest';
import { type ScoringConfig, emptyConfig } from './config';

export { DEFAULTS, capacityFor, loadWeightFor, type ScoringConfig } from './config';

const num = (v: unknown): number | null => (typeof v === 'number' && !Number.isNaN(v) ? v : null);
const str = (v: unknown): string | null => {
  if (v == null) return null;
  if (typeof v === 'string') return v || null;
  if (typeof v === 'object' && 'name' in (v as object)) return String((v as { name: unknown }).name);
  return String(v);
};

const TTL_MS = 5 * 60_000;
let cache: { at: number; data: ScoringConfig } | null = null;
let inflight: Promise<ScoringConfig> | null = null;

// Scoring Config key → target on ScoringConfig (weights live under .weights).
const G = {
  default_capacity: 'defaultCapacity',
  w_due: 'due', w_event: 'event', w_effort: 'effort', w_variants: 'variants', w_shoot: 'shoot', w_campaign: 'campaign',
  leadtime_factor: 'leadtimeFactor',
  amber_pct: 'amberPct', red_pct: 'redPct',
  risk_capacity_days: 'riskCapacityDays',
  due_proximity_window_days: 'dueProximityWindowDays',
} as const;
const WEIGHT_KEYS = new Set(['due', 'event', 'effort', 'variants', 'shoot', 'campaign']);

async function fetchConfig(): Promise<ScoringConfig> {
  const cfg = emptyConfig();

  // Global knobs — sequential reads keep us under the per-base rate limit.
  const globals = await listAll(C.baseId, C.tableId);
  if (globals.ok) {
    for (const rec of globals.data) {
      const key = str(rec.fields[C.fields.key]);
      const val = num(rec.fields[C.fields.value]);
      if (!key || val == null) continue;
      const target = (G as Record<string, string>)[key];
      if (!target) continue;
      if (WEIGHT_KEYS.has(target)) cfg.weights[target as keyof typeof cfg.weights] = val;
      else (cfg as unknown as Record<string, number>)[target] = val;
    }
  }

  const events = await listAll(EVENT_TYPES.baseId, EVENT_TYPES.tableId);
  if (events.ok) {
    for (const rec of events.data) {
      const name = str(rec.fields[EVENT_TYPES.fields.name]);
      if (!name) continue;
      const w = num(rec.fields[EVENT_TYPES.fields.loadWeight]);
      const tier = num(rec.fields[EVENT_TYPES.fields.tierNorm]);
      if (w != null) cfg.loadWeightByEventType[name] = w;
      if (tier != null) cfg.tierByEventType[name] = tier;
    }
  }

  const assets = await listAll(ASSET_TYPES.baseId, ASSET_TYPES.tableId);
  if (assets.ok) {
    for (const rec of assets.data) {
      const name = str(rec.fields[ASSET_TYPES.fields.name]) ?? str(rec.fields[ASSET_TYPES.fields.fullName]);
      if (!name) continue;
      const w = num(rec.fields[ASSET_TYPES.fields.loadWeight]);
      const eff = num(rec.fields[ASSET_TYPES.fields.effortNorm]);
      if (w != null) cfg.loadWeightByAssetType[name] = w;
      if (eff != null) cfg.effortByAssetType[name] = eff;
    }
  }

  const emps = await listAll(EMPLOYEES.baseId, EMPLOYEES.tableId);
  if (emps.ok) {
    for (const rec of emps.data) {
      const name = str(rec.fields[EMPLOYEES.fields.name]);
      const cap = num(rec.fields[EMPLOYEES.fields.capacity]);
      if (name && cap != null) cfg.capacityByName[name] = cap;
    }
  }

  const contractors = await listAll(CONTRACTORS.baseId, CONTRACTORS.tableId);
  if (contractors.ok) {
    for (const rec of contractors.data) {
      const name = str(rec.fields[CONTRACTORS.fields.name]);
      const cap = num(rec.fields[CONTRACTORS.fields.capacity]);
      if (name && cap != null) cfg.capacityByName[name] = cap;
    }
  }

  return cfg;
}

/** Cached scoring/capacity config. Never throws — falls back to DEFAULTS if Airtable is unreachable. */
export async function getScoringConfig(): Promise<ScoringConfig> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.data;
  if (inflight) return inflight;
  inflight = fetchConfig()
    .then((data) => { cache = { at: Date.now(), data }; return data; })
    .catch(() => emptyConfig())
    .finally(() => { inflight = null; });
  return inflight;
}

/** Force the next read to hit Airtable — call after any config write. */
export function bustScoringConfigCache(): void {
  cache = null;
}

// --- editor rows (for the admin panel) ------------------------------------

export interface GlobalRow { id: string; key: string; value: number | null; label: string | null; group: string | null; note: string | null }
export interface TypeRow { id: string; name: string; loadWeight: number | null; secondary: number | null }

/** Global knob rows for the admin panel, in a stable display order. */
export async function listGlobalRows(): Promise<AirtableResult<GlobalRow[]>> {
  const res = await listAll(C.baseId, C.tableId);
  if (!res.ok) return res;
  const order = Object.keys(G);
  const rows = res.data.map((rec) => ({
    id: rec.id,
    key: str(rec.fields[C.fields.key]) ?? '',
    value: num(rec.fields[C.fields.value]),
    label: str(rec.fields[C.fields.label]),
    group: str(rec.fields[C.fields.group]),
    note: str(rec.fields[C.fields.note]),
  })).sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));
  return { ok: true, data: rows };
}

/** Event-type rows with their load weight + tier (secondary). */
export async function listEventTypeRows(): Promise<AirtableResult<TypeRow[]>> {
  const res = await listAll(EVENT_TYPES.baseId, EVENT_TYPES.tableId);
  if (!res.ok) return res;
  const rows = res.data
    .filter((rec) => str(rec.fields[EVENT_TYPES.fields.status]) === 'Active')
    .map((rec) => ({
      id: rec.id,
      name: str(rec.fields[EVENT_TYPES.fields.name]) ?? '(unnamed)',
      loadWeight: num(rec.fields[EVENT_TYPES.fields.loadWeight]),
      secondary: num(rec.fields[EVENT_TYPES.fields.tierNorm]),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return { ok: true, data: rows };
}

/** Asset-type rows with their load weight + effort (secondary). */
export async function listAssetTypeRows(): Promise<AirtableResult<TypeRow[]>> {
  const res = await listAll(ASSET_TYPES.baseId, ASSET_TYPES.tableId);
  if (!res.ok) return res;
  const rows = res.data
    .filter((rec) => str(rec.fields[ASSET_TYPES.fields.status]) === 'Active')
    .map((rec) => ({
      id: rec.id,
      name: str(rec.fields[ASSET_TYPES.fields.name]) ?? str(rec.fields[ASSET_TYPES.fields.fullName]) ?? '(unnamed)',
      loadWeight: num(rec.fields[ASSET_TYPES.fields.loadWeight]),
      secondary: num(rec.fields[ASSET_TYPES.fields.effortNorm]),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return { ok: true, data: rows };
}

// --- writes (admin-only; callers must guard) ------------------------------

export async function updateGlobalValue(recId: string, value: number, updatedBy: string | null): Promise<AirtableResult<true>> {
  const fields: Record<string, unknown> = { [C.fields.value]: value };
  if (updatedBy) fields[C.fields.updatedBy] = updatedBy;
  const res = await updateRecord(C.baseId, C.tableId, recId, fields);
  if (!res.ok) return res;
  bustScoringConfigCache();
  return { ok: true, data: true };
}

export type EventTypeField = 'loadWeight' | 'tierNorm';
export async function updateEventTypeScoring(recId: string, field: EventTypeField, value: number | null): Promise<AirtableResult<true>> {
  const res = await updateRecord(EVENT_TYPES.baseId, EVENT_TYPES.tableId, recId, { [EVENT_TYPES.fields[field]]: value });
  if (!res.ok) return res;
  bustScoringConfigCache();
  return { ok: true, data: true };
}

export type AssetTypeField = 'loadWeight' | 'effortNorm';
export async function updateAssetTypeScoring(recId: string, field: AssetTypeField, value: number | null): Promise<AirtableResult<true>> {
  const res = await updateRecord(ASSET_TYPES.baseId, ASSET_TYPES.tableId, recId, { [ASSET_TYPES.fields[field]]: value });
  if (!res.ok) return res;
  bustScoringConfigCache();
  return { ok: true, data: true };
}

/** Per-person capacity override. `group` routes to the Employees vs Contractors table. */
export async function updateCapacity(group: 'Creatives' | 'Freelancers & contractors', recId: string, value: number | null): Promise<AirtableResult<true>> {
  const t = group === 'Creatives' ? EMPLOYEES : CONTRACTORS;
  const res = await updateRecord(t.baseId, t.tableId, recId, { [t.fields.capacity]: value });
  if (!res.ok) return res;
  bustScoringConfigCache();
  return { ok: true, data: true };
}
