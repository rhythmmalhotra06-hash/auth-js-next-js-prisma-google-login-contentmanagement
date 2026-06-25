// Reference-data sync runner.
//
//   npx tsx scripts/sync-reference.ts --dry-run   # fetch + map + report, no DB writes
//   npx tsx scripts/sync-reference.ts             # write to the DB (needs a reachable
//                                                 # DATABASE_URL — runs as a Kessel job in prod)
//
// v1 per E2: one-way Airtable → Postgres for reference data only.

import 'dotenv/config';
import { syncReference } from '../lib/airtable/sync';

const dryRun = process.argv.includes('--dry-run');

syncReference({ dryRun })
  .then((report) => {
    console.log(JSON.stringify(report, null, 2));
    console.log(dryRun ? '\nDRY RUN — fetched + mapped, no DB writes.' : '\nSync complete.');
  })
  .catch((err) => {
    console.error('Sync failed:', err);
    process.exit(1);
  });
