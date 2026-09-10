/**
 * One command that answers "is data flowing, and do we have access to everything".
 *
 *   AIRTABLE_TOKEN=pat... npm run doctor
 *
 * WHY. Answering that question on 10 Sep took about a dozen ad-hoc queries across the Airtable
 * meta API, `kessel db`, GitHub Actions history and `kessel env`. It needs to be repeatable by
 * someone tired on a Sunday night, and re-runnable straight after a deploy — which is exactly when
 * ids and env most plausibly diverge.
 *
 * WHAT IT IS LOOKING FOR. Not crashes. This project's surfaces are deliberately built to render
 * absence honestly, so the dangerous failures are the ones that look like real data gaps:
 *
 *   • a dead Airtable field id — the REST API omits the key, the value is `undefined`, and the page
 *     says "not set" on a screen whose whole job is showing things that are not set
 *   • a field whose id is fine but which nobody has filled — same symptom, different owner
 *   • a sync that has quietly stopped — the numbers are simply old, and nothing says so
 *   • an OAuth refresh token that has been revoked — one empty nightly pull, no error anywhere
 *
 * Exit code is 1 if anything in the first category is found, since that is a bug in this repo.
 * Empty-but-valid fields and stale-but-succeeding syncs are WARNINGS: they are somebody else's to
 * close, and failing the build on them would train people to ignore the output.
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import * as MAP from '@/lib/airtable/field-map';

const run = promisify(execFile);
const TOKEN = process.env.AIRTABLE_TOKEN ?? process.env.AIRTABLE_API_KEY;

let errors = 0;
let warnings = 0;
const err = (s: string) => { errors++; console.log(`  ✗  ${s}`); };
const warn = (s: string) => { warnings++; console.log(`  !  ${s}`); };
const ok = (s: string) => console.log(`  ok ${s}`);
const skip = (s: string) => console.log(`  -  ${s}`);

function head(n: number, title: string) {
  console.log(`\n${n}. ${title}\n${'─'.repeat(60)}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// 1 + 4. Airtable: do the ids resolve, and are the fields actually populated?
// ─────────────────────────────────────────────────────────────────────────────

interface SchemaField { id: string; name: string; type: string }
interface SchemaTable { id: string; name: string; fields: SchemaField[] }

// Every group that can hold a `fld…` id. `published` was added on 10 Sep and was invisible to the
// doctor until this line was updated — a new group is itself a silent-failure risk, so this list
// must grow whenever field-map.ts gains one.
const FIELD_GROUPS = ['fields', 'links', 'readOnlyFields', 'writableFields', 'published'] as const;

interface MapEntry { baseId?: string; tableId?: string; [k: string]: unknown }

const tableEntries = Object.entries(MAP as unknown as Record<string, MapEntry>)
  .filter(([, v]) => v && typeof v === 'object' && typeof v.baseId === 'string' && typeof v.tableId === 'string')
  .sort(([a], [b]) => a.localeCompare(b));

/**
 * Fields worth asserting are POPULATED, not merely present.
 *
 * Kept to a short, hand-picked list rather than every field: most fields are legitimately sparse,
 * and a check that cries wolf gets ignored. These are the ones something downstream depends on,
 * where empty means a feature is silently inert.
 */
const MUST_BE_POPULATED: { table: string; group: string; field: string; why: string }[] = [
  { table: 'EVENT_TYPES', group: 'fields', field: 'loadWeight', why: 'capacity weighting is uniform without it' },
  { table: 'ASSET_TYPES', group: 'fields', field: 'creativeCategory', why: 'a blank Category hides the type from the Shoot form' },
  { table: 'COMMS_DAY', group: 'fields', field: 'messageOfWeek', why: 'the calendar and the Monday pack read the message from here' },
  { table: 'COMMS_DAY', group: 'fields', field: 'theGoal', why: 'the gold "no goal" strip and the pack goal come from here' },
];

