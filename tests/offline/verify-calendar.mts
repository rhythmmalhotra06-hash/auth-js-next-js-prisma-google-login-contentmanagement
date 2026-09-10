import { assembleWeek } from '@/lib/comms-calendar/data.airtable';
import { utcDay } from '@/lib/mow/week';
import { VL_VIDEOS as V, COMMS_DAY as C, VL_MESSAGE_OF_WEEK as M } from '@/lib/airtable/field-map';

let fails = 0;
const ck = (n: string, c: boolean, e = '') => { if (!c) { fails++; console.log(`  FAIL  ${n} ${e}`); } else console.log(`  ok    ${n}${e ? ' — ' + e : ''}`); };

// Real VL rows, verbatim field shapes from tblcqpctTr76RQsQT on 10 Sep.
const vlRows = [
  { id: 'recTwpYaxuAcXtAff', createdTime: '', fields: {
    [V.fields.name]: 'LIVE: A mentor once stopped me mid-sentence with four words.',
    [V.fields.liveDate]: '2026-09-07', [V.fields.status]: '7. Published',
    [V.fields.publishedLink]: 'https://lnkd.in/p/es5X48Yk', [V.fields.source]: ['VL LI: Two Comma PR'] } },
  { id: 'recFlJrz5CT33HDrR', createdTime: '', fields: {
    [V.fields.name]: 'VL Youtube - Vishen X Jim Kwik - World #1 Brain Coach',
    [V.fields.liveDate]: '2026-09-08', [V.fields.status]: '7. Published',
    [V.fields.medium]: 'Podcast', [V.fields.publishedLink]: 'https://www.youtube.com/watch?v=ixaV0S1faiM' } },
  { id: 'recU3XlsHfmT3tGri', createdTime: '', fields: {
    [V.fields.name]: 'LIVE: When a killer whale grandmother dies…',
    [V.fields.liveDate]: '2026-09-09', [V.fields.status]: '7. Published' } },
  // The one asset carrying a message link — and that message is named "test".
  { id: 'recvf1mfzZAJb5cbf', createdTime: '', fields: {
    [V.fields.name]: 'I visualised the trophy for years and wondered why nothing ever moved.',
    [V.fields.liveDate]: '2026-09-10', [V.fields.status]: '1. Idea',
    [V.links.messageOfWeek]: ['receMF7JmJTJHKZkw'] } },
  // Out of week — sets datedThrough, must not appear in the grid.
  { id: 'recXGjvuBemOYkyvn', createdTime: '', fields: {
    [V.fields.name]: 'VL YouTube Talking Heads - The 5 Stages', [V.fields.liveDate]: '2026-09-22', [V.fields.status]: '1. Idea' } },
  // Undated: two published, one not. Counted, never dropped.
  { id: 'rec0d3dthXajz4HAM', createdTime: '', fields: { [V.fields.name]: 'Your content is not your identity.', [V.fields.status]: '7. Published' } },
  { id: 'rec1KRGwWypNKQNnH', createdTime: '', fields: { [V.fields.name]: 'RapidFire: 7.', [V.fields.status]: '7. Published' } },
  { id: 'rec0ei8bxX9NnSrqt', createdTime: '', fields: { [V.fields.name]: 'He carries $250K cash', [V.fields.status]: '2. Idea Confirmed' } },
];

const msgRows = [
  { id: 'receMF7JmJTJHKZkw', createdTime: '', fields: {
    [M.fields.name]: 'test', [M.fields.goal]: 'vcvdsv\n', [M.fields.brand]: { id: 's', name: 'VL' } } },
];

