// The Braze email loop's two pure halves: matching a planned email to its campaigns, and
// summing a data series. Shapes are verbatim from the live Airtable records for w/c 7 Sep 2026
// and from Braze's documented data_series response.
import { parseSubject, normaliseAudience, toPlannedEmail } from '@/lib/comms-calendar/emails';
import { normSubject, scoreCandidate, matchEmail, type MatchCandidate } from '@/lib/braze/match';
import { sumDataSeries, audienceOf, subjectOf, isEmailCampaign } from '@/lib/braze/pull';
import { EMAILS } from '@/lib/airtable/field-map';
let fails = 0;
const ck = (n: string, c: boolean, e = '') => { if (!c) { fails++; console.log(`  FAIL  ${n} ${e}`); } else console.log(`  ok    ${n}${e ? ' — ' + e : ''}`); };

// ── 1. The subject has to be parsed out of the copy — there is no subject field ───────────────
console.log('\n1. Subject parsing, all three spellings the team uses');
// Verbatim first lines from rec6W5R8kqSqa3le4, recfNjP5miP9LX76X and recBH9JJo9vOiCB4l.
ck('label inside the bold (Sub:)',
  parseSubject('**Sub: OPEN: To unlock a 22-year old secret 🔐**\n\n**Pre: This will not just help you…**').subject
    === 'OPEN: To unlock a 22-year old secret 🔐');
ck('label bold, subject plain (Subject:)',
  parseSubject('**Subject:** A doctor in Stockholm told me what I’m truly best at\n**Preheader:** His answer changed…').subject
    === 'A doctor in Stockholm told me what I’m truly best at');
ck('whole line bold',
  parseSubject('**Subject: Your goal is failing on one of three things**\n**Pre-header: Desire. Belief.**').subject
    === 'Your goal is failing on one of three things');
ck('preheader too', parseSubject('**Subject:** X\n**Preheader:** His answer changed the next chapter').preheader
    === 'His answer changed the next chapter');
ck('no label → null, never a guess', parseSubject('Hey [Firstname],\n\nYou can be exceptional…').subject === null);
ck('empty copy → null', parseSubject(null).subject === null);
ck('"Subject to change" in body copy is not picked up mid-email',
  parseSubject(['**Sub: The real one**', '', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'Subject: not this'].join('\n')).subject === 'The real one');

console.log('\n1b. Audience option names lose their list-number prefix');
ck('"1,2: Daily" → Daily', normaliseAudience('1,2: Daily') === 'Daily');
ck('"1,2,3: Vishen\'s List" → Vishen\'s List', normaliseAudience("1,2,3: Vishen's List") === "Vishen's List");
ck('"3: Members" → Members', normaliseAudience('3: Members') === 'Members');
ck('trailing space survives trimming', normaliseAudience('1,2: Highlights ') === 'Highlights');
ck('an unprefixed name is untouched', normaliseAudience('Mastery') === 'Mastery');

console.log('\n1c. A whole record maps');
const rec = { id: 'rec6W5R8kqSqa3le4', createdTime: '', fields: {
  [EMAILS.fields.title]: 'Email 1 - Summit Announcement (What is this)',
  [EMAILS.fields.liveDate]: '2026-09-07',
  [EMAILS.fields.email]: '**Sub: OPEN: To unlock a 22-year old secret 🔐**\n\nHey [Firstname],',
  [EMAILS.fields.audience]: [{ id: 's1', name: '1,2: Daily' }, { id: 's2', name: '3: Members' }],
  [EMAILS.fields.emailType]: { id: 's', name: 'Invite Sequence' },
  [EMAILS.fields.stage]: { id: 's', name: '5. Sent' },
  [EMAILS.fields.brazeUrl]: 'Daily \nhttps://dashboard-01.braze.com/engagement/campaigns/6aa151c3a88e6a008ae83dcc/583e43d55c5a686c9fbb901c?locale=en\n\nMembers\nhttps://dashboard-01.braze.com/engagement/campaigns/6aa15d57bc1692008811f999/583e43d55c5a686c9fbb901c?locale=en',
} };
const planned = toPlannedEmail(rec);
ck('title, subject, date', planned.title.startsWith('Email 1') && planned.subject?.startsWith('OPEN:') === true && planned.liveDate === '2026-09-07');
ck('audiences normalised', planned.audiences.join(',') === 'Daily,Members', planned.audiences.join(','));
ck('both dashboard links kept, labels dropped', planned.brazeUrls.length === 2 && planned.brazeUrls.every((u) => u.startsWith('https://')));

// ── 2. Subject normalisation: Liquid and entities differ between the two systems ──────────────
console.log('\n2. Subject normalisation strips what differs between Airtable and Braze');
ck('Liquid personalisation removed',
  normSubject("It's decision time, {{${first_name} | default: 'Mindvalley Subscriber'}}, today")
    === normSubject("It's decision time, , today"));
ck('&#13; removed', normSubject('Final 24 hours&#13;') === normSubject('Final 24 hours'));
ck('emoji and case ignored', normSubject('🔔 Last Call: 24h Left') === normSubject('last call 24h left'));
ck('nothing in common still differs', normSubject('one thing') !== normSubject('another thing'));

// ── 3. The match ─────────────────────────────────────────────────────────────────────────────
console.log('\n3. Matching — the date is a gate, the subject is the evidence');
const target = {
  id: 'rec6W5R8kqSqa3le4',
  title: 'Email 1 - Summit Announcement (What is this)',
  subject: 'OPEN: To unlock a 22-year old secret 🔐',
  liveDate: '2026-09-07',
  audiences: ['Daily', 'Members', 'Coach'],
};
const cand = (over: Partial<MatchCandidate>): MatchCandidate => ({
  brazeCampaignId: 'c1',
  campaignName: 'EAS Sep 2026 — Email 1 Summit Announcement — Daily',
  subject: 'OPEN: To unlock a 22-year old secret 🔐',
  audience: 'Daily',
  firstSentAt: '2026-09-07T02:00:00Z',
  ...over,
});

