import { formatFromTitle, buildBriefing } from '@/lib/mow/briefing';
import type { CalendarWeek } from '@/lib/comms-calendar/types';
import type { PackDay } from '@/lib/mow/week-pack';

let fails = 0;
const ck = (n: string, c: boolean, e = '') => { if (!c) { fails++; console.log(`  FAIL  ${n} ${e}`); } else console.log(`  ok    ${n}${e ? ' — ' + e : ''}`); };

console.log('\n1. Format parsing is STRICT — a loose parse invents categories');
ck('real convention parses', formatFromTitle('Pathway:: Manifesting - Podcast Snippet - Spirituality') === 'Podcast Snippet');
ck('Stage Talk', formatFromTitle('Pathway:: Longevity - Stage Talk - Emotions') === 'Stage Talk');
// The live variants "Text on B" and "Text on B Roll" are one format split by the hyphen in B-roll.
ck('B-roll variants collapse to one', formatFromTitle('Pathway:: X - Text on B Roll - y') === 'Text on B-roll'
   && formatFromTitle('Pathway:: X - Text on B-roll - y') === 'Text on B-roll');
ck('a non-conforming title yields NOTHING, not a junk format',
   formatFromTitle('Carousel ES - 5 Zen principles') === null, String(formatFromTitle('Carousel ES - 5 Zen principles')));
ck('and so does a bare title', formatFromTitle('Carousel') === null);

const post = (id: string, title: string, reach: number | null) => ({
  id, title, brand: 'MV' as const, channel: 'Instagram', status: null, source: null,
  publishedUrl: null, live: !!reach, messageName: null, goal: null,
  platforms: ['Instagram'], date: '2026-09-08',
  results: reach === null ? null : { reach, engagements: 10, multiAccount: false },
});

const week = {
  allPosts: [
    post('a', 'Pathway:: Manifesting - Stage Talk - one', 91700),
    post('b', 'Pathway:: Manifesting - Carousel - two', 400),
    post('c', 'Carousel ES - no convention', null),
  ],
} as unknown as CalendarWeek;

const day = (date: string, planned: number, delivered: number): PackDay => ({
  date, weekday: 'Friday', dayOfMonth: 4, isToday: false, isFuture: false,
  planned, delivered, state: null, platforms: [], vlTitles: [], mvSlots: 0,
});

console.log('\n2. The standout comes from real numbers, never a guess');
const b = buildBriefing(week, [day('2026-09-04', 3, 2)]);
ck('picks the highest reach', b.standout?.reach === 91700, String(b.standout?.reach));
ck('and names it', b.standout?.title.includes('Stage Talk') === true);

console.log('\n3. Format coverage is STATED, not implied');
ck('only conforming titles counted', b.formatCoverage.named === 2 && b.formatCoverage.total === 3,
   `${b.formatCoverage.named}/${b.formatCoverage.total}`);
ck('no junk format from the third title', !b.formats.some((f) => f.name.includes('Zen')));

console.log('\n4. A platform Perch never matched reads NULL, not zero');
const noResults = { allPosts: [post('x', 'Pathway:: A - Story - z', null)] } as unknown as CalendarWeek;
const b2 = buildBriefing(noResults, [day('2026-09-04', 1, 0)]);
ck('reach is null', b2.platforms[0]?.reach === null, String(b2.platforms[0]?.reach));
ck('engagements is null', b2.platforms[0]?.engagements === null);
ck('no standout is claimed', b2.standout === null);

console.log('\n5. A miss is phrased as what we can SEE, not as an accusation');
const miss = b2.facts.find((f) => f.tone === 'warn');
ck('a silent planned day is flagged', !!miss, miss?.headline ?? '(none)');
ck('it says "recorded", not "published nothing"', miss?.headline.includes('recorded') === true);
ck('and it tells the reader to confirm', miss?.detail.includes('confirming') === true);

console.log('\n6. A day that planned nothing is not a miss');
const quiet = buildBriefing(noResults, [day('2026-09-04', 0, 0)]);
ck('no warn fact', !quiet.facts.some((f) => f.tone === 'warn'));

console.log('\n7. The real format field wins over the title parse (AD2)');
// `💿 Social Format` is 91% populated base-wide and 70 of 72 for w/c 7 Sep; the title convention
// is 29%. The parse stays only as the fallback for posts the field does not cover.
const mixed = {
  allPosts: [
    { ...post('m1', 'no convention here at all', 100), format: '4. Reel < 1 min' },
    { ...post('m2', 'Pathway:: Manifesting - Stage Talk - x', null), format: null },
    { ...post('m3', 'also nothing parseable', null), format: '3a. Insta: Post/Carousel' },
  ],
} as unknown as CalendarWeek;
const b3 = buildBriefing(mixed, [day('2026-09-04', 1, 1)]);
ck('the field is used when present', b3.formats.some((f) => f.name === '4. Reel < 1 min'));
ck('the title parse still covers the rest', b3.formats.some((f) => f.name === 'Stage Talk'));
ck('coverage counts both sources', b3.formatCoverage.named === 3, `${b3.formatCoverage.named}/3`);

console.log('\n8. Owner and unlinked counts');
const owned = {
  allPosts: [
    { ...post('o1', 'a', 10), owner: 'Glen Jason Chittur', linkedToCommsDay: true },
    { ...post('o2', 'b', null), owner: 'Glen Jason Chittur', linkedToCommsDay: false },
    { ...post('o3', 'c', null), owner: 'Philine Unterberger', linkedToCommsDay: false },
  ],
} as unknown as CalendarWeek;
const b4 = buildBriefing(owned, [day('2026-09-04', 1, 1)]);
ck('owners tallied, busiest first', b4.owners[0]?.name === 'Glen Jason Chittur' && b4.owners[0]?.count === 2,
   JSON.stringify(b4.owners));
ck('unlinked counted — dated but unplanned', b4.unlinked === 2, String(b4.unlinked));

console.log(`\n${fails === 0 ? 'ALL PASS' : fails + ' FAILURE(S)'}`);
process.exit(fails === 0 ? 0 : 1);