// Real MV comms-calendar rows, w/c 7 Sep — and this is the fixture that changed on 10 Sep.
//
// It used to carry the message text on Monday alone, which made the week look like it had one
// message and one goal. The live base does not: EVERY day repeats the text, w/c 7 Sep runs two
// different messages, and `Expert to Authority` itself carries two different goals (35k on Mon,
// 25k from Wed). Because the fixture had only one of each, the reader's `??=` — take whichever row
// the API returns first — passed every check here and then dropped Tuesday's content on the first
// live run. The plural case is now the fixture.
const mvRows = [
  { id: 'recVCPe14fVgrrFHG', createdTime: '', fields: { [C.fields.date]: '2026-09-07',
    [C.fields.messageOfWeek]: 'Expert to Authority', [C.fields.theGoal]: 'To achieve 35k leads to expert to authority summit',
    [C.links.emails]: ['rec6W5R8kqSqa3le4'], [C.links.socialAllAssets]: ['a','b','c','d','e'] } },
  // Tuesday is its own message — a beat inside the campaign, not a rival to it.
  { id: 'recLKIPvD5qnTUxRv', createdTime: '', fields: { [C.fields.date]: '2026-09-08',
    [C.fields.messageOfWeek]: 'Jim Kwik (Mention Expert to Authority)',
    [C.fields.theGoal]: "Launch Jim Kwik's podcast and scale to 50k views by next week",
    [C.links.socialAllAssets]: ['a','b','c','d','e'] } },
  { id: 'recCqAKIoAWsM3bAu', createdTime: '', fields: { [C.fields.date]: '2026-09-09',
    [C.fields.messageOfWeek]: 'Expert to Authority', [C.fields.theGoal]: 'To achieve 25k leads to expert to authority summit',
    [C.links.emails]: ['x'], [C.links.socialAllAssets]: ['a','b','c'] } },
  { id: 'recviOJGcZeiyNY3j', createdTime: '', fields: { [C.fields.date]: '2026-09-10',
    [C.fields.messageOfWeek]: 'Expert to Authority', [C.fields.theGoal]: 'To achieve 25k leads to expert to authority summit',
    [C.links.emails]: ['y'], [C.links.socialAllAssets]: ['a','b','c','d','e','f'] } },
  { id: 'recoI4cwAqZnDqczV', createdTime: '', fields: { [C.fields.date]: '2026-09-11',
    [C.fields.messageOfWeek]: 'Expert to Authority', [C.fields.theGoal]: 'To achieve 25k leads to expert to authority summit',
    [C.links.socialAllAssets]: ['a','b','c'] } },
  { id: 'rec6AYfOxfUipRlVU', createdTime: '', fields: { [C.fields.date]: '2026-09-12',
    [C.fields.messageOfWeek]: 'Expert to Authority', [C.fields.theGoal]: 'To achieve 25k leads to expert to authority summit' } },
  { id: 'recWRYkeMHT7m0D8D', createdTime: '', fields: { [C.fields.date]: '2026-09-13',
    [C.fields.messageOfWeek]: 'Expert to Authority', [C.fields.theGoal]: 'To achieve 25k leads to expert to authority summit' } },
  // Outside the week — present only so the span is knowable. `Expert to Authority` runs to 21 Sep.
  { id: 'recSpan14', createdTime: '', fields: { [C.fields.date]: '2026-09-14',
    [C.fields.messageOfWeek]: 'Expert to Authority', [C.fields.theGoal]: 'To achieve 25k leads to expert to authority summit' } },
  { id: 'recSpan21', createdTime: '', fields: { [C.fields.date]: '2026-09-21',
    [C.fields.messageOfWeek]: 'Expert to Authority', [C.fields.theGoal]: 'To achieve 25k leads to expert to authority summit' } },
  // The dirty live record: two brands jammed into one field (acceptance criterion 11d).
  { id: 'recJammed22', createdTime: '', fields: { [C.fields.date]: '2026-09-22',
    [C.fields.messageOfWeek]: 'MV: Be Extraordinary VL: Podcast - Naveen Jain',
    [C.fields.theGoal]: 'Signups for the masterclass' } },
];

