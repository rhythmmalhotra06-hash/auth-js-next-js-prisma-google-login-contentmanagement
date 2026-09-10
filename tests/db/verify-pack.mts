import { readFileSync } from 'node:fs';
import { upsertCommsDaysFromRecords } from '@/lib/airtable/comms-day-upsert';
import { generatePack, getPack, canCommitMow } from '@/lib/mow/pack';
import { weekStartOf, utcDay, weekDays, toYmd } from '@/lib/mow/week';
import { prisma } from '@/lib/prisma';

let fails = 0;
const check = (n: string, c: boolean, e = '') => { if (!c) { fails++; console.log(`  FAIL  ${n} ${e}`); } else console.log(`  ok    ${n}${e ? ' — ' + e : ''}`); };

async function main() {
// Clear messages too: this suite exercises the NO-MESSAGE fallback path (both brands render).
// The resolved-brand path is covered by verify-join.mts against the 7 real MOW records.
await prisma.mowSlot.deleteMany(); await prisma.mowWeek.deleteMany();
await prisma.commsDay.deleteMany(); await prisma.messageOfWeek.deleteMany();

console.log('\n1. Week arithmetic (UTC calendar day — Glen’s UTC+8 bug)');
check('Mon 7 Sep → itself', toYmd(weekStartOf(utcDay('2026-09-07'))) === '2026-09-07');
check('Wed 9 Sep → Mon 7', toYmd(weekStartOf(utcDay('2026-09-09'))) === '2026-09-07');
check('Sun 13 Sep belongs to the week that STARTED Mon 7', toYmd(weekStartOf(utcDay('2026-09-13'))) === '2026-09-07');
check('Mon 14 Sep starts a new week', toYmd(weekStartOf(utcDay('2026-09-14'))) === '2026-09-14');
check('7 days Mon..Sun', weekDays(utcDay('2026-09-09')).map(toYmd).join(',') === '2026-09-07,2026-09-08,2026-09-09,2026-09-10,2026-09-11,2026-09-12,2026-09-13');

console.log('\n2. Ingest the real week of 7–13 Sep');
const recs = JSON.parse(readFileSync(process.argv[2], 'utf8'));
check('7 comms days upserted', (await upsertCommsDaysFromRecords(recs)) === 7);

console.log('\n3. Generate the pack');
const r = await generatePack({ weekOf: utcDay('2026-09-09') });
check('weekStart normalized to Monday', r.weekStart === '2026-09-07', r.weekStart);
check('two brands → two MowWeek rows (S3)', r.weeksCreated === 2, `created ${r.weeksCreated}`);
check('live campaign detected (Official Cal linked Mon+Thu)', r.liveCampaign === true);
check('campaign week ⇒ headline = leads (S2)', r.smartNumberKey === 'leads', r.smartNumberKey);
check('target provenance = inferred (F8: Lead gen Goal empty)', r.targetProvenance === 'inferred', r.targetProvenance);
// Mon 5 social + 1 email, Tue 5 social, Wed 3 social + 1 email, Thu 6 social + 1 email,
// Fri 3 social, Sat/Sun nothing ⇒ 8 slots per brand, 16 total.
check('16 slots (8 per brand)', r.slotsCreated === 16, `created ${r.slotsCreated}`);
console.log('  warnings:'); r.warnings.forEach(w => console.log('    · ' + w));
check('warns about conflicting goals', r.warnings.some(w => w.includes('different goals')));
check('warns the target was inferred', r.warnings.some(w => w.includes('INFERRED')));

console.log('\n4. Idempotency — a re-run must not duplicate');
const r2 = await generatePack({ weekOf: utcDay('2026-09-11') });
check('no new weeks', r2.weeksCreated === 0 && r2.weeksUpdated === 2, `c${r2.weeksCreated}/u${r2.weeksUpdated}`);
check('no new slots', r2.slotsCreated === 0 && r2.slotsUpdated === 16, `c${r2.slotsCreated}/u${r2.slotsUpdated}`);
check('still 16 slots total', (await prisma.mowSlot.count()) === 16);
check('still 2 weeks total', (await prisma.mowWeek.count()) === 2);

console.log('\n5. Propose-only — a committed week survives regeneration');
const mv = await prisma.mowWeek.findFirstOrThrow({ where: { brand: 'MV' } });
await prisma.mowWeek.update({ where: { id: mv.id }, data: {
  status: 'closed', committedBy: 'gareth@mindvalley.com', committedAt: new Date(),
  smartNumberCommitted: { key: 'leads', value: 31200, label: 'Leads' },
  weekSummaryCommitted: 'Summit announce landed; Jim Kwik under-indexed.',
  message: 'HUMAN EDIT — do not overwrite', goal: 'HUMAN GOAL',
}});
const r3 = await generatePack({ weekOf: utcDay('2026-09-07') });
check('committed week skipped', r3.weeksSkippedCommitted === 1, String(r3.weeksSkippedCommitted));
const after = await prisma.mowWeek.findUniqueOrThrow({ where: { id: mv.id } });
check('committed number untouched', (after.smartNumberCommitted as {value:number}).value === 31200);
check('human summary untouched', after.weekSummaryCommitted === 'Summit announce landed; Jim Kwik under-indexed.');
check('human message untouched', after.message === 'HUMAN EDIT — do not overwrite');
check('human goal untouched', after.goal === 'HUMAN GOAL');
check('VL (uncommitted) still refreshed', r3.weeksUpdated === 1, String(r3.weeksUpdated));

console.log('\n6. Committer allowlist (S4)');
check('Gareth may commit', canCommitMow('gareth@mindvalley.com'));
check('Glen may commit', canCommitMow('Glen@Mindvalley.com'));
check('Ramya may commit', canCommitMow('ramya@mindvalley.com'));
check('an editor may not', !canCommitMow('titus@mindvalley.com'));
check('null may not', !canCommitMow(null));

console.log('\n7. Read the pack back');
const pack = await getPack(utcDay('2026-09-09'));
check('2 brand rows', pack.weeks.length === 2);
const vl = pack.weeks.find(w => w.brand === 'VL')!;
check('VL staged number present, value null (generator invents nothing)',
  (vl.smartNumberStaged as {value:null;target:number}).value === null && (vl.smartNumberStaged as {target:number}).target === 35000,
  `target=${(vl.smartNumberStaged as {target:number}).target}`);
check('Monday’s goal won the tie-break', vl.goal?.includes('35k') === true, String(vl.goal));
const byDay = vl.slots.reduce<Record<string,string[]>>((a,s)=>{const k=toYmd(s.day);(a[k]??=[]).push(s.channel);return a;},{});
console.log('  VL slots:', JSON.stringify(byDay));
check('Mon has email+social', byDay['2026-09-07']?.sort().join(',') === 'email,social');
check('Tue social only', byDay['2026-09-08']?.join(',') === 'social');
check('Sat/Sun have no slots', !byDay['2026-09-12'] && !byDay['2026-09-13']);
check('slots carry Editor TBC not a guessed name', vl.slots.every(s => s.ownerNameFallback === 'Editor TBC'));

console.log(`\n${fails === 0 ? 'ALL PASS' : fails + ' FAILURE(S)'}`);
await prisma.$disconnect();
process.exit(fails === 0 ? 0 : 1);
}
main();