async function airtableChecks() {
  head(1, 'Airtable field ids resolve against the live schemas');
  if (!TOKEN) {
    skip('no AIRTABLE_TOKEN — cannot verify ids (this is the check that catches silent data gaps)');
    warnings++;
    return;
  }

  const schemas = new Map<string, SchemaTable[] | null>();
  for (const baseId of new Set(tableEntries.map(([, e]) => e.baseId!))) {
    const res = await fetch(`https://api.airtable.com/v0/meta/bases/${baseId}/tables`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    schemas.set(baseId, res.ok ? ((await res.json()) as { tables: SchemaTable[] }).tables : null);
  }

  let idCount = 0;
  let deadCount = 0;
  const resolved = new Map<string, SchemaTable>();

  for (const [name, entry] of tableEntries) {
    const tables = schemas.get(entry.baseId!);
    if (!tables) { warn(`${name}: no schema access on ${entry.baseId} (token needs schema.bases:read)`); continue; }

    const table = tables.find((t) => t.id === entry.tableId);
    if (!table) { err(`${name}: table ${entry.tableId} NOT FOUND in ${entry.baseId}`); deadCount++; continue; }
    resolved.set(name, table);

    const known = new Set(table.fields.map((f) => f.id));
    for (const group of FIELD_GROUPS) {
      const g = entry[group];
      if (!g || typeof g !== 'object') continue;
      for (const [key, id] of Object.entries(g as Record<string, unknown>)) {
        if (typeof id !== 'string' || !id.startsWith('fld')) continue;
        idCount++;
        if (!known.has(id)) {
          err(`${name}.${group}.${key} = ${id} does not exist on "${table.name}" — renders as a data gap, not an error`);
          deadCount++;
        }
      }
    }
  }
  if (deadCount === 0) ok(`all ${idCount} field ids across ${resolved.size} tables resolve`);

  // ── The other half of the same class: id fine, field empty ────────────────
  head(4, 'Reference fields something depends on are actually populated');
  for (const m of MUST_BE_POPULATED) {
    const entry = (MAP as unknown as Record<string, MapEntry>)[m.table];
    const table = resolved.get(m.table);
    if (!entry || !table) { skip(`${m.table}.${m.field} — table unresolved, skipped`); continue; }

    const fieldId = (entry[m.group] as Record<string, string> | undefined)?.[m.field];
    if (!fieldId) { skip(`${m.table}.${m.field} — not in the field map (removed?)`); continue; }
    if (!table.fields.some((f) => f.id === fieldId)) continue; // already reported as dead above

    const url = new URL(`https://api.airtable.com/v0/${entry.baseId}/${entry.tableId}`);
    url.searchParams.set('returnFieldsByFieldId', 'true');
    url.searchParams.set('fields[]', fieldId);
    url.searchParams.set('pageSize', '100');
    const res = await fetch(url, { headers: { Authorization: `Bearer ${TOKEN}` } });
    if (!res.ok) { warn(`${m.table}.${m.field}: could not sample (${res.status})`); continue; }

    const { records } = (await res.json()) as { records: { fields: Record<string, unknown> }[] };
    const filled = records.filter((r) => {
      const v = r.fields[fieldId];
      return v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && v.length === 0);
    }).length;

    if (records.length === 0) { warn(`${m.table} has no records to sample`); continue; }
    if (filled === 0) warn(`${m.table}.${m.field} is EMPTY on all ${records.length} sampled rows — ${m.why}`);
    else ok(`${m.table}.${m.field} populated on ${filled}/${records.length} sampled`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Postgres freshness. Reachable ONLY through `kessel db` — there is no
//    DATABASE_URL for the managed instance, by design.
// ─────────────────────────────────────────────────────────────────────────────

/** Per-table staleness budget, in hours. Generous, because the schedulers are throttled (Z-C). */
const FRESHNESS: { table: string; column: string; maxAgeH: number; note?: string }[] = [
  { table: 'tickets', column: 'synced_at', maxAgeH: 12 },
  { table: 'employees', column: 'synced_at', maxAgeH: 12 },
  { table: 'asset_types', column: 'synced_at', maxAgeH: 12 },
  { table: 'event_types', column: 'synced_at', maxAgeH: 12 },
  { table: 'social_metrics', column: 'captured_at', maxAgeH: 36, note: 'nightly Perch pull' },
];

async function postgresChecks() {
  head(2, 'Postgres is being fed (via kessel db — the only route to the managed instance)');

  const sql = FRESHNESS.map(
    (f) => `select '${f.table}' as t, count(*) as n, coalesce(round(extract(epoch from (now()-max(${f.column})))/3600, 1), -1) as age_h from ${f.table}`,
  ).join(' union all ');

  let out: string;
  try {
    const r = await run('kessel', ['db', 'query', `${sql} order by 1`], { timeout: 90_000 });
    out = r.stdout;
  } catch (e) {
    warn(`could not reach the database via kessel (${e instanceof Error ? e.message.split('\n')[0] : e})`);
    return;
  }

  for (const f of FRESHNESS) {
    // kessel renders a box table; pull the row by table name and read its two numbers.
    const line = out.split('\n').find((l) => l.includes(`│ ${f.table} `) || l.includes(`│ ${f.table}`));
    const nums = line ? [...line.matchAll(/│\s*(-?[\d.]+)\s*/g)].map((m) => Number(m[1])) : [];
    if (nums.length < 2) { warn(`${f.table}: could not read a row from the query output`); continue; }

    const [n, ageH] = [nums[0], nums[1]];
    const suffix = f.note ? ` (${f.note})` : '';
    if (n === 0) warn(`${f.table}: 0 rows${suffix}`);
    else if (ageH < 0) warn(`${f.table}: ${n} rows but no timestamp — cannot judge freshness${suffix}`);
    else if (ageH > f.maxAgeH) err(`${f.table}: ${n} rows, last write ${ageH}h ago — over the ${f.maxAgeH}h budget${suffix}`);
    else ok(`${f.table}: ${n} rows, ${ageH}h old${suffix}`);
  }

  console.log('     comms_days / messages_of_week / mow_weeks are expected to be EMPTY —');
  console.log('     MOW_BACKEND and COMMS_CALENDAR_BACKEND default to airtable and both surfaces read it live.');
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Credentials and the access we knowingly do not have.
// ─────────────────────────────────────────────────────────────────────────────

/** Env keys the deployed app needs, and the ones we know are missing on purpose. */
const EXPECTED_ENV = ['AIRTABLE_TOKEN', 'AUTH_SECRET', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'SYNC_SECRET', 'SLACK_BOT_TOKEN', 'ANTHROPIC_API_KEY'];
const KNOWN_GAPS: { key: string; what: string }[] = [
  { key: 'METABASE_URL', what: 'leads + revenue — the pack headline. Session-side agent only (S6).' },
  { key: 'YOUTUBE_OAUTH_REFRESH_TOKEN', what: "CTR / AVD / retention. YOUTUBE_API_KEY only reaches the Data API, so Vishen's 7% CTR benchmark is out of reach (W2)." },
];

async function credentialChecks() {
  head(3, 'Credentials, and the access we knowingly lack');

  try {
    const { stdout } = await run('kessel', ['env', 'list'], { timeout: 60_000 });
    for (const k of EXPECTED_ENV) {
      if (stdout.includes(k)) ok(`${k} set in Kessel`);
      else err(`${k} MISSING in Kessel — the deployed app needs it`);
    }
    for (const g of KNOWN_GAPS) {
      if (stdout.includes(g.key)) ok(`${g.key} now set — ${g.what}`);
      else console.log(`  -  ${g.key} absent, as expected — ${g.what}`);
    }
  } catch {
    warn('could not read Kessel env (not logged in?)');
  }

  try {
    const { stdout } = await run('kessel', [
      'db', 'query',
      "select provider, coalesce(last_error,'-') as last_error, round(extract(epoch from (now()-updated_at))/3600,1) as refreshed_h from external_credentials order by provider",
    ], { timeout: 90_000 });

    if (!stdout.includes('hootsuite')) {
      err('no hootsuite credential row — the nightly Perch pull cannot run');
    } else {
      const line = stdout.split('\n').find((l) => l.includes('hootsuite'))!;
      const hours = Number([...line.matchAll(/│\s*([\d.]+)\s*│?\s*$/g)].map((m) => m[1])[0] ?? NaN);
      const clean = line.includes('│ -') || line.includes('- ');
      // The ACCESS token expiring is normal — it lives about an hour and refreshes on use. What
      // matters is that the refresh succeeded recently and left no error behind.
      if (!clean) err(`hootsuite credential carries a last_error — the Perch pull is failing silently`);
      else if (Number.isFinite(hours) && hours > 48) warn(`hootsuite token last refreshed ${hours}h ago — expected within 24h of the nightly pull`);
      else ok('hootsuite credential clean and recently refreshed');
      console.log('     Single-holder and rotating: only one person can hold this refresh token.');
    }
  } catch {
    warn('could not read external_credentials');
  }
}

// ─────────────────────────────────────────────────────────────────────────────

console.log('\nContent Studio · data-flow and access doctor');

await airtableChecks();
await postgresChecks();
await credentialChecks();

console.log(`\n${'═'.repeat(60)}`);
if (errors === 0 && warnings === 0) console.log('ALL CLEAR\n');
else console.log(`${errors} error(s), ${warnings} warning(s).
Errors are bugs in this repo — a dead id or a stalled sync renders as a data gap.
Warnings are somebody else's to close (an empty field, a token to rotate).\n`);

process.exit(errors === 0 ? 0 : 1);
