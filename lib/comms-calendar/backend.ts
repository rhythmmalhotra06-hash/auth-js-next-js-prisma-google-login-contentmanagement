// Which backend the comms calendar reads from.
//
// Defaults to `airtable` so the surface ships before the reference reconcile lands — the 10 Sep
// handoff's sequencing (§10.2: "build against Airtable directly, COMMS_CALENDAR_BACKEND=airtable").
// Flip to `postgres` once CommsDay is being pulled and verified.
//
// Same per-domain flag pattern as SHOOTS_BACKEND / SOCIAL_BACKEND / MOW_BACKEND. Env changes only
// take effect after a NEW commit forces a rebuild — a same-SHA deploy no-ops.
export const COMMS_CALENDAR_BACKEND: 'airtable' | 'postgres' =
  process.env.COMMS_CALENDAR_BACKEND === 'postgres' ? 'postgres' : 'airtable';

export const commsCalendarIsPostgres = (): boolean => COMMS_CALENDAR_BACKEND === 'postgres';
