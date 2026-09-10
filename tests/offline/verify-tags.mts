import { tagLabels } from '@/lib/hootsuite/perch';
let fails = 0;
const eq = (n: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) { fails++; console.log(`  FAIL  ${n}: got ${JSON.stringify(got)} want ${JSON.stringify(want)}`); }
  else console.log(`  ok    ${n} = ${JSON.stringify(got)}`);
};

console.log('\n1. The real production payload shape');
eq('two tags off details.tags', tagLabels({
  unique_id: 'p1',
  details: { tags: [
    { id: '1163523', label: 'Expert to Authority Summit 2026', group_name: 'Ungrouped' },
    { id: '9', label: 'Vishen', group_name: 'Ungrouped' },
  ], source: { name: 'mindvalley' } },
}), ['Expert to Authority Summit 2026', 'Vishen']);

console.log('\n2. Absent / empty — must be [] not null');
eq('empty tags array', tagLabels({ details: { tags: [] } }), []);
eq('no tags key',      tagLabels({ details: {} }), []);
eq('null entry',       tagLabels(null), []);
eq('primitive',        tagLabels('nope'), []);

console.log('\n3. Dirty values');
eq('trims and dedupes', tagLabels({ details: { tags: [
  { label: '  Padded Tag  ' }, { label: '' }, { label: 'Padded Tag' }, { label: null },
] } }), ['Padded Tag']);
eq('bare string tags', tagLabels({ details: { tags: ['Alpha', '  ', 'Beta'] } }), ['Alpha', 'Beta']);
eq('name instead of label', tagLabels({ details: { tags: [{ name: 'Ken Honda' }] } }), ['Ken Honda']);

console.log('\n4. Shape-independence (why it searches rather than reads a fixed path)');
eq('nested deeper', tagLabels({ a: { b: { details: { tags: [{ label: 'Deep' }] } } } }), ['Deep']);
eq('top-level tags',  tagLabels({ tags: [{ label: 'Top' }] }), ['Top']);
eq('array of entries', tagLabels([{ details: { tags: [{ label: 'X' }] } }, { details: { tags: [{ label: 'Y' }] } }]), ['X', 'Y']);

console.log('\n5. Does not run away on hostile input');
const deep: Record<string, unknown> = {}; let cur = deep;
for (let i = 0; i < 40; i++) { cur.next = {}; cur = cur.next as Record<string, unknown>; }
cur.details = { tags: [{ label: 'TooDeep' }] };
eq('depth-capped, no crash', tagLabels(deep), []);

console.log(`\n${fails === 0 ? 'ALL PASS' : fails + ' FAILURE(S)'}`);
process.exit(fails === 0 ? 0 : 1);
