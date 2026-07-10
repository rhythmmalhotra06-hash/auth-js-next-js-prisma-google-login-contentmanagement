// Which backend the reference/config READ paths use. Like TICKETS_BACKEND, this lets
// us ship the Postgres read code without switching the live app: `airtable` (default)
// behaves exactly as before; flipping to `postgres` (kessel env set REFERENCE_BACKEND=postgres)
// makes reference/config reads come from the mirrored Postgres tables.
//
// Scope: employees (+auth), contractors, scoring config, clip rules, intake reference,
// asset-type DNA READ. WRITES always go to Airtable (edit-in-Airtable / settings pages);
// syncReference mirrors Airtable → PG. Admin config-EDITOR list reads stay on Airtable.
export const REFERENCE_BACKEND: 'airtable' | 'postgres' =
  process.env.REFERENCE_BACKEND === 'postgres' ? 'postgres' : 'airtable';

export const referenceIsPostgres = (): boolean => REFERENCE_BACKEND === 'postgres';
