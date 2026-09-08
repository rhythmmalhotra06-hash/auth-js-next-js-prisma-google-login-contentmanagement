'use server';

import { revalidatePath } from 'next/cache';
import { TICKET_STATUSES, PRIO_STATUSES } from '@/lib/tickets/constants';
import { updateTicket, type TicketPatch } from '@/lib/tickets/write';
import { maybeNotifyAssetReady, notifyAssignment } from '@/lib/notify/triggers';
import { prisma } from '@/lib/prisma';
import { runDnaReview, runVisualDnaReview } from '@/lib/dna-review/generate';
import { isSafePublicHttpUrl, inferRatioField, type RatioField } from '@/lib/dna-review/video-source';
import { checkDnaGate, setFindingReaction } from '@/lib/dna-review/repository';
import { getDnaAccessForAssetType } from '@/lib/dna-review/access';
import { rememberDnaFeedbackAsLearning } from '@/lib/dna-review/learn';
// Slack DM for a blocked ticket (per the PRD) is deferred — this schema has no modeled
// "who is the approver for this ticket" concept to notify; not wired in this pass.

// rememberDnaFeedbackAsLearning() is itself best-effort (catches its own errors and
// resolves with { saved: false, error }) so a fire-and-forget call never rejects — this
// logs that resolved failure instead of letting it disappear silently.
function logLearningResult(label: string, p: Promise<{ saved: boolean; error?: string }>): void {
  void p.then((res) => {
    if (!res.saved && res.error) console.error(`[dna-review] ${label}`, res.error);
  });
}

export interface UpdateStatusResult {
  ok: boolean;
  error?: string;
  /** Set when the decision lock blocked the transition — the UI should prompt for an
   *  override note and retry, rather than showing this as a generic failure. */
  blocked?: boolean;
}

function done(ticketId: string): UpdateStatusResult {
  revalidatePath(`/tickets/${ticketId}`);
  revalidatePath('/tickets');
  revalidatePath('/manager');
  revalidatePath('/editor');
  return { ok: true };
}

// Editor updates the internal Ticket Status axis. Postgres is the system of record;
// the write appends a TicketEvent + enqueues an Airtable push (drained in the background).
//
// DNA decision lock (E13.1) — the one deliberate exception to "propose, don't act" in this
// app: entering 'Approved' is blocked while the ticket's latest DNA review has an
// undismissed `flag` finding, or while no review exists at all (fail-closed — an AI outage
// must never silently look identical to "DNA was checked and passed"). `overrideNote` is
// the audit trail for pushing through anyway; it's persisted as the TicketEvent's note
// (the existing status-change audit mechanism, not a new field) and, best-effort, distilled
// into a durable DnaReviewRule (Tier 1 learning).
export async function updateTicketStatus(ticketId: string, newStatus: string, overrideNote?: string): Promise<UpdateStatusResult> {
  if (!(TICKET_STATUSES as readonly string[]).includes(newStatus)) return { ok: false, error: 'Invalid status' };

  if (newStatus === 'Approved') {
    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId }, select: { assetTypeId: true } });
    const gate = await checkDnaGate(ticketId);
    if (gate.blocked) {
      const note = overrideNote?.trim();
      if (!note) {
        return {
          ok: false,
          blocked: true,
          error:
            gate.reason === 'flag'
              ? 'DNA review flagged this ticket — dismiss the flag, or approve anyway with a note.'
              : 'No completed DNA review exists for this ticket — approve anyway with a note, or re-run the review.',
        };
      }
      const access = await getDnaAccessForAssetType(ticket?.assetTypeId ?? null);
      if (!access.canGovern) {
        return { ok: false, error: 'Only a manager, team lead, or exec can approve past a DNA review block.' };
      }
      if (ticket?.assetTypeId) {
        logLearningResult('learning from override note failed', rememberDnaFeedbackAsLearning({
          feedback: note,
          assetTypeId: ticket.assetTypeId,
          active: true,
          sourceTicketId: ticketId,
          source: 'tier1_decision',
          createdBy: access.email,
        }));
      }
      const res = await updateTicket(ticketId, { ticketStatus: newStatus }, { note: `DNA override: ${note}` });
      if (!res.ok) return { ok: false, error: res.error };
      return done(ticketId);
    }
  }

  const res = await updateTicket(ticketId, { ticketStatus: newStatus });
  if (!res.ok) return { ok: false, error: res.error };
  if (newStatus === 'Review') {
    void runDnaReview(ticketId, { triggeredBy: 'status_change' }).catch((e) => console.error('[dna-review] automatic trigger failed', e));
  }
  return done(ticketId);
}

/** Manual "Re-run" — triggers a fresh DNA review on demand (e.g. after a revision cycle). */
export async function rerunDnaReview(ticketId: string, requestedBy?: string | null): Promise<UpdateStatusResult> {
  const res = await runDnaReview(ticketId, { triggeredBy: 'manual', requestedBy: requestedBy ?? null });
  if (!res.ok) return { ok: false, error: res.error ?? 'Review failed' };
  revalidatePath(`/tickets/${ticketId}`);
  return { ok: true };
}

