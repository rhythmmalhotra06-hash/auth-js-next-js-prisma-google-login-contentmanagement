// One message's week — lib/mow/message-week.ts — over a week assembled from live record shapes.
import { assembleWeek } from '@/lib/comms-calendar/data.airtable';
import { messageWeek, sameMessage } from '@/lib/mow/message-week';
import { utcDay } from '@/lib/mow/week';
import { VL_VIDEOS as V, COMMS_DAY as C, VL_MESSAGE_OF_WEEK as M } from '@/lib/airtable/field-map';
let fails = 0;
const ck = (n: string, c: boolean, e = '') => { if (!c) { fails++; console.log(`  FAIL  ${n} ${e}`); } else console.log(`  ok    ${n}${e ? ' — ' + e : ''}`); };

console.log('\n1. sameMessage — the jammed record and plain names');
ck('identical', sameMessage('Expert to Authority', 'Expert to Authority'));
ck('case and spacing tolerant', sameMessage('expert  to authority', 'Expert to Authority'));
ck('jammed MV half matches the split header', sameMessage('MV: Be Extraordinary VL: Podcast - Naveen Jain', 'Be Extraordinary'));
ck('jammed VL half matches too', sameMessage('MV: Be Extraordinary VL: Podcast - Naveen Jain', 'Podcast - Naveen Jain'));
ck('different messages do not', !sameMessage('Expert to Authority', 'Jim Kwik (Mention Expert to Authority)'));
ck('null never matches', !sameMessage(null, 'Expert to Authority'));

// ── A week: Expert to Authority Mon/Wed, Jim Kwik Tue, and a VL asset on the same message ────
const msgRows = [
  { id: 'recMsgEA', createdTime: '', fields: { [M.fields.name]: 'Expert to Authority', [M.fields.goal]: '35k leads', [M.fields.brand]: { id: 's', name: 'VL' } } },
];
const vlRows = [
  { id: 'recVL1', createdTime: '', fields: {
    [V.fields.name]: 'LIVE: Nobody knows I exist', [V.fields.liveDate]: '2026-09-09', [V.fields.status]: '7. Published',
    [V.fields.publishedLink]: 'https://lnkd.in/p/abc', [V.links.messageOfWeek]: ['recMsgEA'] } },
  { id: 'recVL2', createdTime: '', fields: {
    [V.fields.name]: 'Unrelated podcast', [V.fields.liveDate]: '2026-09-08', [V.fields.status]: '1. Idea' } },
];
const mvRows = [
  { id: 'recMon', createdTime: '', fields: { [C.fields.date]: '2026-09-07', [C.fields.messageOfWeek]: 'Expert to Authority',
    [C.links.emails]: ['e1'], [C.links.socialAllAssets]: ['a', 'b', 'zzz'] } },
  { id: 'recTue', createdTime: '', fields: { [C.fields.date]: '2026-09-08', [C.fields.messageOfWeek]: 'Jim Kwik (Mention Expert to Authority)',
    [C.links.socialAllAssets]: ['c'] } },
  { id: 'recWed', createdTime: '', fields: { [C.fields.date]: '2026-09-09', [C.fields.messageOfWeek]: 'Expert to Authority',
    [C.fields.noOfEmails]: 1, [C.links.socialAllAssets]: ['a'] } },
];
type P = import('@/lib/comms-calendar/social-posts').SocialPost;
const post = (id: string, title: string, results: P['results'], publishedUrl: string | null = null): P => ({
  id, title, channels: ['IG: MV'], platforms: ['Instagram'], status: null, liveDate: null, imageUrl: null,
  publishedUrl, editor: null, ticketId: null, ticketStatus: null, assetLink: null, results,
});
const posts = new Map<string, P>([
  ['a', post('a', 'Regan Hillyer — the manifesting shift', { reach: 91700, engagements: 34600, posts: 1, multiAccount: false }, 'https://instagram.com/p/x')],
  ['b', post('b', 'Paul McKenna — BLISS reel', null)],
  ['c', post('c', 'Jim Kwik teaser', { reach: 500, engagements: 20, posts: 1, multiAccount: false })],
]);
const week = assembleWeek({ anchor: utcDay('2026-09-09'), vlRows, msgRows, mvRows, posts });

console.log('\n2. Expert to Authority — everything under it, by day');
const ea = messageWeek(week, 'Expert to Authority');
const day = (d: string) => ea.days.find((x) => x.date === d)!;
ck('seven days always', ea.days.length === 7);
ck('Mon: email first, then two resolved posts', day('2026-09-07').items.map((i) => i.kind).join(',') === 'email,post,post', day('2026-09-07').items.map((i) => i.kind).join(','));
ck('Mon: the unresolved social id is not invented', !day('2026-09-07').items.some((i) => i.id === 'zzz'));
ck('Tue: nothing — Jim Kwik is its own message', day('2026-09-08').items.length === 0);
ck('Wed: count-only email, post a again, and the VL asset', day('2026-09-09').items.map((i) => i.kind).join(',') === 'email,post,vl', day('2026-09-09').items.map((i) => i.kind).join(','));
ck('the VL asset carries its channel from the link', day('2026-09-09').items.find((i) => i.kind === 'vl')!.channel === 'LinkedIn');
ck('counts: 3 posts, 2 emails, 1 VL', JSON.stringify([ea.counts.posts, ea.counts.emails, ea.counts.vl]) === '[3,2,1]', JSON.stringify(ea.counts));
ck('matched counts posts with reach only', ea.counts.matched === 2, String(ea.counts.matched));
ck('both brands present', ea.brands.sort().join(',') === 'MV,VL');
ck('results ride along, null stays null', day('2026-09-07').items.find((i) => i.id === 'a')!.results?.reach === 91700 && day('2026-09-07').items.find((i) => i.id === 'b')!.results === null);
ck('the live link rides along', day('2026-09-07').items.find((i) => i.id === 'a')!.publishedUrl === 'https://instagram.com/p/x');

console.log('\n3. Jim Kwik — the beat inside the campaign');
const jk = messageWeek(week, 'Jim Kwik (Mention Expert to Authority)');
ck('only Tuesday', jk.days.filter((d) => d.items.length).map((d) => d.date).join() === '2026-09-08');
ck('one post', jk.counts.posts === 1 && jk.counts.emails === 0 && jk.counts.vl === 0);

console.log('\n4. A name nothing carries is quiet, not an error');
const none = messageWeek(week, 'Some Other Message');
ck('zero items', none.counts.posts + none.counts.emails + none.counts.vl === 0);
ck('still seven days', none.days.length === 7);

console.log('\n5. Pack days annotate planned / delivered when given');
const withPack = messageWeek(week, 'Expert to Authority', [
  { date: '2026-09-07', weekday: 'Monday', dayOfMonth: 7, isToday: false, isFuture: false, planned: 7, delivered: 19, state: 'shipped', platforms: [], vlTitles: [], mvSlots: 3 },
]);
ck('Mon carries the pack facts', withPack.days[0].planned === 7 && withPack.days[0].delivered === 19);
ck('other days are null, not zero', withPack.days[1].planned === null && withPack.days[1].delivered === null);

console.log(`\n${fails === 0 ? 'ALL PASS' : fails + ' FAILURE(S)'}`);
process.exit(fails === 0 ? 0 : 1);
