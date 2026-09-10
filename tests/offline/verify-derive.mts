import { normaliseBrand, deriveWeeks, splitJammedName, BRAND_LABEL } from '@/lib/mow/derive-week';
import { toYmd } from '@/lib/mow/week';

let fails = 0;
const eq = (n: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) { fails++; console.log(`  FAIL  ${n}: got ${JSON.stringify(got)} want ${JSON.stringify(want)}`); }
  else console.log(`  ok    ${n} = ${JSON.stringify(got)}`);
};

console.log('\n1. Brand normalisation — including the LIVE misspelling');
eq("'Mindalley' (the live typo)", normaliseBrand('Mindalley'), 'MV');
eq("'Mindvalley' (once fixed)",   normaliseBrand('Mindvalley'), 'MV');
eq("'VL'",                        normaliseBrand('VL'), 'VL');
eq("'Vishen Lakhiani Media'",     normaliseBrand('Vishen Lakhiani Media'), 'VL');
eq('unknown → null',              normaliseBrand('Acme'), null);
eq('null → null',                 normaliseBrand(null), null);
eq('label never leaks the typo',  BRAND_LABEL.MV, 'Mindvalley');

console.log('\n2. Week derivation from the REAL comms-calendar link display names');
// 'Expert to Authority' — verified live: links Sep 7 through Sep 21.
const eta = deriveWeeks({ linkedDates: [
  'September 7, 2026','September 9, 2026','September 10, 2026','September 11, 2026',
  'September 12, 2026','September 13, 2026','September 14, 2026','September 15, 2026',
  'September 16, 2026','September 17, 2026','September 18, 2026','September 19, 2026',
  'September 20, 2026','September 21, 2026',
]});
eq('spans 3 weeks', eta.weekStarts.map(toYmd), ['2026-09-07','2026-09-14','2026-09-21']);
eq('flagged as spanning', eta.spansMultiple, true);
eq('source = derived', eta.source, 'derived');

// 'Meditations & Manifesting' — verified live: Sep 1–6, all one week (Mon 31 Aug).
const mm = deriveWeeks({ linkedDates: [
  'September 1, 2026','September 2, 2026','September 3, 2026',
  'September 4, 2026','September 5, 2026','September 6, 2026',
]});
eq('Sep 1–6 is ONE week (Mon 31 Aug)', mm.weekStarts.map(toYmd), ['2026-08-31']);
eq('not spanning', mm.spansMultiple, false);

console.log('\n3. The field wins when it exists');
const withField = deriveWeeks({ weekStarting: new Date('2026-09-09T00:00:00Z'), linkedDates: ['September 1, 2026'] });
eq('normalised to its Monday', withField.weekStarts.map(toYmd), ['2026-09-07']);
eq('source = field', withField.source, 'field');

console.log('\n4. The "test" record and other empty cases');
eq('no dates at all → none', deriveWeeks({ linkedDates: [] }).source, 'none');
eq('no dates → empty, not a fake week', deriveWeeks({}).weekStarts, []);
eq('unparsable ignored', deriveWeeks({ linkedDates: ['vcvdsv', null, ''] }).source, 'none');

console.log('\n5. ISO dates (the VL Live Date lookup shape)');
eq('bare YYYY-MM-DD', deriveWeeks({ linkedDates: ['2026-09-10'] }).weekStarts.map(toYmd), ['2026-09-07']);
eq('ISO timestamp', deriveWeeks({ linkedDates: ['2026-09-22T00:00:00.000Z'] }).weekStarts.map(toYmd), ['2026-09-21']);

console.log('\n6. The dirty jammed record (acceptance criterion 7)');
const jam = 'MV: Be Extraordinary VL: Podcast - Naveen Jain';
eq('MV side', splitJammedName(jam, 'MV'), 'Be Extraordinary');
eq('VL side', splitJammedName(jam, 'VL'), 'Podcast - Naveen Jain');
eq('unknown brand keeps it whole', splitJammedName(jam, null), jam);
eq('a normal name is untouched', splitJammedName('Expert to Authority', 'MV'), 'Expert to Authority');
eq('null name → empty string', splitJammedName(null, 'MV'), '');

console.log(`\n${fails === 0 ? 'ALL PASS' : fails + ' FAILURE(S)'}`);
process.exit(fails === 0 ? 0 : 1);
