import { blockersFor } from '@/lib/mow/blockers';
import type { CalendarWeek } from '@/lib/comms-calendar/types';

let fails = 0;
const ck = (n: string, c: boolean, e = '') => {
  if (!c) { fails++; console.log(`  FAIL  ${n} ${e}`); } else console.log(`  ok    ${n}${e ? ' — ' + e : ''}`);
};

/** w/c 7 Sep as production actually holds it, so the assertions are about real conditions. */
const post = (over: Partial<CalendarWeek['allPosts'][number]> = {}) => ({
  id: 'rec' + Math.random().toString(36).slice(2, 10),
  title: 'a post', brand: 'MV' as const, channel: 'IG: MV', status: null, source: null,
  publishedUrl: null, live: false, messageName: 'Expert to Authority', goal: null,
  date: '2026-09-07', linkedToCommsDay: true, ...over,
});

const week = (over: Partial<CalendarWeek> = {}): CalendarWeek => ({
  weekStart: '2026-09-07', weekEnd: '2026-09-13', days: [],
  headers: [
    { brand: 'MV', label: 'Mindvalley', message: 'Expert to Authority', goal: 'To achieve 25k leads',
      related: [], messageIsPlaceholder: false, goalIsPlaceholder: false, datedCount: 72,
      volumePct: 100, spanNote: 'spans 7–21 Sep' },
    { brand: 'VL', label: 'Vishen', message: null, goal: null, related: [],
      messageIsPlaceholder: true, goalIsPlaceholder: true, datedCount: 4, volumePct: 6, spanNote: null },
  ],
  brandsWithoutGoal: ['VL'],
  allPosts: [],
  notDated: { total: 204, published: 66, unpublished: 138, sharePct: 46 },
  liveCampaign: true, datedThrough: '2026-09-30', datedAfterWeek: 3,
  asOf: new Date().toISOString(), warnings: [],
  ...over,
});

const BRANDS = [
  { brand: 'MV', label: 'Mindvalley', hasFigure: true },
  { brand: 'VL', label: 'Vishen', hasFigure: false },
];

console.log('\n1. The live week, as production holds it');
const live = blockersFor({ week: week({ allPosts: [
  ...Array.from({ length: 21 }, () => post({ live: true, linkedToCommsDay: true })),
  ...Array.from({ length: 51 }, () => post({ live: true, linkedToCommsDay: false })),
] }), brands: BRANDS, weekHref: '2026-09-07' });
ck('produces blockers', live.length > 0, String(live.length));
ck('Live Date leads, because it hides more of the week than anything else',
   live[0].id === 'live-date', live[0].id);
ck('quotes both numbers, not a vague "some"',
   live[0].what.includes('204') && live[0].what.includes('66'), live[0].what);
ck('every blocker names an owner', live.every(b => b.owner.trim().length > 0));
ck('every blocker explains what it STOPS, not just what it is',
   live.every(b => b.why.length > 40 && b.why !== b.what));

console.log('\n2. An unowned field says so rather than naming a volunteer');
ck('Live Date is owned by nobody, and the row says nobody',
   /nobody/i.test(live[0].owner), live[0].owner);
ck('but it still links to where the 204 can be fixed', live[0].href === '/studio/comms-calendar/not-dated');

console.log('\n3. The two Vishen gaps are not said twice');
const vlMsg = live.filter(b => b.id.startsWith('message-'));
const vlGoal = live.filter(b => b.id.startsWith('goal-'));
ck('Vishen has no message, and that is a blocker', vlMsg.length === 1 && vlMsg[0].id === 'message-VL');
ck('and no separate "no goal" row for the same lane — a lane with no message obviously has none',
   vlGoal.length === 0, vlGoal.map(b => b.id).join(','));

console.log('\n4. A lane WITH a message but no goal does get its own row');
const goalOnly = blockersFor({
  week: week({
    headers: [{ brand: 'MV', label: 'Mindvalley', message: 'Expert to Authority', goal: null,
      related: [], messageIsPlaceholder: false, goalIsPlaceholder: false, datedCount: 72,
      volumePct: 100, spanNote: null }],
    brandsWithoutGoal: ['MV'],
  }),
  brands: [{ brand: 'MV', label: 'Mindvalley', hasFigure: true }],
  weekHref: '2026-09-07',
});
ck('the goal gap is its own item', goalOnly.some(b => b.id === 'goal-MV'));
ck('and no message item, because there is a message', !goalOnly.some(b => b.id.startsWith('message-')));

console.log('\n5. The headline gap is a blocker — a pack with an empty centre is a report');
ck('Vishen has no figure and is named', live.some(b => b.id === 'figure-VL'));
ck('Mindvalley has one and is not', !live.some(b => b.id === 'figure-MV'));

console.log('\n6. Publish links and unlinked posts carry their real counts');
const unlinked = live.find(b => b.id === 'unlinked')!;
ck('51 of 72 unlinked, with the percentage', unlinked.what.includes('51 of 72') && unlinked.what.includes('71%'), unlinked.what);
const links = live.find(b => b.id === 'publish-link')!;
ck('72 published posts with no link recorded', links.what.startsWith('72 published'), links.what);
ck('and it is Glen who fills them', links.owner === 'Glen');

console.log('\n7. Perch coverage is NOT a blocker');
ck('nothing about caption matching', !live.some(b => /perch|caption|match/i.test(b.what + b.why)));

console.log('\n8. A clean week produces nothing rather than filler');
const clean = blockersFor({
  week: week({
    headers: [{ brand: 'MV', label: 'Mindvalley', message: 'Expert to Authority', goal: '25k leads',
      related: [], messageIsPlaceholder: false, goalIsPlaceholder: false, datedCount: 5,
      volumePct: 100, spanNote: null }],
    brandsWithoutGoal: [],
    notDated: { total: 0, published: 0, unpublished: 0, sharePct: 0 },
    allPosts: [post({ live: true, publishedUrl: 'https://instagram.com/p/x', linkedToCommsDay: true })],
  }),
  brands: [{ brand: 'MV', label: 'Mindvalley', hasFigure: true }],
  weekHref: '2026-09-07',
});
ck('no blockers at all', clean.length === 0, clean.map(b => b.id).join(','));

console.log(fails ? `\n${fails} FAILED` : '\nALL PASS');
process.exit(fails ? 1 : 0);
