// Which backend the shoots read/write paths use. `airtable` (default) = the pre-cutover
// Airtable-direct behavior; `postgres` = PG system-of-record + two-way sync (outbox push +
// inbound pull). Flip with `kessel env set SHOOTS_BACKEND=postgres` once PG is backfilled +
// verified. See lib/tickets/backend.ts (same pattern).
export const SHOOTS_BACKEND: 'airtable' | 'postgres' =
  process.env.SHOOTS_BACKEND === 'postgres' ? 'postgres' : 'airtable';

export const shootsArePostgres = (): boolean => SHOOTS_BACKEND === 'postgres';
