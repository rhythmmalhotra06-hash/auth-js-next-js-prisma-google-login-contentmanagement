import { requireSession } from '@/lib/api/guard';
import { generateEdl } from '@/lib/auto-editing/generate';
import { getDnaForAssetType } from '@/lib/auto-editing/dna';
import type { ClipInput, ChannelTier } from '@/lib/auto-editing/prompt';

export const runtime = 'nodejs';
export const maxDuration = 120;

/**
 * POST /api/auto-editing/generate — manual test entry point for the E12.1 EDL brain
 * service. Not wired to any UI yet (there's no review queue to write into — that's
 * E12.4/E12.5). Exists so the brain is exercisable against a real transcript slice
 * today, ahead of E12.3 choosing real pilot asset types and DNA records.
 *
 * Body: { clipId, sourceUri, inSec, outSec, transcriptSlice, hook?, assetType?,
 *         channelTier?: 'high_risk' | 'standard', channelName? }
 */
export async function POST(req: Request) {
  // Spends Anthropic tokens on every call — same guard as /api/media/[id]/suggest.
  const denied = await requireSession();
  if (denied) return denied;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, error: 'Request body must be JSON.' }, { status: 400 });
  }

  const clipId = typeof body.clipId === 'string' ? body.clipId.trim() : '';
  const sourceUri = typeof body.sourceUri === 'string' ? body.sourceUri.trim() : '';
  const inSec = typeof body.inSec === 'number' ? body.inSec : NaN;
  const outSec = typeof body.outSec === 'number' ? body.outSec : NaN;
  const transcriptSlice = typeof body.transcriptSlice === 'string' ? body.transcriptSlice : '';
  const hook = typeof body.hook === 'string' ? body.hook : undefined;
  const assetType = typeof body.assetType === 'string' ? body.assetType : '__stub_pilot__';
  const tier = body.channelTier === 'high_risk' ? 'high_risk' : 'standard';
  const channelName = typeof body.channelName === 'string' ? body.channelName : 'unspecified';

  if (!clipId || !sourceUri || !Number.isFinite(inSec) || !Number.isFinite(outSec) || !transcriptSlice.trim()) {
    return Response.json(
      { ok: false, error: 'clipId, sourceUri, inSec, outSec, and transcriptSlice are required.' },
      { status: 400 },
    );
  }

  const clip: ClipInput = { clipId, sourceUri, inSec, outSec, transcriptSlice, hook };
  const channel: ChannelTier = { tier, channelName };

  try {
    const dna = await getDnaForAssetType(assetType);
    const result = await generateEdl(clip, dna, channel);
    return Response.json({ ok: true, ...result });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'EDL generation failed';
    console.error(`[auto-editing] EDL generation failed for clip ${clipId}: ${message}`);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
