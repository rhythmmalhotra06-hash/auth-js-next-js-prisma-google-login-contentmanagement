// Build publications from every stored metric row, then run the deterministic checks.
//
// Bearer-gated like every other job route — middleware skips /api, so a route that does not
// guard itself is simply public. Idempotent by construction: publications are keyed on
// (account, post) and Signals on their natural key, so running this twice changes nothing the
// second time.

import { NextResponse } from 'next/server';
import { requireSyncSecret } from '@/lib/api/guard';
import { buildPublications } from '@/lib/publications/resolve';
import { runDeterministicChecks } from '@/lib/signals/run';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST(req: Request) {
  const denied = requireSyncSecret(req);
  if (denied) return denied;

  const url = new URL(req.url);
  const dryRun = url.searchParams.get('dryRun') === '1';
  const skipChecks = url.searchParams.get('checks') === '0';

  try {
    const publications = await buildPublications({ dryRun });
    const checks = dryRun || skipChecks ? null : await runDeterministicChecks();
    return NextResponse.json({ ok: true, dryRun, publications, checks });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
