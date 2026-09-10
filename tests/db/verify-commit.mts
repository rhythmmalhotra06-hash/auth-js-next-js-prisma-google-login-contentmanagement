import { ensureWeek, commitWeek, reopenWeek, stageLearning, getWeekState, setWeekSummary } from '@/lib/mow/week-state';
import { utcDay } from '@/lib/mow/week';
import { prisma } from '@/lib/prisma';

let fails = 0;
const ck = (n: string, c: boolean, e = '') => { if (!c) { fails++; console.log(`  FAIL  ${n} ${e}`); } else console.log(`  ok    ${n}${e ? ' — ' + e : ''}`); };
const W = utcDay('2026-09-10');

console.log('\n1. ensureWeek is idempotent and creates the row the ingest route needs');
const a = await ensureWeek(W, 'MV', { message: 'Expert to Authority', goal: 'To achieve 25k leads' });
const b = await ensureWeek(W, 'MV', { message: 'Expert to Authority', goal: 'To achieve 25k leads' });
ck('same row on re-run', a.id === b.id);
ck('not committed initially', !a.committed);
const vl = await ensureWeek(W, 'VL', { message: null, goal: null });
ck('a brand with no message still gets a row', !!vl.id);
ck('two brand-weeks exist', (await getWeekState(W, ['MV','VL'])).length === 2);

console.log('\n2. The committer allowlist is enforced in the WRITE, not just the UI (S4)');
ck('an editor cannot commit', (await commitWeek(a.id, 'someeditor@mindvalley.com')).ok === false);
ck('nobody signed in cannot commit', (await commitWeek(a.id, null)).ok === false);
ck('an editor cannot stage a learning either',
   (await stageLearning({ weekId: a.id, text: 'x', email: 'someeditor@mindvalley.com' })).ok === false);
ck('Ramya can', (await stageLearning({ weekId: a.id, text: 'Tuesday carried the week.', leverOwner: 'retention → editor', email: 'ramya@mindvalley.com' })).ok === true);

console.log('\n3. AI proposals are marked, and editing one drops the marker (AA2)');
await stageLearning({ weekId: a.id, text: 'Reels outperformed carousels 3:1.', proposed: true, email: 'glen@mindvalley.com' });
let st = (await getWeekState(W, ['MV']))[0];
const prop = st.learnings.find((l) => l.proposed);
ck('the proposal is flagged', !!prop);
await stageLearning({ weekId: a.id, learningId: prop!.id, text: 'Reels beat carousels — worth a test.', email: 'glen@mindvalley.com' });
st = (await getWeekState(W, ['MV']))[0];
ck('editing clears the proposed marker', st.learnings.find((l) => l.id === prop!.id)!.proposed === false);

console.log('\n4. Committing snapshots, so a later ingest cannot rewrite the record (AA4)');
await prisma.mowWeek.update({ where: { id: a.id }, data: { smartNumberStaged: { key: 'leads', value: 883 } } });
await setWeekSummary(a.id, 'Leads held up; Friday slipped.', 'ramya@mindvalley.com');
ck('Ramya commits', (await commitWeek(a.id, 'ramya@mindvalley.com')).ok === true);
st = (await getWeekState(W, ['MV']))[0];
ck('committedBy recorded', st.committedBy === 'ramya@mindvalley.com', String(st.committedBy));
ck('number snapshotted into committed', (st.smartNumberCommitted as { value: number } | null)?.value === 883);
ck('summary snapshotted', st.weekSummaryCommitted === 'Leads held up; Friday slipped.');
ck('learnings committed with the week', st.learnings.every((l) => !!l.committedAt));
ck('learning text copied across', st.learnings.every((l) => !!l.textCommitted));

// The whole point of a snapshot: the staged value moving must not move the committed one.
await prisma.mowWeek.update({ where: { id: a.id }, data: { smartNumberStaged: { key: 'leads', value: 99999 } } });
st = (await getWeekState(W, ['MV']))[0];
ck('a later ingest does NOT alter the committed figure',
   (st.smartNumberCommitted as { value: number }).value === 883,
   `committed=${(st.smartNumberCommitted as { value: number }).value} staged=${(st.smartNumberStaged as { value: number }).value}`);

console.log('\n5. A committed week is closed to edits, and reopening keeps the record');
ck('double commit refused', (await commitWeek(a.id, 'glen@mindvalley.com')).ok === false);
ck('cannot stage onto a committed week', (await stageLearning({ weekId: a.id, text: 'late', email: 'glen@mindvalley.com' })).ok === false);
ck('cannot edit the summary either', (await setWeekSummary(a.id, 'late', 'glen@mindvalley.com')).ok === false);
ck('reopen works', (await reopenWeek(a.id, 'gareth@mindvalley.com')).ok === true);
st = (await getWeekState(W, ['MV']))[0];
ck('reopening KEEPS the committed snapshot', (st.smartNumberCommitted as { value: number }).value === 883);
ck('and clears the committer', st.committedBy === null);

console.log('\n6. ensureWeek never overwrites a committed week');
await commitWeek(a.id, 'glen@mindvalley.com');
await ensureWeek(W, 'MV', { message: 'SOMETHING ELSE ENTIRELY', goal: 'changed upstream' });
st = (await getWeekState(W, ['MV']))[0];
ck('a committed week keeps what it said at the time', st.message === 'Expert to Authority', String(st.message));

console.log(`\n${fails === 0 ? 'ALL PASS' : fails + ' FAILURE(S)'}`);
await prisma.$disconnect();
process.exit(fails === 0 ? 0 : 1);
