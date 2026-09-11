// The two primitives the load-speed work rests on, exercised without Airtable or Postgres:
// the per-base limiter (lib/airtable/limiter.ts) and the stale-while-revalidate memo
// (lib/cache/swr.ts). Timing assertions are loose on purpose — a CI box is not a stopwatch.
import { acquire, baseOf } from '@/lib/airtable/limiter';
import { swr, invalidate, swrStats } from '@/lib/cache/swr';
let fails = 0;
const ck = (n: string, c: boolean, e = '') => { if (!c) { fails++; console.log(`  FAIL  ${n} ${e}`); } else console.log(`  ok    ${n}${e ? ' — ' + e : ''}`); };
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

console.log('\n1. baseOf reads the base from any API url');
ck('list url', baseOf('https://api.airtable.com/v0/appFEFygXo2pRc8AR/tblhrRl8GzsDMv0DD?x=1') === 'appFEFygXo2pRc8AR');
ck('record url', baseOf('https://api.airtable.com/v0/appDZnMnJGehbSOo5/tblX/recY?returnFieldsByFieldId=true') === 'appDZnMnJGehbSOo5');
ck('content host', baseOf('https://content.airtable.com/v0/appWYOr2p4RKHf2LR/recY/fld/uploadAttachment') === 'appWYOr2p4RKHf2LR');

console.log('\n2. Requests on one base OVERLAP (the old queue serialised them)');
{
  let peak = 0, live = 0;
  const t0 = Date.now();
  await Promise.all(Array.from({ length: 5 }, async () => {
    const release = await acquire('appA');
    live++; peak = Math.max(peak, live);
    await sleep(150); // a pretend round trip
    live--; release();
  }));
  const ms = Date.now() - t0;
  ck('five requests were in flight together', peak === 5, `peak=${peak}`);
  ck('and took one round trip, not five', ms < 500, `${ms}ms`);
}

console.log('\n3. The sixth request on a base waits for the window (5 req/s)');
{
  const t0 = Date.now();
  const releases = await Promise.all(Array.from({ length: 5 }, () => acquire('appB')));
  const fast = Date.now() - t0;
  const sixth = acquire('appB');
  const r6 = await sixth;
  const waited = Date.now() - t0;
  releases.forEach((r) => r()); r6();
  ck('first five start at once', fast < 100, `${fast}ms`);
  ck('sixth waited ~1s for the window', waited >= 900 && waited < 1600, `${waited}ms`);
}

console.log('\n4. Two bases have independent budgets');
{
  const t0 = Date.now();
  const rs = await Promise.all([
    ...Array.from({ length: 5 }, () => acquire('appC')),
    ...Array.from({ length: 3 }, () => acquire('appD')),
  ]);
  const ms = Date.now() - t0;
  rs.forEach((r) => r());
  ck('5 + 3 across two bases start together (under the global cap of 8)', ms < 100, `${ms}ms`);
}

console.log('\n5. swr: fresh → cached, no second call');
{
  let calls = 0;
  const fn = async () => { calls++; return calls; };
  const a = await swr('t:fresh', fn, { fresh: 10_000, stale: 20_000 });
  const b = await swr('t:fresh', fn, { fresh: 10_000, stale: 20_000 });
  ck('one underlying call', calls === 1, `calls=${calls}`);
  ck('same value', a === 1 && b === 1);
}

console.log('\n6. swr: concurrent misses dedupe to one call');
{
  let calls = 0;
  const fn = async () => { calls++; await sleep(50); return 'v'; };
  await Promise.all([swr('t:dedupe', fn), swr('t:dedupe', fn), swr('t:dedupe', fn)]);
  ck('one underlying call for three readers', calls === 1, `calls=${calls}`);
}

console.log('\n7. swr: stale → old value now, refreshed in the background');
{
  let calls = 0;
  const fn = async () => { calls++; return `v${calls}`; };
  const first = await swr('t:stale', fn, { fresh: 30, stale: 5_000 });
  await sleep(60); // past fresh, inside stale
  const second = await swr('t:stale', fn, { fresh: 30, stale: 5_000 });
  ck('the stale read returned the OLD value immediately', second === first && second === 'v1', second);
  await sleep(20);
  const third = await swr('t:stale', fn, { fresh: 30, stale: 5_000 });
  ck('the background refresh landed for the next reader', third === 'v2', third);
  ck('exactly two calls', calls === 2, `calls=${calls}`);
}

console.log('\n8. swr: a failing background refresh keeps the old value');
{
  let calls = 0;
  const fn = async () => { calls++; if (calls > 1) throw new Error('boom'); return 'good'; };
  await swr('t:fail', fn, { fresh: 30, stale: 5_000 });
  await sleep(60);
  const v = await swr('t:fail', fn, { fresh: 30, stale: 5_000 });
  await sleep(20);
  const again = await swr('t:fail', fn, { fresh: 30, stale: 5_000 });
  ck('reader never saw the failure', v === 'good' && again === 'good');
}

console.log('\n9. swr: expired → foreground refetch');
{
  let calls = 0;
  const fn = async () => { calls++; return calls; };
  await swr('t:expired', fn, { fresh: 10, stale: 20 });
  await sleep(40);
  const v = await swr('t:expired', fn, { fresh: 10, stale: 20 });
  ck('refetched in the foreground', v === 2, `v=${v}`);
}

console.log('\n10. invalidate drops by prefix');
{
  await swr('vl:rows', async () => 1);
  await swr('vl:mow', async () => 1);
  await swr('perch:captions', async () => 1);
  invalidate('vl:');
  const keys = swrStats().keys;
  ck('vl:* gone', !keys.includes('vl:rows') && !keys.includes('vl:mow'), keys.join(','));
  ck('other keys kept', keys.includes('perch:captions'));
}

console.log(`\n${fails === 0 ? 'ALL PASS' : fails + ' FAILURE(S)'}`);
process.exit(fails === 0 ? 0 : 1);
