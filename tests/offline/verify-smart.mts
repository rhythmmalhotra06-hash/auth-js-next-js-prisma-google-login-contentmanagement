import { parseTargetFromProse, resolveTarget, defaultSmartNumberKey, hasLiveCampaign, buildSmartNumber } from '@/lib/mow/smart-number';

let fails = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) { fails++; console.log(`  FAIL  ${name}: got ${JSON.stringify(got)} want ${JSON.stringify(want)}`); }
  else console.log(`  ok    ${name} = ${JSON.stringify(got)}`);
};

console.log('\n1. Prose parsing — the real sentences from the live base');
eq('35k leads',            parseTargetFromProse('To achieve 35k leads to expert to authority summit'), 35000);
eq('25k leads',            parseTargetFromProse('To achieve 25k leads to expert to authority summit'), 25000);
eq('50k views',            parseTargetFromProse("Launch Jim Kwik's podcast and scale to 50k views by next week"), 50000);
eq('uppercase K',          parseTargetFromProse('Get 12K signups'), 12000);
eq('comma thousands',      parseTargetFromProse('Target 35,000 leads'), 35000);
eq('dollar millions',      parseTargetFromProse('Hit $1.2M in revenue'), 1200000);

console.log('\n2. Prose parsing — must NOT invent a number');
eq('no number at all',     parseTargetFromProse('To test meditations $99 vs 7-day free trial and TAM Masterclass test old vs new video'), null);
eq('null prose',           parseTargetFromProse(null), null);
eq('empty prose',          parseTargetFromProse(''), null);
eq('bare year is not a target', parseTargetFromProse('Ship the 2026 plan'), null);
eq('bare small int ignored',    parseTargetFromProse('Do 7 posts'), null);

console.log('\n3. Target resolution priority');
eq('numeric wins',   resolveTarget({ numeric: 35000, prose: 'To achieve 40k leads' }), { value: 35000, provenance: 'numeric', prose: 'To achieve 40k leads' });
eq('falls back to prose, flagged inferred', resolveTarget({ numeric: null, prose: 'To achieve 35k leads to expert to authority summit' }), { value: 35000, provenance: 'inferred', prose: 'To achieve 35k leads to expert to authority summit' });
eq('no target, honest null', resolveTarget({ numeric: null, prose: 'To test meditations $99 vs 7-day free trial' }), { value: null, provenance: 'none', prose: 'To test meditations $99 vs 7-day free trial' });
eq('zero numeric is not a target', resolveTarget({ numeric: 0, prose: null }), { value: null, provenance: 'none', prose: null });

console.log('\n4. Default headline metric (S2)');
eq('campaign week → leads', defaultSmartNumberKey({ hasLiveCampaign: true, offerDefinition: 'revenue' }), 'leads');
eq('no campaign → offer definition', defaultSmartNumberKey({ hasLiveCampaign: false, offerDefinition: 'revenue' }), 'revenue');
eq('no campaign, no offer → leads', defaultSmartNumberKey({ hasLiveCampaign: false, offerDefinition: null }), 'leads');
eq('junk offer definition ignored', defaultSmartNumberKey({ hasLiveCampaign: false, offerDefinition: 'vibes' }), 'leads');

console.log('\n5. Live-campaign detection off the CommsDay mirror');
eq('a linked Official Cal day ⇒ live', hasLiveCampaign([{ officialCalIds: [] }, { officialCalIds: ['recK9N1ignQfnmD5v'] }]), true);
eq('no links ⇒ not live', hasLiveCampaign([{ officialCalIds: [] }, { officialCalIds: [] }]), false);

console.log('\n6. The headline is ONE object, and carries its provenance');
const sn = buildSmartNumber({ key: 'leads', value: 18240, target: resolveTarget({ numeric: null, prose: 'To achieve 35k leads to expert to authority summit' }), source: 'session:metabase', asOf: new Date('2026-09-09T12:00:00Z') });
eq('not an array', Array.isArray(sn), false);
eq('label', sn.label, 'Leads');
eq('target inferred + prose retained', [sn.target, sn.targetProvenance, !!sn.targetProse], [35000, 'inferred', true]);
eq('value source visible', sn.source, 'session:metabase');
eq('asOf stamped', sn.asOf, '2026-09-09T12:00:00.000Z');

console.log(`\n${fails === 0 ? 'ALL PASS' : fails + ' FAILURE(S)'}`);
process.exit(fails === 0 ? 0 : 1);
