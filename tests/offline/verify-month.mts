import { bandsFor } from '@/lib/comms-calendar/month';
import type { Brand } from '@/lib/comms-calendar/types';

let fails = 0;
const ck = (n: string, c: boolean, e = '') => {
  if (!c) { fails++; console.log(`  FAIL  ${n} ${e}`); } else console.log(`  ok    ${n}${e ? ' — ' + e : ''}`);
};

const SEP_START = new Date(Date.UTC(2026, 8, 1));
const SEP_END = new Date(Date.UTC(2026, 8, 30));
const day = (n: number) => `2026-09-${String(n).padStart(2, '0')}`;

/** Build a per-day message map the way the reader does. */
const mapOf = (spec: Record<number, string | null>) => {
  const m = new Map<string, string | null>();
  for (const [k, v] of Object.entries(spec)) m.set(day(Number(k)), v);
  return m;
};

// The real Mindvalley September, verbatim from the live comms calendar on 10 Sep. The shape that
// matters: `Expert to Authority` is INTERRUPTED on the 8th by a one-day beat, so it is two runs.
const MV_SEP: Record<number, string | null> = {};
for (let d = 1; d <= 6; d++) MV_SEP[d] = 'Meditations & Manifesting';
MV_SEP[7] = 'Expert to Authority';
MV_SEP[8] = 'Jim Kwik (Mention Expert to Authority)';
for (let d = 9; d <= 21; d++) MV_SEP[d] = 'Expert to Authority';
for (let d = 22; d <= 27; d++) MV_SEP[d] = 'Be Extraordinary';
for (let d = 28; d <= 30; d++) MV_SEP[d] = '6 Phase Meditation';

console.log('\n1. Contiguous runs collapse into bands');
const mv = bandsFor('MV' as Brand, mapOf(MV_SEP), SEP_START, SEP_END);
ck('six bands for the real September', mv.length === 6, String(mv.length));
ck('first is Meditations, 1–6', mv[0].name === 'Meditations & Manifesting' && mv[0].days === 6
   && mv[0].startYmd === '2026-09-01' && mv[0].endYmd === '2026-09-06');
ck('a one-day beat does NOT merge into the campaign around it',
   mv[1].days === 1 && mv[2].name!.startsWith('Jim Kwik') && mv[3].days === 13,
   `${mv[1].name} (${mv[1].days}d) | ${mv[2].name} (${mv[2].days}d) | ${mv[3].name} (${mv[3].days}d)`);
ck('the interrupted campaign is two runs, not one', mv.filter(b => b.name === 'Expert to Authority').length === 2);
ck('none of the real bands is a gap', mv.every(b => !b.gap));

console.log('\n2. Percentages place the band inside the month');
ck('first band starts at 0%', mv[0].leftPct === 0);
ck('first band is 6/30 wide', Math.abs(mv[0].widthPct - 20) < 0.01, `${mv[0].widthPct}%`);
ck('last band ends flush at 100%', Math.abs(mv[5].leftPct + mv[5].widthPct - 100) < 0.01,
   `${(mv[5].leftPct + mv[5].widthPct).toFixed(2)}%`);
ck('bands are contiguous with no overlap and no hole', mv.every((b, i) =>
   i === 0 || Math.abs(mv[i - 1].leftPct + mv[i - 1].widthPct - b.leftPct) < 0.01));
ck('the days add up to the month', mv.reduce((n, b) => n + b.days, 0) === 30);

console.log('\n3. Absence is carried as a gap band, never skipped');
// The live Vishen lane: no message anywhere all month, because the one linked asset points at
// `test` and that suppresses to null (Y2). This is the artboard that makes the problem undeniable.
const vl = bandsFor('VL' as Brand, new Map(), SEP_START, SEP_END);
ck('one band spanning the whole month', vl.length === 1 && vl[0].days === 30);
ck('flagged as a gap, with no name', vl[0].gap && vl[0].name === null);
ck('still positioned, so the component can place the hairline',
   vl[0].leftPct === 0 && Math.abs(vl[0].widthPct - 100) < 0.01);

console.log('\n4. A gap BETWEEN two messages keeps its own band');
const patchy = bandsFor('MV' as Brand, mapOf({ 1: 'A', 2: 'A', 5: 'B', 6: 'B' }), SEP_START, SEP_END);
ck('A, gap, B, gap — four bands', patchy.length === 4, patchy.map(b => `${b.name ?? 'gap'}:${b.days}`).join(' '));
ck('the middle gap is days 3–4', patchy[1].gap && patchy[1].startYmd === '2026-09-03' && patchy[1].endYmd === '2026-09-04');
ck('the trailing gap runs to month end', patchy[3].gap && patchy[3].endYmd === '2026-09-30');
ck('gaps still cover the month with the named runs',
   patchy.reduce((n, b) => n + b.days, 0) === 30);

console.log('\n5. A single-message month is one band, not thirty');
const one = bandsFor('MV' as Brand, mapOf(Object.fromEntries(
  Array.from({ length: 30 }, (_, i) => [i + 1, 'One thing']),
) as Record<number, string>), SEP_START, SEP_END);
ck('exactly one band', one.length === 1 && one[0].days === 30, String(one.length));

console.log(`\n${fails === 0 ? 'ALL PASS' : fails + ' FAILURE(S)'}`);
process.exit(fails === 0 ? 0 : 1);
