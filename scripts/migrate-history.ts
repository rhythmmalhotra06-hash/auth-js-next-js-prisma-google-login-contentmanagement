// Historical migration runner — one-time (re-runnable) backfill of tickets +
// assets from Airtable. Run the reference sync FIRST so link targets exist.
//
//   npx tsx scripts/migrate-history.ts --dry-run   # fetch + map + report, no DB writes
//   npx tsx scripts/migrate-history.ts             # write to the DB (needs a reachable
//                                                   # DATABASE_URL — runs as a Kessel job in prod)

import 'dotenv/config';
import { migrateHistory } from '../lib/airtable/migrate';

const dryRun = process.argv.includes('--dry-run');

migrateHistory({ dryRun })
  .then((report) => {
    console.log(JSON.stringify(report, null, 2));
    console.log(dryRun ? '\nDRY RUN — fetched + mapped, no DB writes.' : '\nMigration complete.');
  })
  .catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