ck('exact subject on the day → 1.0', scoreCandidate(target, cand({}))?.score === 1);
ck('the same send a day late still counts (MYT vs UTC)',
  scoreCandidate(target, cand({ firstSentAt: '2026-09-07T23:30:00Z' }))?.score === 1);
ck('a send three days later does NOT',
  scoreCandidate(target, cand({ firstSentAt: '2026-09-10T02:00:00Z' })) === null);
ck('a subject that diverges after 45 chars still matches on the prefix',
  scoreCandidate(target, cand({ subject: 'OPEN: To unlock a 22-year old secret 🔐 — last chance' }))?.reason === 'subject-prefix');
// The sequence case that made this rule necessary: Email 1 and Email 3 share nearly every word
// of their campaign name, so a name fallback would attach one's numbers to the other.
ck('a different subject on the same day does NOT match, even when the name overlaps',
  scoreCandidate(target, cand({ subject: 'Why great experts stay invisible' })) === null);
ck('no subject either side falls back to the name, at 0.6',
  scoreCandidate(target, cand({ subject: null }))?.score === 0.6);
ck('…and names it, so the UI can hedge',
  scoreCandidate(target, cand({ subject: null }))?.reason === 'name-overlap');
ck('an unrelated name with no subject is not a match',
  scoreCandidate(target, cand({ subject: null, campaignName: 'Meditations weekly drop' })) === null);
ck('the wrong audience is rejected even with an exact subject',
  scoreCandidate(target, cand({ audience: 'Sublist' })) === null);
ck('an untagged campaign is NOT rejected — audience is a gate only when both sides know it',
  scoreCandidate(target, cand({ audience: null }))?.score === 1);

console.log('\n3b. One email is many campaigns — all of them come back');
const fanOut = ['Daily', 'Members', 'Coach'].map((a, i) =>
  cand({ brazeCampaignId: `c${i}`, audience: a, campaignName: `EAS Email 1 — ${a}` }));
const all = matchEmail(target, [...fanOut, cand({ brazeCampaignId: 'other', subject: 'Something else', campaignName: 'Other' })]);
ck('three lists matched, the stranger rejected', all.length === 3, String(all.length));
ck('best score first', all[0].score === 1);

// ── 4. Summing a data series ─────────────────────────────────────────────────────────────────
console.log('\n4. Summing daily buckets');
const series = [
  { time: '2026-09-07', messages: { m1: [
    { variation_name: 'Variant A', sent: 100_000, delivered: 99_000, unique_opens: 30_000, machine_open: 9_000, unique_clicks: 600, unsubscribes: 20, revenue: 0 },
    { variation_name: 'control', sent: 0, delivered: 0, unique_opens: 0 },
  ] } },
  { time: '2026-09-08', messages: { m1: [
    { variation_name: 'Variant A', unique_opens: 4_000, unique_clicks: 90, unsubscribes: 3 },
  ] } },
  { time: '2026-09-10', messages: { m1: [
    { variation_name: 'Variant A', unique_opens: 500, unique_clicks: 10 },
  ] } },
];
const sentAt = new Date('2026-09-07T02:00:00Z');
const w2 = sumDataSeries(series, { firstSentAt: sentAt, windowDays: 2 });
ck('window 2 = the send day plus the next', w2.uniqueOpens === 34_000, String(w2.uniqueOpens));
ck('…and excludes day four', w2.uniqueClicks === 690, String(w2.uniqueClicks));
const toDate = sumDataSeries(series, { firstSentAt: sentAt, windowDays: null });
ck('to-date takes every bucket', toDate.uniqueOpens === 34_500, String(toDate.uniqueOpens));
ck('the control variant is never counted', toDate.sent === 100_000, String(toDate.sent));
ck('machine opens are kept as a subset, not netted off', toDate.machineOpens === 9_000 && toDate.uniqueOpens === 34_500);
ck('a metric Braze omitted stays null, never 0', sumDataSeries([{ time: '2026-09-07', messages: { m: [{ sent: 5 }] } }]).revenue === null);
ck('an empty series is all null', sumDataSeries([]).sent === null);

// ── 5. Classification ────────────────────────────────────────────────────────────────────────
console.log('\n5. Which list a campaign went to');
ck('from a tag', audienceOf('Anything', ['Email/List/Daily']) === 'Daily');
ck("Vishen's newsletter tag", audienceOf('x', ["Vishen's Newsletter"]) === "Vishen's List");
ck('from the name when untagged', audienceOf('EAS Sep 2026 — Email 1 — Members', []) === 'Members');
ck('unknown → null, and the caller reports it rather than guessing', audienceOf('EAS Sep 2026 — Email 1', []) === null);
ck('tags win over the name', audienceOf('… Members', ['Email/List/Daily']) === 'Daily');

console.log('\n5b. Email campaigns only');
ck('by channel list', isEmailCampaign(['email'], {}));
ck('by message channel', isEmailCampaign([], { m: { channel: 'email' } }));
ck('push-only is not ours', !isEmailCampaign(['push'], { m: { channel: 'push' } }));
ck('subject comes from the first email variant that has one',
  subjectOf({ a: { channel: 'push' }, b: { channel: 'email', subject: 'The real subject' } }) === 'The real subject');

console.log(`\n${fails === 0 ? 'ALL PASS' : fails + ' FAILURE(S)'}`);
process.exit(fails === 0 ? 0 : 1);
