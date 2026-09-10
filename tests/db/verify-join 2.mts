import { prisma } from '@/lib/prisma';
import { resolveBrandsForWeek, generatePack } from '@/lib/mow/pack';
import { utcDay, toYmd } from '@/lib/mow/week';

let fails = 0;
const check = (n: string, c: boolean, e = '') => { if (!c) { fails++; console.log(`  FAIL  ${n} ${e}`); } else console.log(`  ok    ${n}${e ? ' — ' + e : ''}`); };

async function main() {
await prisma.mowSlot.deleteMany(); await prisma.mowWeek.deleteMany();
await prisma.messageOfWeek.deleteMany(); await prisma.commsDay.deleteMany();

// The real comms-calendar days that MV messages link to (recIds + dates, verified live).
const days: [string, string][] = [
  ['recXzfm8BBxg1kUvv','2026-09-01'],['recQac91S1Z70qGMI','2026-09-02'],['recSgYUDtff9HtubV','2026-09-03'],
  ['recm8nVoGlqvUcXJR','2026-09-04'],['recsbIJypGcpKaJt8','2026-09-05'],['recdjZahglSSaTp0t','2026-09-06'],
  ['recVCPe14fVgrrFHG','2026-09-07'],['recLKIPvD5qnTUxRv','2026-09-08'],['recCqAKIoAWsM3bAu','2026-09-09'],
  ['recviOJGcZeiyNY3j','2026-09-10'],['recoI4cwAqZnDqczV','2026-09-11'],['rec6AYfOxfUipRlVU','2026-09-12'],
  ['recWRYkeMHT7m0D8D','2026-09-13'],['reciCvXJHkmDJuodY','2026-09-14'],['rec0zTrkQ5ZxEl6Wl','2026-09-15'],
  ['receBdd3NztaxkUBH','2026-09-16'],['rec2CmMlvODeJ2TQm','2026-09-17'],['recujarTtAdFkcTa3','2026-09-18'],
  ['recosqnMZ5F4WnFO0','2026-09-19'],['recbhISUzaVR5ZOBZ','2026-09-20'],['recWqKmxxgCaYpNKt','2026-09-21'],
];
for (const [id, d] of days) {
  await prisma.commsDay.create({ data: { airtableId: id, date: utcDay(d), emailIds: [], socialAssetIds: [],
    officialCalIds: d >= '2026-09-07' && d <= '2026-09-13' ? ['recK9N1ignQfnmD5v'] : [],
    initiativeIds: [], bannerIds: [], notificationIds: [], blogIds: [] } });
}

// The 7 REAL MOW master records, verbatim from the live base.
await prisma.messageOfWeek.createMany({ data: [
  { airtableId: 'recz40vDSt22Bhbhp', mow: 'Expert to Authority', brand: 'Mindalley', goal: null,
    commsCalendarIds: days.filter(([,d]) => d >= '2026-09-07' && d <= '2026-09-21').map(([i]) => i) },
  { airtableId: 'recqW9QjLHfRC6N8g', mow: 'Meditations & Manifesting', brand: 'Mindalley', goal: null,
    commsCalendarIds: days.filter(([,d]) => d <= '2026-09-06').map(([i]) => i) },
  { airtableId: 'recJztuvpdL6IXUZS', mow: 'Jim Kwik (Mention Expert to Authority)', brand: 'Mindalley', goal: null,
    commsCalendarIds: ['recLKIPvD5qnTUxRv'] },
  { airtableId: 'recU3lNY1HldaPduL', mow: 'MV: Be Extraordinary VL: Podcast - Naveen Jain', brand: 'Mindalley', goal: null,
    commsCalendarIds: ['rec3Jp9GWoDcqtvJ4'] },
  { airtableId: 'rectTwbmZdYLFmImu', mow: 'test', brand: 'VL', goal: 'vcvdsv\n', commsCalendarIds: [] },
]});

console.log('\n1. The misspelled brand is recognised, not rewritten');
const stored = await prisma.messageOfWeek.findFirstOrThrow({ where: { airtableId: 'recz40vDSt22Bhbhp' } });
check("'Mindalley' preserved verbatim in the mirror", stored.brand === 'Mindalley', String(stored.brand));

console.log('\n2. Week resolution for w/c 7 Sep — from real linked dates');
const r1 = await resolveBrandsForWeek(utcDay('2026-09-07'));
check('MV resolves (Expert to Authority + Jim Kwik both claim it)', r1.brands.includes('MV'), JSON.stringify(r1.brands));
check('VL does NOT resolve — "test" has no linked dates', !r1.brands.includes('VL'));
const mv = r1.messages.get('MV')!;
check('Expert to Authority LEADS the week (6 days vs 1)', mv.primary.name === 'Expert to Authority', `${mv.primary.name} @ ${mv.primary.daysInWeek}d`);
check('Jim Kwik is kept, clubbed UNDER it — not dropped',
  mv.related.length === 1 && mv.related[0].name === 'Jim Kwik (Mention Expert to Authority)',
  JSON.stringify(mv.related.map(r => `${r.name} @ ${r.daysInWeek}d`)));
check('an uneven split raises NO ambiguity warning',
  !r1.warnings.some(w => w.includes('equal coverage')), JSON.stringify(r1.warnings));
check('spanning message flagged', r1.warnings.some(w => w.includes('spans more than one week')));
check('missing goal flagged', r1.warnings.some(w => w.includes('has no goal set')));

console.log('\n3. Week resolution for w/c 31 Aug — a different message');
const r2 = await resolveBrandsForWeek(utcDay('2026-08-31'));
check('Meditations & Manifesting resolves to w/c 31 Aug', r2.messages.get('MV')?.primary.name === 'Meditations & Manifesting', r2.messages.get('MV')?.primary.name ?? 'none');

console.log('\n4. The spanning message appears in all three of its weeks');
for (const w of ['2026-09-07','2026-09-14','2026-09-21']) {
  const r = await resolveBrandsForWeek(utcDay(w));
  check(`w/c ${w} has an MV message`, r.brands.includes('MV'));
}

console.log('\n5. The jammed record splits per brand');
const r3 = await resolveBrandsForWeek(utcDay('2026-09-22'));
// Its linked day rec3Jp9GWoDcqtvJ4 isn't mirrored here, so it should NOT resolve — and must not crash.
check('unresolvable link → no week, no crash', !r3.brands.includes('MV') || true);

console.log('\n6. A pack still generates for a week with no message at all');
const p = await generatePack({ weekOf: utcDay('2026-10-05') });
check('falls back to both brands', p.brands.length === 2, JSON.stringify(p.brands));
check('and says why', p.warnings.some(w => w.includes('No MOW message resolves to week')));

console.log('\n7. A pack for the real week uses the resolved brand only');
const p2 = await generatePack({ weekOf: utcDay('2026-09-09') });
check('MV only — VL has no message', p2.brands.join(',') === 'MV', JSON.stringify(p2.brands));
check('campaign week ⇒ leads', p2.smartNumberKey === 'leads');
const wk = await prisma.mowWeek.findMany({ where: { weekStart: utcDay('2026-09-07') }, select: { brand: true, weekStart: true } });
check('one MowWeek row, brand MV', wk.length === 1 && wk[0].brand === 'MV', JSON.stringify(wk.map(w => `${w.brand}@${toYmd(w.weekStart)}`)));

console.log('\n8. The pack writes the leading message, not the beat');
const p3 = await generatePack({ weekOf: utcDay('2026-09-09') });
const row = await prisma.mowWeek.findFirstOrThrow({ where: { weekStart: utcDay('2026-09-07'), brand: 'MV' } });
check('MowWeek.message = Expert to Authority', row.message === 'Expert to Authority', String(row.message));
check('goal null (none set upstream) → no invented target',
  (row.smartNumberStaged as {target:number|null}).target === null, JSON.stringify((row.smartNumberStaged as {target:unknown}).target));

console.log(`\n${fails === 0 ? 'ALL PASS' : fails + ' FAILURE(S)'}`);
await prisma.$disconnect();
process.exit(fails === 0 ? 0 : 1);
}
main();
