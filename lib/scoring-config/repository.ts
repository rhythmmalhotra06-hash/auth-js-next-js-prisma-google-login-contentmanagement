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
  SCORING_CONFIG as C, EVENT_TYPES, EMPLOYEES, CONTRACTORS,
} from '@/lib/airtable/field-map';
import { listAll, updateRecord, type AirtableResult } from '@/lib/airtable/rest';
import { referenceIsPostgres } from '@/lib/reference/backend';
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
  certainty_fixed: 'fixed', certainty_target: 'target', certainty_evergreen: 'evergreen',
} as const;
const WEIGHT_KEYS = new Set(['due', 'event', 'effort', 'variants', 'shoot', 'campaign']);
const CERTAINTY_KEYS = new Set(['fixed', 'target', 'evergreen']);

// Apply one global knob (Scoring Config key→value) onto the config object. Shared by
// the Airtable and Postgres readers so the key→target mapping lives in one place.
function applyGlobalKnob(cfg: ScoringConfig, key: string | null, val: number | null): void {
  if (!key || val == null) return;
  const target = (G as Record<string, string>)[key];
  if (!target) return;
  if (WEIGHT_KEYS.has(target)) cfg.weights[target as keyof typeof cfg.weights] = val;
  else if (CERTAINTY_KEYS.has(target)) cfg.certaintyFactor[target as keyof typeof cfg.certaintyFactor] = val;
  else (cfg as unknown as Record<string, number>)[target] = val;
}

async function fetchConfig(): Promise<ScoringConfig> {
  const cfg = emptyConfig();

  // Global knobs — sequential reads keep us under the per-base rate limit.
  const globals = await listAll(C.baseId, C.tableId);
  if (globals.ok) {
    for (const rec of globals.data) {
      applyGlobalKnob(cfg, str(rec.fields[C.fields.key]), num(rec.fields[C.fields.value]));
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

  // NO asset-type pass any more. `Load Weight` and `Effort Norm` do not exist on the live
  // 🛎️ Asset Type table (it is synced, so app-managed fields cannot be added) — the two ids this
  // used to read were dead, returned `undefined` on all 226 rows, and produced an empty map.
  // `cfg.loadWeightByAssetType` and `.effortByAssetType` therefore stay empty and `loadWeightFor`
  // / the effort term fall back to DEFAULTS, which is the behaviour that was already in effect.
  // Dropping the request also saves a full table listing on every config read.
  //
  // Note the event-type pass above is a DIFFERENT problem with the same symptom: its `loadWeight`
  // id resolves fine, but the field is empty on all 63 rows, so that map is empty too. That one is
  // a data-entry gap someone can close in Airtable; `npm run doctor` reports it.

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

// Postgres reader (REFERENCE_BACKEND=postgres) — same composite config from the mirrored
// tables (scoring_config globals + event/asset type weights + employee/contractor capacity).
async function fetchConfigPg(): Promise<ScoringConfig> {
  const cfg = emptyConfig();
  const { prisma } = await import('@/lib/prisma');

  const [knobs, events, assets, emps, cons] = await Promise.all([
    prisma.scoringConfigKnob.findMany({ select: { key: true, value: true } }),
    prisma.eventType.findMany({ select: { name: true, loadWeight: true, tierNorm: true } }),
    prisma.assetType.findMany({ select: { name: true, fullName: true, loadWeight: true, effortNorm: true } }),
    prisma.employee.findMany({ select: { name: true, capacity: true } }),
    prisma.contractor.findMany({ select: { name: true, capacity: true } }),
  ]);

  for (const k of knobs) applyGlobalKnob(cfg, k.key, k.value);
  for (const ev of events) {
    if (!ev.name) continue;
    if (ev.loadWeight != null) cfg.loadWeightByEventType[ev.name] = ev.loadWeight;
    if (ev.tierNorm != null) cfg.tierByEventType[ev.name] = ev.tierNorm;
  }
  for (const a of assets) {
    const name = a.name ?? a.fullName;
    if (!name) continue;
    if (a.loadWeight != null) cfg.loadWeightByAssetType[name] = a.loadWeight;
    if (a.effortNorm != null) cfg.effortByAssetType[name] = a.effortNorm;
  }
  for (const e of emps) if (e.name && e.capacity != null) cfg.capacityByName[e.name] = e.capacity;
  for (const c of cons) if (c.name && c.capacity != null) cfg.capacityByName[c.name] = c.capacity;

  return cfg;
}

/** Cached scoring/capacity config. Never throws — falls back to DEFAULTS if the source is unreachable. */
export async function getScoringConfig(): Promise<ScoringConfig> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.data;
  if (inflight) return inflight;
  inflight = (referenceIsPostgres() ? fetchConfigPg() : fetchConfig())
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

// `listAssetTypeRows` and `updateAssetTypeScoring` used to live here, backing a
// "Load weight by asset type" editor at /settings/scoring. Both are gone: the two fields they
// read and wrote do not exist on the live 🛎️ Asset Type table, which is SYNCED and therefore
// cannot carry app-managed fields at all. The read returned `undefined` on all 226 rows and the
// WRITE would have been rejected by Airtable as an unknown field — so the editor could never have
// worked, which fits the standing observation that it was populated on 0 of 118 asset types.
//
// Event-type load weight is unaffected and still edited here; its field is real (merely empty).

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

/** Per-person capacity override. `group` routes to the Employees vs Contractors table. */
export async function updateCapacity(group: 'Creatives' | 'Freelancers & contractors', recId: string, value: number | null): Promise<AirtableResult<true>> {
  const t = group === 'Creatives' ? EMPLOYEES : CONTRACTORS;
  const res = await updateRecord(t.baseId, t.tableId, recId, { [t.fields.capacity]: value });
  if (!res.ok) return res;
  bustScoringConfigCache();
  return { ok: true, data: true };
}
