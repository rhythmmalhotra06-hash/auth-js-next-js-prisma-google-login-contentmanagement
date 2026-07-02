'use server';

import { revalidatePath } from 'next/cache';
import { getAdminAccess } from '@/lib/admin/access';
import { backfillTickets } from '@/lib/airtable/backfill';
import { drainOutbox } from '@/lib/airtable/push';
import { pullTickets } from '@/lib/airtable/pull';
import { syncReference } from '@/lib/airtable/sync';

export interface SyncActionResult { ok: boolean; message: string }

// Admin-triggered sync controls. Server-only + admin-gated: these run in-container
// (DATABASE_URL resolves) and are reached through the authenticated admin session, so
// they need no bearer/IAP handling. Same operations the Kessel crons will call.
//
// Every action goes through `guard`, which never throws — a thrown/rejected server
// action surfaces to the browser as an opaque "client-side exception", so we always
// return a { ok, message } instead.
async function guard(run: () => Promise<string>): Promise<SyncActionResult> {
  try {
    const access = await getAdminAccess();
    if (!access.isAdmin) return { ok: false, message: 'Not authorized' };
    const message = await run();
    revalidatePath('/admin/sync');
    return { ok: true, message };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}

/** Refresh reference tables (employees/types/…) Airtable → Postgres. */
export async function runReferenceSync(): Promise<SyncActionResult> {
  return guard(async () => {
    const r = await syncReference({});
    return `Reference synced (${JSON.stringify(r).slice(0, 200)})`;
  });
}

/** Mirror Prio tickets → Postgres. `all` includes the Done/Won't Do history. */
export async function runBackfill(includeAll: boolean): Promise<SyncActionResult> {
  return guard(async () => {
    const r = await backfillTickets({ includeAll });
    return `Backfill done — fetched ${r.fetched}, upserted ${r.upserted}, unresolved ${r.unresolved}, cursor ${r.cursor ?? 'none'}`;
  });
}

/** Drain the outbox: push pending Postgres ticket changes → Airtable. */
export async function runPush(): Promise<SyncActionResult> {
  return guard(async () => {
    const r = await drainOutbox();
    if (!r.enabled) return 'Push disabled (AIRTABLE_PUSH_ENABLED not set)';
    return `Push done — scanned ${r.scanned}, pushed ${r.pushed}, failed ${r.failed}`;
  });
}

/** Pull Airtable ticket edits → Postgres (echo-suppressed, last-writer-wins). */
export async function runPull(): Promise<SyncActionResult> {
  return guard(async () => {
    const r = await pullTickets({});
    return `Pull done — scanned ${r.scanned}, imported ${r.imported}, echo-skipped ${r.echoSkipped}, conflict-skipped ${r.conflictSkipped}`;
  });
}
