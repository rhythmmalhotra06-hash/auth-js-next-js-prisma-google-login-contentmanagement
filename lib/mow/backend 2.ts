// Backend flag for the Message of the Week domain (comms_days + messages_of_week + the pack).
//
// Defaults to 'airtable' — i.e. the two-way sync is INERT until switched on. That keeps this
// code safe to deploy before the 0024_mow migration is applied to the managed DB and before
// the Ramya workshop settles the Airtable shape (plan §0.3), which is the same staging
// discipline every other domain used at cutover.
//
// Flip with `kessel env set MOW_BACKEND=postgres` once 0024_mow is applied AND comms_days has
// been backfilled + verified against the base. Remember env changes need a NEW commit to take
// effect — a same-SHA deploy no-ops.
export const MOW_BACKEND: 'airtable' | 'postgres' =
  process.env.MOW_BACKEND === 'postgres' ? 'postgres' : 'airtable';

export const mowIsPostgres = (): boolean => MOW_BACKEND === 'postgres';