const w = assembleWeek({ anchor: utcDay('2026-09-09'), vlRows, msgRows, mvRows });

console.log('\n1. The week itself');
ck('starts Monday 7 Sep', w.weekStart === '2026-09-07', w.weekStart);
ck('ends Sunday 13 Sep', w.weekEnd === '2026-09-13', w.weekEnd);
ck('seven days', w.days.length === 7);

console.log('\n2. Vishen lane — real assets on the right days');
const byDay = Object.fromEntries(w.days.map(d => [d.date, d.vl.map(a => a.title.slice(0, 28))]));
ck('Mon 7 — the mentor post', byDay['2026-09-07']?.[0]?.includes('A mentor once stopped') === true);
ck('Tue 8 — Jim Kwik', byDay['2026-09-08']?.[0]?.includes('Vishen X Jim') === true);
ck('Wed 9 — killer whale', byDay['2026-09-09']?.[0]?.includes('killer whale') === true);
ck('Thu 10 — the trophy post', byDay['2026-09-10']?.[0]?.includes('I visualised the trophy') === true);
ck('Fri 11 empty (real)', (byDay['2026-09-11'] ?? []).length === 0);
ck('the 22 Sep asset is NOT in this week', !JSON.stringify(byDay).includes('5 Stages'));

console.log('\n3. Undated assets counted, never dropped');
ck('3 undated', w.notDated.total === 3, String(w.notDated.total));
ck('2 of them published', w.notDated.published === 2, String(w.notDated.published));
ck('1 unpublished', w.notDated.unpublished === 1);

console.log('\n4. The boundary the grid states about itself (Y3 — computed, never a constant)');
ck('datedThrough = 22 Sep', w.datedThrough === '2026-09-22', String(w.datedThrough));
ck('1 asset dated after this week', w.datedAfterWeek === 1, String(w.datedAfterWeek));
ck('undated share is computed, not phrased', w.notDated.sharePct === 38, `${w.notDated.sharePct}%`);

console.log('\n5. Headers — and the rule about never borrowing');
const vl = w.headers.find(h => h.brand === 'VL')!;
const mv = w.headers.find(h => h.brand === 'MV')!;
ck('MV message is real', mv.message === 'Expert to Authority', String(mv.message));
ck('VL does NOT inherit Mindvalley’s message', vl.message !== mv.message);
ck('VL counted 4 dated assets', vl.datedCount === 4, String(vl.datedCount));

// ── D1: coverage decides, and nothing is dropped ──────────────────────────────
// `Expert to Authority` covers 6 of the week's days; `Jim Kwik` covers Tuesday alone. The old
// `??=` returned whichever row came back first and discarded the other outright.
console.log('\n5b. D1 — two messages in one week: coverage leads, the rest are kept');
ck('the 6-day message leads', mv.message === 'Expert to Authority');
ck('Tuesday’s beat is kept, not dropped', mv.related.length === 1 && mv.related[0].name.startsWith('Jim Kwik'),
   JSON.stringify(mv.related));
ck('and it is marked as one day', mv.related[0]?.days === 1, String(mv.related[0]?.days));
ck('the 5-day goal leads over the 1-day goal', mv.goal?.includes('25k') === true, String(mv.goal));
ck('the discarded 35k goal is NAMED in a warning, not silently dropped',
   w.warnings.some(x => x.includes('35k') && x.includes('25k')),
   w.warnings.find(x => x.includes('35k')) ?? '(none)');
ck('the span is read off the window', mv.spanNote === 'spans 7–21 Sept', String(mv.spanNote));

