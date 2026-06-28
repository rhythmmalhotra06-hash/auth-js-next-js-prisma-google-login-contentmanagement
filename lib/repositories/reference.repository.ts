// Reference name maps (recId → name) for resolving Prio Requests link fields when
// rendering tickets. Small, slow-changing tables — cached ~5min. Airtable-direct.

import { EMPLOYEES, EVENT_TYPES, ASSET_TYPES, AUTHORS, OFFICIAL_CALENDARS } from '@/lib/airtable/field-map';
import { listAll } from '@/lib/airtable/rest';

interface NameSource { baseId: string; tableId: string; nameField: string; fallbackField?: string }

const SOURCES: Record<string, NameSource> = {
  employees: { baseId: EMPLOYEES.baseId, tableId: EMPLOYEES.tableId, nameField: EMPLOYEES.fields.name },
  eventTypes: { baseId: EVENT_TYPES.baseId, tableId: EVENT_TYPES.tableId, nameField: EVENT_TYPES.fields.name },
  assetTypes: { baseId: ASSET_TYPES.baseId, tableId: ASSET_TYPES.tableId, nameField: ASSET_TYPES.fields.name, fallbackField: ASSET_TYPES.fields.fullName },
  authors: { baseId: AUTHORS.baseId, tableId: AUTHORS.tableId, nameField: AUTHORS.fields.name },
  officialCalendars: { baseId: OFFICIAL_CALENDARS.baseId, tableId: OFFICIAL_CALENDARS.tableId, nameField: OFFICIAL_CALENDARS.fields.name },
};

const TTL_MS = 5 * 60_000;
const cache = new Map<string, { at: number; map: Map<string, string> }>();
const inflight = new Map<string, Promise<Map<string, string>>>();

async function buildMap(key: string): Promise<Map<string, string>> {
  const src = SOURCES[key];
  const fields = src.fallbackField ? [src.nameField, src.fallbackField] : [src.nameField];
  const res = await listAll(src.baseId, src.tableId, { fields });
  const map = new Map<string, string>();
  if (res.ok) {
    for (const rec of res.data) {
      const f = rec.fields as Record<string, unknown>;
      const name = (typeof f[src.nameField] === 'string' && f[src.nameField]) ||
        (src.fallbackField && typeof f[src.fallbackField] === 'string' && f[src.fallbackField]) || null;
      if (name) map.set(rec.id, String(name));
    }
  }
  return map;
}

export async function nameMap(key: keyof typeof SOURCES | string): Promise<Map<string, string>> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.map;
  const pending = inflight.get(key);
  if (pending) return pending;
  const p = buildMap(key)
    .then((map) => { cache.set(key, { at: Date.now(), map }); return map; })
    .finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

/** Resolve the first linked recId in an Airtable link-field value to a name. */
export function firstLinkedName(value: unknown, map: Map<string, string>): string | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const recId = typeof value[0] === 'string' ? value[0] : null;
  return recId ? (map.get(recId) ?? null) : null;
}

/** First linked recId from an Airtable link-field value. */
export function firstLinkedId(value: unknown): string | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  return typeof value[0] === 'string' ? value[0] : null;
}
