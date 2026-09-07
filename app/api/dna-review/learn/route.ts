import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { listDnaSignalsForAssetType, createDnaRule } from '@/lib/dna-review/repository';
import { proposeAssetTypeRules } from '@/lib/dna-review/learn';
import { getActiveDnaRules } from '@/lib/dna-review/repository';

// Tier-2 DNA-learning loop: read aggregated override-note/reaction signals per asset
// type, ask the model to propose generalizable rules from what was observed, and write
// them as INACTIVE proposed DnaReviewRules for a team lead/manager to approve in
// Settings → Asset types & DNA. Bearer-gated, same pattern as /api/clips/learn; drive
// from a weekly Kessel cron.
//
//   curl -X POST "$URL/api/dna-review/learn" -H "Authorization: Bearer $SYNC_SECRET"

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

function authorized(req: Request): boolean {
  const secret = process.env.SYNC_SECRET;
  if (!secret) return false;
  const header = req.headers.get('authorization') ?? '';
  const provided = header.startsWith('Bearer ') ? header.slice(7) : '';
  const a = Buffer.from(provided);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  try {
    const assetTypes = await prisma.assetType.findMany({ where: { active: true }, select: { id: true, name: true } });

    let proposed = 0;
    let consideredAssetTypes = 0;
    for (const at of assetTypes) {
      const signals = await listDnaSignalsForAssetType(at.id);
      if (!signals.length) continue;
      consideredAssetTypes++;

      const learnings = await proposeAssetTypeRules(at.id, signals);
      if (!learnings.length) continue;

      // Don't re-propose what's already active or already awaiting approval.
      const existing = (await getActiveDnaRules(at.id)).map((r) => r.statement);
      for (const l of learnings) {
        if (existing.includes(l.statement)) continue;
        await createDnaRule({
          assetTypeId: at.id,
          statement: l.statement,
          rationale: l.rationale || undefined,
          active: false, // awaits approval in Settings
          source: 'tier2_proposal',
          note: `Proposed from performance/override signal — ${l.evidence}`.slice(0, 500),
        });
        proposed++;
      }
    }

    return NextResponse.json({ ok: true, proposed, consideredAssetTypes, totalAssetTypes: assetTypes.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
