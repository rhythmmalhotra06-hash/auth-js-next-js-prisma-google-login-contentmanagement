// Which backend the social board read/write paths use. `airtable` (default) = the
// pre-cutover Airtable-direct behavior; `postgres` = PG system-of-record + two-way sync.
// Flip with `kessel env set SOCIAL_BACKEND=postgres` once PG is backfilled + verified.
export const SOCIAL_BACKEND: 'airtable' | 'postgres' =
  process.env.SOCIAL_BACKEND === 'postgres' ? 'postgres' : 'airtable';

export const socialIsPostgres = (): boolean => SOCIAL_BACKEND === 'postgres';
