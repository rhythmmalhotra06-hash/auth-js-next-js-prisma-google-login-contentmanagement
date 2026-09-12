import { compareAsset, type PlatformBenchmark } from '@/lib/comms-calendar/benchmark';

let fails = 0;
const ck = (n: string, c: boolean, e = '') => {
  if (!c) { fails++; console.log(`  FAIL  ${n} ${e}`); } else console.log(`  ok    ${n}${e ? ' — ' + e : ''}`);
};

/**
 * The live Instagram distribution, measured against production on 12 Sep:
 * 249 captured posts, median 2,225 views, top 331,348, median reach 2,113.
 * Approximated here as a spread with the same median and top, because the test must not need a
 * database — but the SHAPE is real, and that is what every assertion below turns on.
 */
const ig: PlatformBenchmark = {
  platform: 'Instagram',
  posts: 249,
  views: [],
  reach: [],
  engRatePct: [],
  since: '2026-08-27',
};
for (let i = 0; i < 249; i++) {
  ig.views.push(i < 124 ? 200 + i * 16 : i === 248 ? 331348 : 2225 + (i - 124) * 400);
  ig.reach.push(i < 124 ? 180 + i * 15 : 2113 + (i - 124) * 380);
  ig.engRatePct.push(1 + i * 0.03);
}
ig.views.sort((a, b) => a - b);
ig.reach.sort((a, b) => a - b);

/** Facebook, exactly as production holds it: 121 posts and NOT ONE view or reach figure (Y7). */
const fb: PlatformBenchmark = {
  platform: 'Facebook', posts: 121, views: [], reach: [], engRatePct: [], since: '2026-08-27',
};

const BENCH = new Map([['Instagram', ig], ['Facebook', fb]]);

console.log('\n1. A strong post is placed, not just printed');
const top = compareAsset(
  { views: 331348, reach: 200000, engagements: 9000, posts: 1 }, ['Instagram'], BENCH);
ck('a comparison is produced', !!top);
ck('names the platform and its denominator', top!.platform === 'Instagram' && top!.posts === 249);
ck('the top post ranks 1', top!.lines.find(l => l.metric === 'views')!.rank === 1);
ck('quotes the median it was ranked against',
   top!.lines.find(l => l.metric === 'views')!.median === '2,225',
   top!.lines.find(l => l.metric === 'views')!.median);
ck('carries a multiple for a count', (top!.lines.find(l => l.metric === 'views')!.multiple ?? 0) > 100);

console.log('\n2. A median post says so rather than flattering itself');
const mid = compareAsset({ views: 2225, reach: 2113, engagements: 100, posts: 1 }, ['Instagram'], BENCH);
const midViews = mid!.lines.find(l => l.metric === 'views')!;
ck('ranks around the middle of 249', midViews.rank > 100 && midViews.rank < 150, String(midViews.rank));
ck('multiple is ~1×', Math.abs((midViews.multiple ?? 0) - 1) < 0.05, String(midViews.multiple));

console.log('\n3. A rate is never given a multiple');
const rate = mid!.lines.find(l => l.metric === 'engagement rate');
ck('engagement rate is compared', !!rate);
ck('but carries no multiple — "1.4x the median rate" is not a sentence anyone reads correctly',
   rate!.multiple === null);
ck('formatted as a percentage', /%$/.test(rate!.value), rate!.value);

console.log('\n4. Multi-account totals are ranked PER POST, never as a sum');
// recNzG6qKNeKwFDiR: 22 Perch posts behind one Airtable row, 1,361,619 views between them.
// Ranking the sum against single posts would flatter it twenty-twofold.
const many = compareAsset(
  { views: 1361619, reach: 658808, engagements: 24173, posts: 22 }, ['Instagram'], BENCH);
ck('flagged as per-post', many!.perPost);
const manyViews = many!.lines.find(l => l.metric === 'views')!;
ck('the value shown is the per-post average, not the total',
   manyViews.value === '61,892', manyViews.value);
ck('so it does not claim the top slot outright', manyViews.rank > 1, String(manyViews.rank));

console.log('\n5. Facebook gets no comparison, because Facebook reports nothing to compare');
ck('no lines invented from an empty distribution',
   compareAsset({ views: null, reach: null, engagements: 40, posts: 1 }, ['Facebook'], BENCH) === null);

console.log('\n6. A post on two platforms is compared against ONE, the better-covered');
const both = compareAsset(
  { views: 5000, reach: 4000, engagements: 200, posts: 1 }, ['Facebook', 'Instagram'], BENCH);
ck('picks Instagram (249) over Facebook (121)', both!.platform === 'Instagram');
ck('and reports a single denominator, never two ranks', both!.posts === 249);

console.log('\n7. Nothing honest to say returns null rather than an empty shell');
ck('unmatched post', compareAsset({ views: null, reach: null, engagements: null, posts: 1 }, ['Instagram'], BENCH) === null);
ck('unknown platform', compareAsset({ views: 900, reach: 800, engagements: 40, posts: 1 }, ['LinkedIn'], BENCH) === null);
const thin = new Map([['TikTok', { platform: 'TikTok', posts: 4, views: [100, 200, 300, 400], reach: [90, 180, 270, 360], engRatePct: [1, 2, 3, 4], since: '2026-08-27' }]]);
ck('a platform with 4 captured posts has no median worth quoting',
   compareAsset({ views: 400, reach: 360, engagements: 20, posts: 1 }, ['TikTok'], thin) === null);

console.log(fails ? `\n${fails} FAILED` : '\nALL PASS');
process.exit(fails ? 1 : 0);
