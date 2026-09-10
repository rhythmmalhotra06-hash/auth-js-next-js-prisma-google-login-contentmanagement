import { POST as ingest } from '@/app/api/mow/metrics/ingest/route';
import { POST as genPack } from '@/app/api/mow/pack/generate/route';
import { prisma } from '@/lib/prisma';

let fails = 0;
const check = (n: string, c: boolean, e = '') => { if (!c) { fails++; console.log(`  FAIL  ${n} ${e}`); } else console.log(`  ok    ${n}${e ? ' — ' + e : ''}`); };
const SECRET = process.env.SYNC_SECRET!;

const post = (url: string, body?: unknown, secret: string | null = SECRET) =>
  new Request(url, {
    method: 'POST',
    headers: { ...(secret ? { authorization: `Bearer ${secret}` } : {}), 'content-type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

async function main() {
console.log('\n1. The guard actually guards (middleware skips /api)');
check('no auth header → 401', (await ingest(post('http://x/api/mow/metrics/ingest', {}, null))).status === 401);
check('wrong secret → 401', (await ingest(post('http://x/api/mow/metrics/ingest', {}, 'nope-wrong-length'))).status === 401);
check('pack generate also guarded', (await genPack(post('http://x/api/mow/pack/generate', undefined, null))).status === 401);

console.log('\n2. Input validation');
let r = await ingest(post('http://x/api/mow/metrics/ingest', { weekOf: 'not-a-date' }));
check('bad weekOf → 400', r.status === 400, (await r.json()).error);
r = await ingest(post('http://x/api/mow/metrics/ingest', { weekOf: '2026-09-07', figures: { profit: 5 } }));
check('unknown figure key → 400', r.status === 400, (await r.json()).error);
r = await ingest(post('http://x/api/mow/metrics/ingest', { weekOf: '2026-09-07', figures: { leads: 'lots' } }));
check('non-numeric figure → 400', r.status === 400, (await r.json()).error);
r = await ingest(post('http://x/api/mow/metrics/ingest', { weekOf: '2026-09-07', figures: { leads: Infinity } }));
check('Infinity rejected', r.status === 400);
r = await ingest(post('http://x/api/mow/metrics/ingest', { weekOf: '1999-01-04', figures: { leads: 1 } }));
check('no pack for that week → 404', r.status === 404, (await r.json()).error);

console.log('\n3. A real ingest');
// VL is uncommitted; MV was committed by the pack test.
r = await ingest(post('http://x/api/mow/metrics/ingest', {
  weekOf: '2026-09-09',
  source: 'session:metabase',
  figures: { leads: 18240, revenue: 42011.5 },
}));
const body = await r.json();
check('200', r.status === 200, JSON.stringify(body));
check('VL updated', body.updated.includes('VL'), JSON.stringify(body.updated));
check('MV skipped because committed', body.skippedCommitted.includes('MV'), JSON.stringify(body.skippedCommitted));

const vl = await prisma.mowWeek.findFirstOrThrow({ where: { brand: 'VL' } });
const sn = vl.smartNumberStaged as { key: string; value: number; target: number; targetProvenance: string; source: string; asOf: string };
check('headline is leads', sn.key === 'leads');
check('value ingested', sn.value === 18240, String(sn.value));
check('target survives as inferred 35000 (F8)', sn.target === 35000 && sn.targetProvenance === 'inferred', `${sn.target}/${sn.targetProvenance}`);
check('provenance stamped for the §2 swap', sn.source === 'session:metabase', sn.source);
check('asOf stamped (revenue drifts upward)', typeof sn.asOf === 'string' && sn.asOf.length > 10);
check('headline is ONE object, not an array (S1)', !Array.isArray(vl.smartNumberStaged));
const drivers = vl.drivers as { key: string; value: number }[];
check('revenue demoted to a driver, not a second headline', drivers.length === 1 && drivers[0].key === 'revenue' && drivers[0].value === 42011.5, JSON.stringify(drivers));

console.log('\n4. A committed week is never overwritten by an ingest');
const mv = await prisma.mowWeek.findFirstOrThrow({ where: { brand: 'MV' } });
check('MV committed number intact', (mv.smartNumberCommitted as {value:number}).value === 31200);

console.log('\n5. Partial ingest must not blank a good number');
r = await ingest(post('http://x/api/mow/metrics/ingest', { weekOf: '2026-09-09', figures: { revenue: 999 } }));
const b2 = await r.json();
check('reports the missing headline figure', b2.missingFigure.includes('VL:leads'), JSON.stringify(b2.missingFigure));
const vl2 = await prisma.mowWeek.findFirstOrThrow({ where: { brand: 'VL' } });
check('previous leads figure preserved', (vl2.smartNumberStaged as {value:number}).value === 18240);

console.log(`\n${fails === 0 ? 'ALL PASS' : fails + ' FAILURE(S)'}`);
await prisma.$disconnect();
process.exit(fails === 0 ? 0 : 1);
}
main();
