import { requireSession } from '@/lib/api/guard';
import {
  recordAcceptanceEvent,
  checkDriftAndAlert,
  REAL_REJECT_REASONS,
  MOMENT_SELECTION_REJECT,
  type RejectReason,
  type AcceptanceEvent,
} from '@/lib/auto-editing/instrumentation';

export const runtime = 'nodejs';

// v1 pilot owner (E12 User Stories) — no review-queue UI exists yet to source this
// from a real session/roster, so it's the fallback the drift alert DMs. Override via
// the request body for testing. Update this once E12.5 gives review a real UI.
const DEFAULT_OWNER = { name: 'Rhythm Malhotra', email: null as string | null };

const ALL_REJECT_REASONS: RejectReason[] = [...REAL_REJECT_REASONS, MOMENT_SELECTION_REJECT];

/**
 * POST /api/auto-editing/review — manual test entry point for E12.4. Simulates what a
 * future review-queue UI (E12.5, deferred) would call on an accept/reject decision:
 * records the event, then checks whether the asset type has drifted below its gate
 * and fires the real Slack drift alert if so.
 *
 * Body: { clipId, assetType, dnaVersion, channelTier: 'high_risk'|'standard',
 *         decision: 'accepted'|'rejected', rejectReason?, timeToDraftMs?,
 *         timeToShippableMs?, ownerName?, ownerEmail? }
 */
export async function POST(req: Request) {
  const denied = await requireSession();
  if (denied) return denied;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, error: 'Request body must be JSON.' }, { status: 400 });
  }

  const clipId = typeof body.clipId === 'string' ? body.clipId.trim() : '';
  const assetType = typeof body.assetType === 'string' ? body.assetType.trim() : '';
  const dnaVersion = typeof body.dnaVersion === 'string' ? body.dnaVersion.trim() : '';
  const channelTier = body.channelTier === 'high_risk' ? 'high_risk' : 'standard';
  const decision = body.decision === 'accepted' ? 'accepted' : body.decision === 'rejected' ? 'rejected' : null;
  const rejectReason = ALL_REJECT_REASONS.includes(body.rejectReason as RejectReason) ? (body.rejectReason as RejectReason) : undefined;

  if (!clipId || !assetType || !dnaVersion || !decision) {
    return Response.json({ ok: false, error: 'clipId, assetType, dnaVersion, and decision are required.' }, { status: 400 });
  }
  if (decision === 'rejected' && !rejectReason) {
    return Response.json({ ok: false, error: `A rejected decision needs rejectReason, one of: ${ALL_REJECT_REASONS.join(', ')}` }, { status: 400 });
  }

  const event: AcceptanceEvent = {
    clipId,
    assetType,
    dnaVersion,
    channelTier,
    decision,
    rejectReason,
    timeToDraftMs: typeof body.timeToDraftMs === 'number' ? body.timeToDraftMs : undefined,
    timeToShippableMs: typeof body.timeToShippableMs === 'number' ? body.timeToShippableMs : undefined,
    createdAt: new Date().toISOString(),
  };
  recordAcceptanceEvent(event);

  const owner = {
    name: typeof body.ownerName === 'string' ? body.ownerName : DEFAULT_OWNER.name,
    email: typeof body.ownerEmail === 'string' ? body.ownerEmail : DEFAULT_OWNER.email,
  };

  try {
    const drift = await checkDriftAndAlert(assetType, dnaVersion, channelTier, owner);
    return Response.json({ ok: true, event, drift });
  } catch (e) {
    // checkDriftAndAlert's Slack calls are already best-effort internally; this catch
    // is defense in depth so a notification hiccup never hides that the event recorded.
    const message = e instanceof Error ? e.message : 'Drift check failed';
    console.error(`[auto-editing] drift check failed for ${assetType}: ${message}`);
    return Response.json({ ok: true, event, drift: null, driftCheckError: message });
  }
}
