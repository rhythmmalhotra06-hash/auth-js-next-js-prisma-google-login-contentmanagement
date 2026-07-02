// Which backend the ticket read/write/notify paths use. Lets us deploy the Postgres
// code without switching the live queue: `airtable` (default) behaves exactly like the
// pre-cutover app; flipping to `postgres` (kessel env set TICKETS_BACKEND=postgres) is
// an instant, reversible cutover once Postgres has been backfilled + verified.
export const TICKETS_BACKEND: 'airtable' | 'postgres' =
  process.env.TICKETS_BACKEND === 'postgres' ? 'postgres' : 'airtable';
