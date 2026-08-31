// Instrumentation & drift alerting — E12.4. Computes first-pass acceptance rate per
// the rejection taxonomy and fires the drift alert through the already-live Slack
// integration (lib/notify/slack.ts) when a pilot type's rate drops below the gate.
//
// STORAGE: no durable sink exists yet. Real persistence needs a new Prisma model +
// migration (or an Airtable table, per the PRD) — that's a schema change and needs
// sign-off before it's added, not something to do unilaterally. recordAcceptanceEvent()
// below is an in-memory placeholder ONLY: it does not survive a restart and is not
// shared across Cloud Run instances. It exists so the rate-computation and
// drift-alert logic are exercisable end-to-end today, ahead of that decision.

import { dmByPerson, postToChannel } from '@/lib/notify/slack';

export const REAL_REJECT_REASONS = ['reframe', 'caption_position', 'caption_timing', 'audio_grade'] as const;
export type RealRejectReason = (typeof REAL_REJECT_REASONS)[number];

/** Not a reject against this agent — it's E8's miss (moment selection), routed to
 *  E8's feedback loop instead (E12.4 Data). */
export const MOMENT_SELECTION_REJECT = 'moment_selection' as const;

export type RejectReason = RealRejectReason | typeof MOMENT_SELECTION_REJECT;

export interface AcceptanceEvent {
  clipId: string;
  assetType: string;
  dnaVersion: string;
  channelTier: 'high_risk' | 'standard';
  decision: 'accepted' | 'rejected';
  rejectReason?: RejectReason;
  /** ms from source-uploaded to this draft being ready — E12.4's first headline number. */
  timeToDraftMs?: number;
  /** ms from source-uploaded to human commit — the second headline number. */
  timeToShippableMs?: number;
  createdAt: string;
}

/** True when this event should count against the agent's first-pass acceptance rate.
 *  A moment-selection reject is E8's miss, not this agent's (E12.4 Data). */
export function countsAgainstAgent(e: AcceptanceEvent): boolean {
  return e.decision === 'accepted' || e.rejectReason !== MOMENT_SELECTION_REJECT;
}

// Placeholder store — see module header. Not durable, not shared across instances.
const EVENTS: AcceptanceEvent[] = [];

export function recordAcceptanceEvent(e: AcceptanceEvent): void {
  EVENTS.push(e);
}

export interface AcceptanceRate {
  assetType: string;
  sinceDnaVersion: string;
  total: number;
  accepted: number;
  rate: number; // 0–1; 1 (vacuously) when there are no scoped events yet
}

/**
 * First-pass acceptance rate for one asset type, since its last DNA version change
 * (E12.4 Behavior: "reset at each DNA update, isolated per type"). Excludes
 * moment-selection rejects per countsAgainstAgent().
 */
export function computeAcceptanceRate(assetType: string, dnaVersion: string, events: AcceptanceEvent[] = EVENTS): AcceptanceRate {
  const scoped = events.filter((e) => e.assetType === assetType && e.dnaVersion === dnaVersion && countsAgainstAgent(e));
  const accepted = scoped.filter((e) => e.decision === 'accepted').length;
  return { assetType, sinceDnaVersion: dnaVersion, total: scoped.length, accepted, rate: scoped.length ? accepted / scoped.length : 1 };
}

// Gate threshold (E12.4 Rules & Logic) — "early/learning bar, ratchets up monthly."
// This is the starting value; ratcheting it is a manual decision, not automated here.
export const HIGH_RISK_GATE = 0.7;

/** Lower-risk channels may run at a looser bar while the agent learns (E12.4 Rules &
 *  Logic) — no bar is enforced for them yet, only high-risk is gated. */
export function clearsGate(rate: AcceptanceRate, tier: 'high_risk' | 'standard'): boolean {
  return tier === 'standard' ? true : rate.rate >= HIGH_RISK_GATE;
}

export interface DriftCheckResult {
  rate: AcceptanceRate;
  isDrifting: boolean;
  alerted: boolean;
}

/** Channel for the drift-alert channel post. Unset by default — no real "creatives
 *  channel" id has been confirmed for this yet, and guessing one risks posting
 *  somewhere wrong in production. Set SLACK_AUTO_EDITING_CHANNEL_ID once confirmed;
 *  until then this only DMs the owner. */
function driftAlertChannel(): string | null {
  return process.env.SLACK_AUTO_EDITING_CHANNEL_ID || null;
}

/**
 * The drift detector (E12.4 Failure Modes — TOP risk: "silent off-brand drift at
 * scale"). If the rate for this asset type drops below the gate on the high-risk
 * tier, alerts — DM to owner, plus a channel post once a channel is configured — per
 * the 24h-SLA framing ("alert, keep running"). Never throws; Slack is best-effort by
 * design (lib/notify/slack.ts already swallows its own errors).
 */
export async function checkDriftAndAlert(
  assetType: string,
  dnaVersion: string,
  tier: 'high_risk' | 'standard',
  owner: { name?: string | null; email?: string | null },
  events: AcceptanceEvent[] = EVENTS,
): Promise<DriftCheckResult> {
  const rate = computeAcceptanceRate(assetType, dnaVersion, events);
  const isDrifting = !clearsGate(rate, tier);
  if (!isDrifting) return { rate, isDrifting, alerted: false };

  const pct = Math.round(rate.rate * 100);
  const text =
    `⚠️ Auto-editing drift alert — *${assetType}* (${tier}) is at *${pct}%* first-pass acceptance ` +
    `since DNA \`${dnaVersion}\` (${rate.accepted}/${rate.total}), below the ${Math.round(HIGH_RISK_GATE * 100)}% gate. ` +
    `Agent keeps running. You have 24h to act before this escalates (E12.4 — escalation target ` +
    `not yet re-confirmed since Titus took ownership; see the epic's Open Questions).`;

  const channel = driftAlertChannel();
  await Promise.all([dmByPerson(owner, text), ...(channel ? [postToChannel(channel, text)] : [])]);

  return { rate, isDrifting, alerted: true };
}