export interface VisualReviewResult extends UpdateStatusResult {
  /** The link isn't usable — show the paste-a-direct-link box rather than a bare failure. */
  needsLink?: boolean;
  reason?: string;
  detectedUrl?: string | null;
  /** Which ratio column a pasted link was saved into, if any (for the confirmation line). */
  savedTo?: RatioField | null;
}

const RATIO_FIELDS: RatioField[] = ['final9x16', 'final16x9', 'final4x5'];

/**
 * Persist a link the user pasted to unblock a review, so the next run needs no paste.
 *
 * Writes through `updateTicket` (Postgres + the two-way Airtable push) rather than
 * `updateTicketLink`, deliberately: that wrapper also fires `maybeNotifyAssetReady`, which
 * DMs the requester and posts to #content-ready for `delivery: true` fields. An AI review
 * action must not trigger an "asset ready" announcement as a side effect.
 *
 * Only ever fills an EMPTY column unless the user explicitly named the target — these are
 * fields the creative team maintains by hand.
 */
async function saveResolvedLink(ticketId: string, url: string, requested?: RatioField | null): Promise<RatioField | null> {
  const t = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: { final9x16: true, final16x9: true, final4x5: true },
  });
  if (!t) return null;

  const isEmpty = (f: RatioField) => !(t[f] ?? '').trim();

  let target: RatioField | null = null;
  if (requested) {
    target = requested; // explicit user choice may overwrite
  } else {
    const inferred = inferRatioField(url);
    if (inferred && isEmpty(inferred)) target = inferred;
    else target = RATIO_FIELDS.find(isEmpty) ?? null;
  }
  if (!target) return null;

  const res = await updateTicket(ticketId, { [target]: url } as TicketPatch);
  if (!res.ok) {
    console.error('[dna-review] saving the pasted link failed', res.error);
    return null;
  }
  return target;
}

/** Opt-in "Review with visuals" (E13.2) — real video access via render-service frame
 *  extraction. Materially more expensive/slower than the text-only review, so this is
 *  always an explicit click, never automatic.
 *
 *  `videoUrlOverride` is the escape hatch for the ~44% of tickets whose delivery-link
 *  fields hold something undownloadable (a Dropbox folder we can't resolve, a Replay page,
 *  a Frame.io review URL). `saveTo` names the ratio column to persist it into. */
export async function runVisualDnaReviewAction(
  ticketId: string,
  opts?: { videoUrlOverride?: string; saveTo?: RatioField | null; save?: boolean },
): Promise<VisualReviewResult> {
  const override = opts?.videoUrlOverride?.trim();
  // Never trust a client-supplied URL: it becomes an outbound fetch from render-service.
  if (override && !isSafePublicHttpUrl(override)) {
    return {
      ok: false,
      needsLink: true,
      reason: 'not-a-url',
      error: 'Enter a full https:// link to a publicly reachable video file.',
    };
  }

  const res = await runVisualDnaReview(ticketId, { videoUrlOverride: override ?? null });
  if (!res.ok) {
    return {
      ok: false,
      error: res.error ?? 'Visual review failed',
      needsLink: res.needsLink,
      reason: res.reason,
      detectedUrl: res.detectedUrl,
    };
  }

  // Save-back only for a link the user typed — a link we resolved ourselves is already on
  // the ticket, and a Dropbox folder has no shareable direct-file form to store.
  let savedTo: RatioField | null = null;
  if (override && opts?.save !== false) {
    savedTo = await saveResolvedLink(ticketId, override, opts?.saveTo ?? null);
  }

  revalidatePath(`/tickets/${ticketId}`);
  return { ok: true, savedTo };
}

/** An editor's thumbs up/down + note on a specific finding — the Tier-1 learning signal,
 *  distinct from dismissal. Anyone signed in may react (matches the clip engine's "anyone
 *  who can re-run can teach" precedent); saved inactive pending team-lead approval. */
export async function reactToDnaFinding(findingId: string, reaction: 'helpful' | 'not_helpful', note: string, assetTypeId: string | null, reactedBy: string | null): Promise<UpdateStatusResult> {
  await setFindingReaction(findingId, reaction, note?.trim() || null, reactedBy);
  if (note?.trim() && assetTypeId) {
    logLearningResult('learning from finding reaction failed', rememberDnaFeedbackAsLearning({
      feedback: note,
      assetTypeId,
      active: false,
      source: 'tier1_reaction',
      createdBy: reactedBy,
    }));
  }
  revalidatePath(`/tickets`);
  return { ok: true };
}

/** Dismiss a `flag` finding with a required note — the gate-clearing action. Gated to
 *  manager/founder/team-lead-of-this-asset-type; never the ticket's assigned editor. */
