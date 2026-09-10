/**
 * Verify every table and field id in `lib/airtable/field-map.ts` against the LIVE base schemas.
 *
 * WHY THIS EXISTS. An Airtable field id that no longer resolves does not error — the REST API
 * simply omits the key, so `fields[someDeadId]` is `undefined`. Every surface here is built to
 * tolerate absence honestly, which means a dead id renders as "not set" or "no message committed":
 * indistinguishable from a real data gap, and on a page whose entire job is showing real data
 * gaps. That is the worst failure mode this project has, because it looks like the truth.
 *
 * Causes are ordinary: someone deletes a field in Airtable, renames a table, a synced table gets
 * rebuilt (which issues NEW ids for the same-looking fields), or a base gets duplicated.
 *
 * Run it before any deploy that people will read numbers off:
 *   AIRTABLE_TOKEN=pat... npx tsx scripts/doctor-airtable.mts
 *
 * Needs `schema.bases:read` on the token in addition to the usual data scopes.
 */

import * as MAP from '@/lib/airtable/field-map';

const TOKEN = process.env.AIRTABLE_TOKEN ?? process.env.AIRTABLE_API_KEY;
if (!TOKEN) {
  console.error('No AIRTABLE_TOKEN / AIRTABLE_API_KEY in the environment.');
  process.exit(2);
}

interface SchemaField { id: string; name: string; type: string }
interface SchemaTable { id: string; name: string; fields: SchemaField[] }

const schemaCache = new Map<string, SchemaTable[] | null>();

async function baseSchema(baseId: string): Promise<SchemaTable[] | null> {
  if (schemaCache.has(baseId)) return schemaCache.get(baseId)!;
  const res = await fetch(`https://api.airtable.com/v0/meta/bases/${baseId}/tables`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  if (!res.ok) {
    schemaCache.set(baseId, null);
    return null;
  }
  const json = (await res.json()) as { tables: SchemaTable[] };
  schemaCache.set(baseId, json.tables);
  return json.tables;
}

/** A table entry in the field map: baseId + tableId + groups of field ids. */
interface MapEntry {
  baseId?: string;
  tableId?: string;
  [k: string]: unknown;
}

const FIELD_GROUPS = ['fields', 'links', 'readOnlyFields', 'writableFields'] as const;

let problems = 0;
let checkedTables = 0;
let checkedFields = 0;
const noAccess: string[] = [];

/** Every exported const that looks like a table descriptor. */
const entries = Object.entries(MAP as unknown as Record<string, MapEntry>)
  .filter(([, v]) => v && typeof v === 'object' && typeof v.baseId === 'string' && typeof v.tableId === 'string')
  .sort(([a], [b]) => a.localeCompare(b));

console.log(`\nVerifying ${entries.length} tables from lib/airtable/field-map.ts against live schemas\n`);

for (const [name, entry] of entries) {
  const tables = await baseSchema(entry.baseId!);
  if (tables === null) {
    noAccess.push(`${name} (${entry.baseId})`);
    console.log(`  ?  ${name.padEnd(24)} base ${entry.baseId} — no schema access, cannot verify`);
    continue;
  }

  const table = tables.find((t) => t.id === entry.tableId);
  if (!table) {
    problems++;
    console.log(`  ✗  ${name.padEnd(24)} TABLE ${entry.tableId} NOT FOUND in ${entry.baseId}`);
    continue;
  }
  checkedTables++;

  const byId = new Map(table.fields.map((f) => [f.id, f]));
  const dead: string[] = [];
  let count = 0;

  for (const group of FIELD_GROUPS) {
    const g = entry[group];
    if (!g || typeof g !== 'object') continue;
    for (const [key, id] of Object.entries(g as Record<string, unknown>)) {
      if (typeof id !== 'string' || !id.startsWith('fld')) continue;
      count++;
      checkedFields++;
      if (!byId.has(id)) dead.push(`${group}.${key} = ${id}`);
    }
  }

  if (dead.length) {
    problems += dead.length;
    console.log(`  ✗  ${name.padEnd(24)} "${table.name}" — ${dead.length} of ${count} ids DEAD:`);
    for (const d of dead) console.log(`       ${d}`);
  } else {
    console.log(`  ok ${name.padEnd(24)} "${table.name}" — ${count} ids resolve`);
  }
}

console.log(`\n${checkedFields} field ids across ${checkedTables} tables checked.`);
if (noAccess.length) console.log(`${noAccess.length} table(s) unverifiable (no schema access): ${noAccess.join(', ')}`);
console.log(problems === 0 ? 'ALL IDS RESOLVE\n' : `${problems} PROBLEM(S) — a dead id renders as a data gap, not an error\n`);
process.exit(problems === 0 ? 0 : 1);
