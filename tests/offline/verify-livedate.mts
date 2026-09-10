// Exercises the push MAP and the field mapping, without writing to Airtable.
import { vishenVideoToAirtableFields } from '@/lib/airtable/vishen-video-push-map';
import { VISHEN_VIDEOS } from '@/lib/airtable/field-map';
let fails = 0;
const ck = (n: string, c: boolean, e = '') => { if (!c) { fails++; console.log(`  FAIL  ${n} ${e}`); } else console.log(`  ok    ${n}${e ? ' — ' + e : ''}`); };

console.log('\n1. Live Date is written, and lands on the right field');
const withDate = vishenVideoToAirtableFields({ approval: null, rating: null, views24h: null, liveDate: '2026-09-22' });
ck('maps to the Live Date field id', withDate[VISHEN_VIDEOS.fields.liveDate] === '2026-09-22',
   JSON.stringify(withDate));
ck('and writes NOTHING else', Object.keys(withDate).length === 1, Object.keys(withDate).join(','));

console.log('\n2. A null never clears a team-maintained value');
const empty = vishenVideoToAirtableFields({ approval: null, rating: null, views24h: null, liveDate: null });
ck('omits the field entirely', !(VISHEN_VIDEOS.fields.liveDate in empty));
ck('payload is empty', Object.keys(empty).length === 0);

console.log('\n3. It coexists with the other app-managed fields');
const all = vishenVideoToAirtableFields({ approval: 'Approved', rating: 4, views24h: '12k', liveDate: '2026-09-22' });
ck('all four present', Object.keys(all).length === 4, Object.keys(all).length + ' fields');

console.log('\n4. The app never writes a status on this table');
const statusId = (VISHEN_VIDEOS.fields as Record<string, string>).status;
ck('status field id is absent from every payload', !(statusId in all) && !(statusId in withDate));

console.log(`\n${fails === 0 ? 'ALL PASS' : fails + ' FAILURE(S)'}`);
process.exit(fails === 0 ? 0 : 1);