// ── D2: only assets dated INTO this week may nominate its message ─────────────
// The one linked asset in the whole base is dated inside this week here, so `test` IS this
// week's candidate — and Y2 then suppresses it. The out-of-week case is asserted below.
console.log('\n5c. Y2 — junk suppresses to the ordinary gap, and is named in warnings');
ck('the junk value never reaches the display', vl.message === null, String(vl.message));
ck('but it IS recognised', vl.messageIsPlaceholder);
ck('vcvdsv likewise suppressed', vl.goal === null && vl.goalIsPlaceholder);
ck('and named for whoever can fix it upstream',
   w.warnings.some(x => x.includes('test')) && w.warnings.some(x => x.includes('vcvdsv')));

console.log('\n6. Lane volume (6c option C) — declared, not encoded in width');
ck('busier lane is 100%', Math.max(vl.volumePct, mv.volumePct) === 100, `VL ${vl.volumePct}% MV ${mv.volumePct}%`);
ck('VL is visibly the smaller lane', vl.volumePct < mv.volumePct);

console.log('\n7. The gold element fires only when it should');
ck('fires for Vishen only — MV has a real goal', JSON.stringify(w.brandsWithoutGoal) === '["VL"]',
   JSON.stringify(w.brandsWithoutGoal));
ck('MV goal is the real one from the comms calendar', mv.goal?.includes('25k leads') === true, String(mv.goal));
ck('a placeholder goal counts as missing', vl.goalIsPlaceholder && w.brandsWithoutGoal.includes('VL'));

console.log('\n8. Mindvalley overflow — the count, not a footnote');
const thu = w.days.find(d => d.date === '2026-09-10')!;
ck('Thu shows 2 inline + 5 overflow (1 email + 6 social)', thu.mv.length === 2 && thu.mvOverflow === 5,
   `${thu.mv.length} inline / ${thu.mvOverflow} overflow`);
const sat = w.days.find(d => d.date === '2026-09-12')!;
ck('Sat has nothing either lane', sat.mv.length === 0 && sat.vl.length === 0 && sat.mvOverflow === 0);
ck('weekend flagged', sat.isWeekend);

// ── D2 proper: the defect that put a message on Vishen's lane he never committed ──
// Live shape on 10 Sep: exactly one of 238 dated VL assets carries a message link, and it is
// dated 16 Sep. The old reader scanned the whole MOW table for a VL-branded row, so w/c 7 Sep
// was rendered with that message. Re-run the same week with the link moved out of it.
console.log('\n9. D2 — a message linked only from OUTSIDE the week is not this week’s message');
const vlOutOfWeek = vlRows.map(r =>
  r.id === 'recvf1mfzZAJb5cbf'
    ? { ...r, fields: { ...r.fields, [V.fields.liveDate]: '2026-09-16' } }
    : r);
const w2 = assembleWeek({ anchor: utcDay('2026-09-09'), vlRows: vlOutOfWeek, msgRows, mvRows });
const vl2 = w2.headers.find(h => h.brand === 'VL')!;
ck('no message is invented for the week', vl2.message === null, String(vl2.message));
ck('and it is not flagged as junk either — there is simply nothing', !vl2.messageIsPlaceholder);
ck('Mindvalley is unaffected', w2.headers.find(h => h.brand === 'MV')!.message === 'Expert to Authority');
ck('the week still renders its assets', w2.days.reduce((n, d) => n + d.vl.length, 0) === 3,
   String(w2.days.reduce((n, d) => n + d.vl.length, 0)));

// ── The jammed record must not break brand grouping (acceptance criterion 11d) ──
console.log('\n10. The dirty jammed record renders on its own week');
const w3 = assembleWeek({ anchor: utcDay('2026-09-23'), vlRows, msgRows, mvRows });
const mv3 = w3.headers.find(h => h.brand === 'MV')!;
ck('MV takes only its own half of the jam', mv3.message === 'Be Extraordinary', String(mv3.message));
ck('and VL does not inherit the other half', w3.headers.find(h => h.brand === 'VL')!.message === null);

console.log(`\n${fails === 0 ? 'ALL PASS' : fails + ' FAILURE(S)'}`);
process.exit(fails === 0 ? 0 : 1);
