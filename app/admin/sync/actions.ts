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

async function requireAdmin(): Promise<boolean> {
  const access = await getAdminAccess();
  return access.isAdmin;
}

/** Refresh reference tables (employees/types/…) Airtable → Postgres. */
export async function runReferenceSync(): Promise<SyncActionResult> {
  if (!(await requireAdmin())) return { ok: false, message: 'Not authorized' };
  try {
    const r = await syncReference({});
    revalidatePath('/admin/sync');
    return { ok: true, message: `Reference synced (${JSON.stringify(r).slice(0, 200)})` };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}

/** Mirror Prio tickets → Postgres. `all` includes the Done/Won't Do history. */
export async function runBackfill(includeAll: boolean): Promise<SyncActionResult> {
  if (!(await requireAdmin())) return { ok: false, message: 'Not authorized' };
  try {
    const r = await backfillTickets({ includeAll });
    revalidatePath('/admin/sync');
    return { ok: true, message: `Backfill done — fetched ${r.fetched}, upserted ${r.upserted}, unresolved ${r.unresolved}, cursor ${r.cursor ?? 'none'}` };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}

/** Drain the outbox: push pending Postgres ticket changes → Airtable. */
export async function runPush(): Promise<SyncActionResult> {
  if (!(await requireAdmin())) return { ok: false, message: 'Not authorized' };
  try {
    const r = await drainOutbox();
    revalidatePath('/admin/sync');
    if (!r.enabled) return { ok: false, message: 'Push disabled (AIRTABLE_PUSH_ENABLED not set)' };
    return { ok: true, message: `Push done — scanned ${r.scanned}, pushed ${r.pushed}, failed ${r.failed}` };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}

/** Pull Airtable ticket edits → Postgres (echo-suppressed, last-writer-wins). */
export async function runPull(): Promise<SyncActionResult> {
  if (!(await requireAdmin())) return { ok: false, message: 'Not authorized' };
  try {
    const r = await pullTickets({});
    revalidatePath('/admin/sync');
    return { ok: true, message: `Pull done — scanned ${r.scanned}, imported ${r.imported}, echo-skipped ${r.echoSkipped}, conflict-skipped ${r.conflictSkipped}` };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}
