'use server';

import { revalidatePath } from 'next/cache';
import { getAdminAccess } from '@/lib/admin/access';
import { disconnect } from '@/lib/hootsuite/oauth';
import { probeTools, callTool, pullPerchMetrics } from '@/lib/hootsuite/perch';

// Admin controls for the Hootsuite integration. Same convention as app/admin/sync/actions.ts:
// admin-gated, and NEVER throwing — a rejected server action reaches the browser as an
// opaque "client-side exception", so every path returns a { ok, message }.

export interface HootsuiteActionResult {
  ok: boolean;
  message: string;
  /** Pretty-printed payload for the inspector panel. */
  detail?: string;
}

async function guard(run: () => Promise<HootsuiteActionResult>): Promise<HootsuiteActionResult> {
  try {
    const { isAdmin } = await getAdminAccess();
    if (!isAdmin) return { ok: false, message: 'Not authorized' };
    const r = await run();
    revalidatePath('/admin/hootsuite');
    return r;
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * List Perch's tools. This IS the capability spike that was owed: it answers what Perch
 * actually exposes, in production, with the real grant.
 */
export async function inspectTools(): Promise<HootsuiteActionResult> {
  return guard(async () => {
    const res = await probeTools();
    if (!res.ok) return { ok: false, message: res.error };
    if (res.data.length === 0) return { ok: false, message: 'Connected, but Perch exposed no tools — check the account entitlement.' };
    return {
      ok: true,
      message: `Perch exposes ${res.data.length} tool${res.data.length === 1 ? '' : 's'}.`,
      detail: res.data.map((t) => `• ${t.name}\n  ${t.description ?? '(no description)'}\n  args: ${JSON.stringify(t.inputSchema ?? {})}`).join('\n\n'),
    };
  });
}

/** Call one tool with raw JSON args — for pinning down the real response shape. */
export async function tryTool(name: string, argsJson: string): Promise<HootsuiteActionResult> {
  return guard(async () => {
    if (!name.trim()) return { ok: false, message: 'Enter a tool name.' };
    let args: Record<string, unknown> = {};
    if (argsJson.trim()) {
      try {
        args = JSON.parse(argsJson) as Record<string, unknown>;
      } catch {
        return { ok: false, message: 'Arguments must be valid JSON.' };
      }
    }
    const res = await callTool(name.trim(), args);
    if (!res.ok) return { ok: false, message: res.error };
    const pretty = res.json ? JSON.stringify(res.json, null, 2) : res.text;
    return { ok: true, message: `${name} returned ${pretty.length} characters.`, detail: pretty.slice(0, 8000) };
  });
}

/** Run the pull now — the same operation the nightly cron performs. */
export async function pullNow(windowDays: number): Promise<HootsuiteActionResult> {
  return guard(async () => {
    const r = await pullPerchMetrics(windowDays);
    const lines = [
      `upserted ${r.upserted} · matched ${r.matched} · unmatched ${r.unmatched} · skipped ${r.skipped}`,
      `tools seen: ${r.toolsSeen.join(', ') || '(none)'}`,
      `tools called: ${r.toolsCalled.join(', ') || '(none)'}`,
      r.toolsWithoutRows.length ? `answered but no rows recognized: ${r.toolsWithoutRows.join(', ')}` : '',
      ...r.notes,
      ...r.errors,
    ].filter(Boolean);
    const ok = r.upserted > 0;
    return {
      ok,
      message: ok
        ? `Ingested ${r.upserted} row${r.upserted === 1 ? '' : 's'} (${r.matched} matched to a video).`
        : 'Nothing ingested — see the detail for what Perch returned.',
      detail: lines.join('\n'),
    };
  });
}

/** Forget the stored tokens. */
export async function disconnectHootsuite(): Promise<HootsuiteActionResult> {
  return guard(async () => {
    await disconnect();
    return { ok: true, message: 'Disconnected. Stored tokens were deleted.' };
  });
}
