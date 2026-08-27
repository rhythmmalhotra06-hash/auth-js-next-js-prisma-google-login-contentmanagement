'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { getAdminAccess } from '@/lib/admin/access';
import { createClipRule } from '@/lib/clip-rules/repository';
import { PROPOSED_NOTE_PREFIX } from '@/lib/clipping/clip-types';

// Actions on the Performance page. Same never-throw convention as the other action files:
// a rejected server action reaches the browser as an opaque "client-side exception", so
// every path returns { ok, message }.

export interface PerfActionResult {
  ok: boolean;
  message: string;
}

async function guard(run: (email: string) => Promise<PerfActionResult>): Promise<PerfActionResult> {
  try {
    const { email } = await getAdminAccess();
    if (!email) return { ok: false, message: 'You need to be signed in to do this.' };
    const r = await run(email);
    revalidatePath('/performance');
    return r;
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Link a published post to the ticket that produced it.
 *
 * This is the human half of attribution, and it is not busywork: Hootsuite reports on
 * accounts whose permalinks the portal doesn't hold, so the URL join can't match them.
 * Attaching writes the link onto EVERY stored row for that post, and ingest inherits it on
 * later pulls (see inheritLinks), so the attachment is made once and sticks.
 */
export async function attachPostToTicket(postKey: string, ticketAirtableId: string): Promise<PerfActionResult> {
  return guard(async () => {
    const ticket = ticketAirtableId.trim();
    if (!ticket) return { ok: false, message: 'Pick a ticket first.' };
    // postKey is platformPostId when we have one, else the normalized URL — match either,
    // so every row for this post gets linked regardless of which key it was stored under.
    const { count } = await prisma.socialMetric.updateMany({
      where: { OR: [{ platformPostId: postKey }, { publishedUrl: postKey }] },
      data: { ticketAirtableId: ticket },
    });
    if (count === 0) return { ok: false, message: 'That post is no longer stored — run a pull and try again.' };
    return { ok: true, message: `Attached to the ticket (${count} metric row${count === 1 ? '' : 's'} updated).` };
  });
}

/** Undo an attachment. */
export async function detachPost(postKey: string): Promise<PerfActionResult> {
  return guard(async () => {
    const { count } = await prisma.socialMetric.updateMany({
      where: { OR: [{ platformPostId: postKey }, { publishedUrl: postKey }] },
      data: { ticketAirtableId: null },
    });
    return { ok: count > 0, message: count > 0 ? 'Detached.' : 'Nothing to detach.' };
  });
}

const MAX_RULE_CONTENT = 600;

/**
 * Turn a high performer into a PROPOSED clip rule for an admin to approve.
 *
 * Deliberately inactive on creation and marked with PROPOSED_NOTE_PREFIX, matching the
 * existing Tier-2 learning loop: the engine may propose, a human decides. The evidence
 * (reach, engagement, how far above the account's median) is written into the note so the
 * approver can judge it rather than trust it.
 */
export async function proposeLearningFromPost(input: {
  caption: string | null;
  account: string | null;
  reach: number | null;
  engagementRate: number | null;
  vsMedian: number | null;
  url: string | null;
}): Promise<PerfActionResult> {
  return guard(async (email) => {
    const caption = (input.caption ?? '').replace(/\s+/g, ' ').trim();
    if (caption.length < 20) {
      return { ok: false, message: 'This post has too little text to learn anything from.' };
    }
    const evidence = [
      input.account ? `@${input.account}` : null,
      input.reach != null ? `${input.reach.toLocaleString('en-US')} reach` : null,
      input.engagementRate != null ? `${input.engagementRate}% engagement` : null,
      input.vsMedian != null ? `${input.vsMedian}x the account median` : null,
    ].filter(Boolean).join(' · ');

    const res = await createClipRule({
      name: `Winner: ${caption.slice(0, 60)}`,
      clipType: 'All',
      content: `A post that outperformed on ${input.account ?? 'social'} opened like this:\n\n"${caption.slice(0, MAX_RULE_CONTENT)}"\n\nConsider what made it land — the opening move, the specificity, the ask — when writing similar posts.`,
      note: `${PROPOSED_NOTE_PREFIX} — ${evidence}${input.url ? ` · ${input.url}` : ''} · flagged by ${email}`,
      active: false, // propose only; an admin approves in Settings → Clip Rules
      updatedBy: email,
    });
    if (!res.ok) return { ok: false, message: res.error.message };
    return { ok: true, message: 'Proposed as a clip learning — an admin approves it in Settings → Clip Rules.' };
  });
}