export async function dismissDnaFinding(ticketId: string, findingId: string, note: string): Promise<UpdateStatusResult> {
  const trimmed = note?.trim();
  if (!trimmed) return { ok: false, error: 'A note is required to dismiss a DNA finding.' };

  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: { assetTypeId: true, assignee: { select: { airtableId: true } } },
  });
  const access = await getDnaAccessForAssetType(ticket?.assetTypeId ?? null);
  if (!access.canGovern) return { ok: false, error: 'Only a manager, team lead, or exec can dismiss a DNA finding.' };
  // Separation of duties: the person the finding is checking can't clear it themselves.
  const { getEmployeeForSession } = await import('@/lib/employee');
  const me = await getEmployeeForSession();
  if (me && ticket?.assignee?.airtableId === me.id) {
    return { ok: false, error: 'The assigned editor cannot dismiss a finding on their own ticket.' };
  }

  await setFindingReaction(findingId, 'dismissed', trimmed, access.email);
  if (ticket?.assetTypeId) {
    logLearningResult('learning from dismissal failed', rememberDnaFeedbackAsLearning({
      feedback: trimmed,
      assetTypeId: ticket.assetTypeId,
      active: true,
      sourceTicketId: ticketId,
      source: 'tier1_decision',
      createdBy: access.email,
    }));
  }
  revalidatePath(`/tickets/${ticketId}`);
  return { ok: true };
}

// Manager sets the externally-facing Prio Status axis.
export async function updatePrioStatus(ticketId: string, newStatus: string): Promise<UpdateStatusResult> {
  if (!(PRIO_STATUSES as readonly string[]).includes(newStatus)) return { ok: false, error: 'Invalid priority status' };
  const res = await updateTicket(ticketId, { prioStatus: newStatus });
  if (!res.ok) return { ok: false, error: res.error };
  return done(ticketId);
}

// Assign an editor (assigneeId is an Airtable Employees recId; empty clears).
export async function assignTicket(ticketId: string, assigneeId: string): Promise<UpdateStatusResult> {
  const res = await updateTicket(ticketId, { assigneeRecId: assigneeId || null });
  if (!res.ok) return { ok: false, error: res.error };
  if (assigneeId) await notifyAssignment(ticketId, assigneeId); // E9.4 — DM the editor (best-effort)
  return done(ticketId);
}

// Approvals are collapsed onto the status axis (per the Airtable-direct pivot):
// "request approval" = move to Review; a decision = Approved / In Revision.
export async function requestApproval(ticketId: string, _approverId?: string): Promise<UpdateStatusResult> {
  const res = await updateTicket(ticketId, { ticketStatus: 'Review' });
  if (!res.ok) return { ok: false, error: res.error };
  return done(ticketId);
}

export async function decideApproval(
  ticketId: string,
  decision: 'approved' | 'changes_requested',
  feedback: string,
): Promise<UpdateStatusResult> {
  const patch: TicketPatch = { ticketStatus: decision === 'approved' ? 'Approved' : 'In Revision' };
  if (feedback?.trim()) patch.notes = feedback.trim();
  const res = await updateTicket(ticketId, patch, { note: feedback?.trim() || undefined });
  if (!res.ok) return { ok: false, error: res.error };
  return done(ticketId);
}

// Editable delivery links on the ticket detail form. Each key is a TicketPatch field
// (1:1 with a Prio field). `url: true` marks Airtable url-typed fields (they reject
// non-URL strings, so we guard before writing). `delivery: true` marks a final-delivery
// link whose arrival is the "asset ready" signal (deduped by asset_ready_notified).
const ASSET_LINK_FIELDS = {
  assetFolderLink: { url: false, delivery: false },
  workingFiles: { url: false, delivery: false },
  final16x9: { url: false, delivery: true },
  folder16x9: { url: true, delivery: false },
  final9x16: { url: false, delivery: true },
  folder9x16: { url: true, delivery: false },
  final4x5: { url: false, delivery: true },
  folder4x5: { url: true, delivery: false },
} as const;

export type AssetLinkKey = keyof typeof ASSET_LINK_FIELDS;

// Write (or clear, with an empty value) a single delivery-link field.
// `isAds` gates the "ready" signal for the folder link: ads tickets deliver via the ratio
// Final Links, so only those notify; non-ads tickets have no ratio links, so the Asset
// Folder Link is their delivery signal instead.
export async function updateTicketLink(ticketId: string, key: string, value: string, isAds = false): Promise<UpdateStatusResult> {
  const spec = ASSET_LINK_FIELDS[key as AssetLinkKey];
  if (!spec) return { ok: false, error: 'Unknown field' };
  const v = value.trim();
  if (v && spec.url && !/^https?:\/\//i.test(v)) return { ok: false, error: 'Enter a full URL (https://…)' };
  const res = await updateTicket(ticketId, { [key as AssetLinkKey]: v } as TicketPatch);
  if (!res.ok) return { ok: false, error: res.error };
  // E9.4 — filling a delivery link DMs the requester + posts to #content-ready (once, best-effort).
  const isDelivery = spec.delivery || (key === 'assetFolderLink' && !isAds);
  if (v && isDelivery) await maybeNotifyAssetReady(ticketId, v);
  return done(ticketId);
}
