import { readFileSync } from 'node:fs';
import { commsDayUpsertData, upsertCommsDaysFromRecords } from '@/lib/airtable/comms-day-upsert';
import { commsDayToAirtableFields, assertNoReadOnlyFields, COMMS_DAY_READ_ONLY_IDS } from '@/lib/airtable/comms-day-push-map';
import { COMMS_DAY } from '@/lib/airtable/field-map';
import { prisma } from '@/lib/prisma';

const recs = JSON.parse(readFileSync(process.argv[2], 'utf8'));
let fails = 0;
const check = (name: string, cond: boolean, extra = '') => {
  if (!cond) { fails++; console.log(`  FAIL  ${name} ${extra}`); } else console.log(`  ok    ${name}`);
};

console.log('\n1. Mapper — REST shape (plain recIds / plain lookup arrays)');
const a = commsDayUpsertData(recs[0]);
check('date parsed', a.date?.toISOString().slice(0,10) === '2026-09-07', String(a.date));
check('message of week', a.messageOfWeek === 'Expert to Authority', String(a.messageOfWeek));
check('the goal', a.theGoal?.includes('35k leads') === true, String(a.theGoal));
check('phase (plain string select)', a.phase === 'Promotions', String(a.phase));
check('coreMessage bool', a.coreMessage === true);
check('officialCalIds', JSON.stringify(a.officialCalIds) === '["recK9N1ignQfnmD5v"]', JSON.stringify(a.officialCalIds));
check('socialAssetIds len 3', a.socialAssetIds.length === 3, JSON.stringify(a.socialAssetIds));
check('roProjectName from lookup array', a.roProjectName?.startsWith('Expert to Authority') === true, String(a.roProjectName));
check('roStatus from lookup array', a.roStatus === 'Confirmed', String(a.roStatus));
check('roWeekday formula', a.roWeekday === 'Monday', String(a.roWeekday));

console.log('\n2. Mapper — MCP shape (objects / lookup envelopes)');
const b = commsDayUpsertData(recs[1]);
check('phase from {id,name}', b.phase === 'Retention', String(b.phase));
check('links from [{id,name}]', JSON.stringify(b.socialAssetIds) === '["recJ9laDP1uWIXTHe","recOCSBc9gd3HyRhc"]', JSON.stringify(b.socialAssetIds));
check('roStatus from envelope', b.roStatus === 'Confirmed', String(b.roStatus));
check('roProjectName from envelope', b.roProjectName === 'Expert to Authority Summit', String(b.roProjectName));
check('currency', Number(b.totalDailyRevenue) === 12345.67, String(b.totalDailyRevenue));
check('sales', b.sales === 42, String(b.sales));

console.log('\n3. Mapper — sparse row (Glen’s un-backfilled day)');
const c = commsDayUpsertData(recs[2]);
check('null message tolerated', c.messageOfWeek === null);
check('null goal tolerated', c.theGoal === null);
check('empty link arrays not null', Array.isArray(c.emailIds) && c.emailIds.length === 0);

console.log('\n4. Push map excludes every read-only field');
const fields = commsDayToAirtableFields({ ...a, totalDailyRevenue: a.totalDailyRevenue } as never);
const leaked = Object.keys(fields).filter((k) => COMMS_DAY_READ_ONLY_IDS.includes(k));
check('no read-only ids in payload', leaked.length === 0, leaked.join(','));
check('date serialized YYYY-MM-DD', fields[COMMS_DAY.fields.date] === '2026-09-07', String(fields[COMMS_DAY.fields.date]));
check('links round-trip as arrays', JSON.stringify(fields[COMMS_DAY.links.officialCal]) === '["recK9N1ignQfnmD5v"]');

console.log('\n5. The guard actually throws');
let threw = false;
try { assertNoReadOnlyFields({ ...fields, [COMMS_DAY.readOnlyFields.leadGenGoal]: 35000 }); } catch { threw = true; }
check('assertNoReadOnlyFields throws on a lookup', threw);

async function main() {
console.log('\n6. Round-trip through Postgres');
const n = await upsertCommsDaysFromRecords(recs);
check('upserted 3', n === 3);
const again = await upsertCommsDaysFromRecords(recs);
check('idempotent re-upsert', again === 3);
const rows = await prisma.commsDay.findMany({ orderBy: { date: 'asc' }, select: { airtableId: true, date: true, messageOfWeek: true, socialAssetIds: true, roLeadGenGoal: true, totalDailyRevenue: true } });
check('3 rows, no duplicates', rows.length === 3, `got ${rows.length}`);
console.log('  rows:', JSON.stringify(rows.map(r => ({ d: r.date?.toISOString().slice(0,10), m: r.messageOfWeek, n: r.socialAssetIds.length, goal: r.roLeadGenGoal, rev: r.totalDailyRevenue })), null, 0));

console.log(`\n${fails === 0 ? 'ALL PASS' : fails + ' FAILURE(S)'}`);
await prisma.$disconnect();
process.exit(fails === 0 ? 0 : 1);
}
main();
